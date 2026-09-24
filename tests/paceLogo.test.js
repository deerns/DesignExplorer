const test = require('node:test');
const assert = require('node:assert/strict');
const install = require('../pace/pace-logo.js');

function harness(running = true) {
  const events = {}, observers = new Set();
  let current;
  function element(percent) {
    const attributes = { 'data-progress-text': percent + '%', 'data-progress': '99' };
    const properties = {};
    return {
      attributes, properties,
      style: { setProperty(key, value) { properties[key] = value; } },
      getAttribute(key) { return attributes[key]; },
      setAttribute(key, value) { attributes[key] = value; },
    };
  }
  const env = {
    Pace: { running, on(event, handler) { events[event] = handler; } },
    document: { querySelector() { return current; } },
    MutationObserver: class {
      constructor(callback) { this.callback = callback; }
      observe(target) { this.target = target; observers.add(this); }
      disconnect() { observers.delete(this); }
    },
  };
  current = running ? element(0) : null;
  install(env);
  return {
    get current() { return current; },
    replace(percent = 0) { current = element(percent); return current; },
    emit(event) { events[event](); },
    observerCount() { return observers.size; },
    progress(percent, target = current) {
      target.setAttribute('data-progress-text', percent + '%');
      observers.forEach(observer => { if (observer.target === target) observer.callback(); });
    },
  };
}

test('radial filled area and accessible value follow the existing Pace percentage', () => {
  const h = harness();
  assert.equal(h.current.attributes.role, 'progressbar');
  for (const percent of [0, 25, 50, 75, 100]) {
    h.progress(percent);
    const radius = Number(h.current.properties['--pace-fill']);
    assert.ok(Math.abs(radius * radius - percent / 100) < 1e-10);
    assert.equal(h.current.attributes['aria-valuenow'], String(percent));
  }
  assert.equal(h.current.properties['--pace-fill'], '1', '100% is read from the text, not Pace\'s capped data-progress attribute');
});

test('starting after the document is created, finishing and hiding follow Pace events', () => {
  const h = harness(false);
  assert.equal(h.observerCount(), 0);
  h.replace(12); h.emit('start');
  assert.equal(h.current.attributes['aria-valuenow'], '12');
  h.emit('done');
  assert.equal(h.current.properties['--pace-fill'], '1');
  h.emit('hide');
  assert.equal(h.observerCount(), 0);
});

test('a new loading cycle starts at its own percentage and releases the old observer', () => {
  const h = harness();
  h.progress(80);
  const previous = h.current;
  h.emit('stop');
  assert.equal(h.observerCount(), 0);
  h.replace(); h.emit('start');
  assert.equal(h.current.attributes['aria-valuenow'], '0');
  h.progress(99, previous);
  assert.equal(h.current.attributes['aria-valuenow'], '0');
  h.progress(25);
  assert.equal(h.current.properties['--pace-fill'], '0.5');
  assert.equal(h.observerCount(), 1);
});
