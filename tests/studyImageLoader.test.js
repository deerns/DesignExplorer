const test = require('node:test');
const assert = require('node:assert/strict');
const createLoader = require('../js/studyImageLoader.js');

function harness(options = {}, supportsObserver = true) {
  let time = 0, nextTimer = 0, observer;
  const timers = new Map(), requests = [], fetches = [], revoked = [];
  class Element {
    constructor() { this.isConnected = true; this.title = 'Design'; this.attributes = {}; this.listeners = {}; }
    setAttribute(key, value) { this.attributes[key] = value; }
    removeAttribute(key) { delete this.attributes[key]; if (key === 'src') this.src = ''; }
    addEventListener(key, listener) { this.listeners[key] = listener; }
    removeEventListener(key) { delete this.listeners[key]; }
    contains(element) { return this === element; }
    get status() { return this.attributes['data-image-state']; }
  }
  class Image {
    set src(url) { this.url = url; requests.push({ url, time, image: this }); }
    removeAttribute() { this.url = ''; }
    succeed() { if (this.onload) this.onload(); }
    fail() { if (this.onerror) this.onerror(); }
  }
  class ImageURL extends URL {
    static createObjectURL() { return 'blob:local/' + ++nextTimer; }
    static revokeObjectURL(url) { revoked.push(url); }
  }
  const env = {
    Image, URL: ImageURL, AbortController,
    Date: { now: () => time, parse: Date.parse }, Math: { random: () => 0 },
    document: { baseURI: 'https://explorer.test/' },
    setTimeout(fn, delay) { const id = ++nextTimer; timers.set(id, { fn, at: time + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    fetch(url, options) { return new Promise((resolve, reject) => fetches.push({ url, options, resolve, reject, time })); },
  };
  if (supportsObserver) env.IntersectionObserver = class {
    constructor(callback) { this.callback = callback; this.elements = new Set(); observer = this; }
    observe(element) { this.elements.add(element); }
    unobserve(element) { this.elements.delete(element); }
    disconnect() { this.elements.clear(); }
  };
  function tick(duration = 0) {
    const end = time + duration;
    let count = 0;
    while (true) {
      const next = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      assert.ok(++count < 10000, 'timer loop must terminate');
      timers.delete(next[0]); time = next[1].at; next[1].fn();
    }
    time = end;
  }
  async function respond(index, status, retryAfter = null, size = 100) {
    fetches[index].resolve({ ok: status === 200, status,
      headers: { get: () => retryAfter }, blob: () => Promise.resolve({ size }) });
    for (let i = 0; i < 6; i++) await Promise.resolve();
    tick();
  }
  return { loader: createLoader(env, options), requests, fetches, revoked, Element, tick, respond,
    visible(elements, visible = true) { observer.callback(elements.map(target => ({ target, isIntersecting: visible }))); },
    image(url, lazy = false) { const el = new Element(); this.loader.set(el, url, { lazy }); return el; },
  };
}

const storage = 'https://project.supabase.co/storage/v1/object/public/study/';

test('a study with 1000 thumbnails requests only visible images, with paced concurrency', () => {
  const h = harness();
  const images = Array.from({ length: 1000 }, (_, i) => h.image('https://images.test/' + i, true));
  h.tick(1000);
  assert.equal(h.requests.length, 0);
  h.visible(images.slice(0, 12)); h.tick();
  assert.equal(h.requests.length, 1);
  h.tick(199); assert.equal(h.requests.length, 1);
  h.tick(1); assert.equal(h.requests.length, 2);
  h.tick(1000); assert.equal(h.requests.length, 2);
  h.requests[0].image.succeed(); h.tick();
  assert.equal(h.requests.length, 3);
  assert.equal(images[50].status, 'queued');
});

test('scrolling away drops queued thumbnails and the viewer has priority', () => {
  const h = harness();
  const thumbs = [1, 2, 3].map(i => h.image('https://images.test/' + i, true));
  h.visible(thumbs); h.tick();
  h.visible([thumbs[1]], false);
  h.image('https://images.test/viewer');
  h.tick(200);
  assert.equal(h.requests[1].url, 'https://images.test/viewer');
  h.requests[0].image.succeed(); h.requests[1].image.succeed(); h.tick(200);
  assert.equal(h.requests[2].url, 'https://images.test/3');
});

test('global concurrency is bounded across different hosts', () => {
  const h = harness();
  for (let i = 0; i < 10; i++) h.image('https://host' + i + '.test/image');
  h.tick(); assert.equal(h.requests.length, 4);
  h.requests[0].image.succeed(); h.tick(); assert.equal(h.requests.length, 5);
});

test('duplicate URLs share in-flight requests and loaded results after redraw', () => {
  const h = harness();
  const first = h.image('https://images.test/shared'); h.tick();
  const viewer = h.image('https://images.test/shared'); h.tick();
  assert.equal(h.requests.length, 1);
  h.loader.release(first);
  const replacement = h.image('https://images.test/shared'); h.tick();
  h.requests[0].image.succeed(); h.tick();
  assert.equal(viewer.status, 'loaded'); assert.equal(replacement.status, 'loaded');
  h.image('https://images.test/shared'); h.tick();
  assert.equal(h.requests.length, 1);
  assert.equal(first.status, undefined);
});

for (const header of ['10', 'Thu, 01 Jan 1970 00:00:10 GMT']) {
  test('Supabase 429 pauses its host until Retry-After: ' + header, async () => {
    const h = harness();
    const image = h.image(storage + 'one.png');
    h.image(storage + 'two.png'); h.tick();
    await h.respond(0, 429, header);
    assert.equal(image.status, 'retrying');
    h.image('https://other.test/image'); h.tick();
    assert.equal(h.requests.length, 1, 'another host remains available');
    h.tick(9999); assert.equal(h.fetches.length, 1);
    h.tick(1); assert.equal(h.fetches.length, 2);
    await h.respond(1, 200);
    h.requests.at(-1).image.succeed(); h.tick();
    assert.equal(image.status, 'loaded');
    assert.match(image.src, /^blob:/);
  });
}

test('Supabase signed URLs stay unchanged and download once for two viewers', async () => {
  const h = harness();
  const url = storage.replace('/public/', '/sign/') + 'one.png?token=a%2Fb&download=';
  const first = h.image(url), second = h.image(url); h.tick();
  assert.equal(h.fetches[0].url, url);
  await h.respond(0, 200); h.requests[0].image.succeed(); h.tick();
  assert.equal(h.fetches.length, 1);
  assert.equal(first.src, second.src);
});

test('permanent Supabase failures do not retry or block other files', async () => {
  const h = harness();
  const missing = h.image(storage + 'missing.png'); h.image(storage + 'good.png'); h.tick();
  await h.respond(0, 404);
  assert.equal(missing.status, 'error');
  h.tick(200); assert.equal(h.fetches.length, 2);
  await h.respond(1, 200); h.requests[0].image.succeed(); h.tick(100000);
  assert.equal(h.fetches.length, 2);
});

test('automatic retries back off, stop at the limit, and allow a manual retry', () => {
  const h = harness({ retries: 2, retryDelay: 1000 });
  const image = h.image('https://images.test/failing'); h.tick();
  h.requests[0].image.fail(); h.tick(999); assert.equal(h.requests.length, 1);
  h.tick(1); h.requests[1].image.fail();
  h.tick(1999); assert.equal(h.requests.length, 2);
  h.tick(1); h.requests[2].image.fail(); h.tick(10000);
  assert.equal(h.requests.length, 3); assert.equal(image.status, 'error');
  assert.match(image.title, /Click to retry/);
  image.listeners.click(); h.tick(); assert.equal(h.requests.length, 4);
  h.requests[3].image.succeed(); h.tick(); assert.equal(image.status, 'loaded');
});

test('changing selection cannot display a late image from the old selection', () => {
  const h = harness();
  const image = h.image('https://images.test/old'); h.tick();
  image.title = 'New design'; h.loader.set(image, 'https://images.test/new'); h.tick(200);
  h.requests[1].image.succeed(); h.requests[0].image.succeed(); h.tick();
  assert.equal(image.src, 'https://images.test/new'); assert.equal(image.title, 'New design');
});

test('clearing a study cancels fetches and ignores late completions', async () => {
  const h = harness();
  const image = h.image(storage + 'old.png'); h.tick();
  h.loader.reset();
  assert.equal(h.fetches[0].options.signal.aborted, true);
  await h.respond(0, 200); h.tick(100000);
  assert.equal(h.requests.length, 0); assert.equal(image.status, undefined);
});

test('a stalled image times out and frees a slot', () => {
  const h = harness({ timeout: 1000, concurrency: 1 });
  const stalled = h.image('https://first.test/image'); h.image('https://second.test/image'); h.tick(1000);
  assert.equal(stalled.status, 'retrying'); assert.equal(h.requests.length, 2);
  assert.equal(h.requests[1].url, 'https://second.test/image');
});

test('without IntersectionObserver image loading remains paced', () => {
  const h = harness({}, false);
  for (let i = 0; i < 100; i++) h.image('https://images.test/' + i, true);
  h.tick(500); assert.equal(h.requests.length, 2);
});

test('CORS failure uses a paced native fallback', async () => {
  const h = harness(); const image = h.image(storage + 'image.png'); h.tick();
  h.fetches[0].reject(new TypeError('CORS'));
  for (let i = 0; i < 6; i++) await Promise.resolve();
  h.tick(2999); assert.equal(h.requests.length, 0);
  h.tick(1); assert.equal(h.requests[0].url, storage + 'image.png');
  h.requests[0].image.succeed(); h.tick(); assert.equal(image.status, 'loaded');
});

test('blob cache eviction preserves displayed images and releases unused blobs', async () => {
  const h = harness({ cacheBytes: 50 });
  const image = h.image(storage + 'image.png'); h.tick();
  await h.respond(0, 200); h.requests[0].image.succeed(); h.tick();
  assert.equal(h.revoked.length, 0);
  h.loader.clear(image); assert.deepEqual(h.revoked, [h.requests[0].url]);
});

test('failed viewer clicks retry without cycling, while thumbnail clicks still select', () => {
  const h = harness({ retries: 0 });
  const viewer = h.image('https://images.test/viewer'); h.tick();
  h.requests[0].image.fail();
  let stopped = false;
  viewer.listeners.click({ preventDefault() {}, stopImmediatePropagation() { stopped = true; } });
  assert.equal(stopped, true);
  const thumbnail = h.image('https://other.test/thumbnail', true);
  h.visible([thumbnail]); h.tick();
  h.requests[1].image.fail();
  stopped = false;
  thumbnail.listeners.click({ preventDefault() {}, stopImmediatePropagation() { stopped = true; } });
  assert.equal(stopped, false);
});

test('releasing a grid removes queued work and disconnects observation', () => {
  const h = harness();
  const first = h.image('https://images.test/first', true);
  const queued = h.image('https://images.test/queued', true);
  h.visible([first, queued]); h.tick();
  h.loader.release({ contains: () => true });
  h.requests[0].image.succeed(); h.tick(100000);
  assert.equal(h.requests.length, 1);
  assert.equal(queued.status, undefined);
});
