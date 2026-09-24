/* Shared, parallel image requests for thumbnails and the 2D viewers. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory;
  } else {
    root.studyImageLoader = factory(root);
  }
})(typeof window !== "undefined" ? window : this, function (env, options) {
  "use strict";

  var config = Object.assign({
    concurrency: 24,
    perOrigin: 16,
    interval: 0,
    retries: 5,
    retryDelay: 3000,
    maxRetryDelay: 60000,
    timeout: 30000,
    cacheSize: 128,
    cacheBytes: 32 * 1024 * 1024,
  }, options);
  var placeholder = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
  var jobs = new Map();
  var origins = new Map();
  var states = new Map();
  var active = 0;
  var timer = null;
  var observer = env.IntersectionObserver ? new env.IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var state = states.get(entry.target);
      if (!state) return;
      state.visible = entry.isIntersecting;
      if (state.visible && !state.job) subscribe(state);
    });
    schedule();
  }, { rootMargin: "100px" }) : null;

  function now() { return env.Date.now(); }

  function live(state) {
    return states.get(state.element) === state && state.element.isConnected;
  }

  function display(state, status) {
    if (!live(state)) return;
    state.element.setAttribute("data-image-state", status);
    state.element.setAttribute("aria-busy", String(status !== "loaded" && status !== "error"));
    state.element.title = state.title + (status === "error"
      ? "\nImage could not be loaded. Click to retry."
      : status === "retrying" ? "\nImage temporarily unavailable. Retrying automatically..." : "");
    state.displayTitle = state.element.title;
    if (status === "loaded") {
      var source = state.job.displayUrl || state.url;
      if (state.renderedUrl !== source) state.element.src = source;
      state.renderedUrl = source;
      if (observer) observer.unobserve(state.element);
    }
  }

  function schedule(delay) {
    if (timer !== null) env.clearTimeout(timer);
    timer = env.setTimeout(pump, delay || 0);
  }

  function subscribe(state) {
    var job = jobs.get(state.url);
    if (!job) {
      var parsed = new env.URL(state.url, env.document.baseURI);
      var origin = parsed.origin;
      if (!origins.has(origin)) origins.set(origin, { active: 0, next: 0, pause: 0 });
      job = { url: state.url, origin: origins.get(origin), status: "queued", attempts: 0,
        ready: 0, subscribers: new Set(), image: null, timeout: null, bytes: 0,
        // Also recognize Supabase Storage behind a custom domain.
        useFetch: /^\/storage\/v1\/(object|render\/image)\//.test(parsed.pathname) &&
          !!(env.fetch && env.AbortController && env.URL.createObjectURL) };
      jobs.set(state.url, job);
    }
    // Keep recently reused results at the end of the bounded cache.
    jobs.delete(state.url);
    jobs.set(state.url, job);
    state.job = job;
    job.subscribers.add(state);
    display(state, job.status);
  }

  function prune() {
    var bytes = 0;
    jobs.forEach(function (job, url) {
      job.subscribers.forEach(function (state) {
        if (!live(state)) clear(state.element);
      });
      if (!job.subscribers.size && job.status === "queued") jobs.delete(url);
      bytes += job.bytes;
    });
    // Subscribers keep their result even if its cache entry is evicted.
    jobs.forEach(function (job, url) {
      if ((jobs.size > config.cacheSize || bytes > config.cacheBytes) &&
          (job.status === "loaded" || job.status === "error" ||
            (job.status === "retrying" && !job.subscribers.size))) {
        jobs.delete(url);
        bytes -= job.bytes;
        if (!job.subscribers.size) dispose(job);
      }
    });
  }

  function dispose(job) {
    if (job.displayUrl) env.URL.revokeObjectURL(job.displayUrl);
    job.displayUrl = null;
    job.bytes = 0;
  }

  function retryAfter(value) {
    if (!value) return 0;
    if (/^\d+(\.\d+)?$/.test(value.trim())) return Number(value) * 1000;
    return Math.max(0, env.Date.parse(value) - now()) || 0;
  }

  function pump() {
    timer = null;
    prune();
    if (active >= config.concurrency) return;
    var candidates = [];
    jobs.forEach(function (job) {
      if (job.status !== "queued" && job.status !== "retrying") return;
      var priority = -1;
      job.subscribers.forEach(function (state) {
        if (live(state) && state.visible) priority = Math.max(priority, state.priority);
      });
      if (priority >= 0) candidates.push({ job: job, priority: priority });
    });
    candidates.sort(function (a, b) {
      // Keep viewers first, then give new images a turn before due retries.
      return b.priority - a.priority || a.job.attempts - b.job.attempts;
    });
    var next = Infinity;
    candidates.forEach(function (candidate) {
      var job = candidate.job;
      if (active >= config.concurrency || job.origin.active >= config.perOrigin) return;
      var ready = Math.max(job.ready, job.origin.next, job.origin.pause);
      if (ready > now()) {
        next = Math.min(next, ready - now());
      } else {
        start(job);
      }
    });
    if (next < Infinity && active < config.concurrency) schedule(next);
  }

  function start(job) {
    var image = new env.Image();
    var controller = job.useFetch ? new env.AbortController() : null;
    job.image = image;
    job.status = "loading";
    job.attempts++;
    active++;
    job.origin.active++;
    job.origin.next = now() + config.interval;
    job.subscribers.forEach(function (state) { display(state, "loading"); });
    var finished = false;
    function finish(success, status, serverDelay) {
      if (finished) return;
      finished = true;
      env.clearTimeout(job.timeout);
      image.onload = image.onerror = null;
      job.image = null;
      job.cancel = null;
      active--;
      job.origin.active--;
      if (success) {
        job.status = "loaded";
      } else if (status && status < 500 && status !== 408 && status !== 429) {
        // Missing files and denied access will not improve with more requests.
        job.status = "error";
      } else {
        // A failed image waits independently, leaving slots free for the rest.
        var exponent = Math.min(5, job.attempts - 1);
        var delay = Math.min(config.maxRetryDelay, config.retryDelay * Math.pow(2, exponent));
        delay += Math.floor(env.Math.random() * delay * 0.2);
        delay = Math.max(delay, serverDelay || 0);
        job.ready = now() + delay;
        // Pause the host only for explicit throttling or a server-requested
        // cooldown. Native image/decode/network errors cannot establish that.
        if (status === 429 || (status === 503 && serverDelay > 0)) {
          job.origin.pause = Math.max(job.origin.pause, job.ready);
        }
        job.status = job.attempts <= config.retries ? "retrying" : "error";
      }
      if (!success) dispose(job);
      job.subscribers.forEach(function (state) { display(state, job.status); });
      schedule();
    }
    image.onload = function () { finish(true); };
    image.onerror = function () { finish(false); };
    job.cancel = function () {
      finished = true;
      env.clearTimeout(job.timeout);
      image.onload = image.onerror = null;
      if (controller) controller.abort();
      image.removeAttribute("src");
      dispose(job);
    };
    job.timeout = env.setTimeout(function () {
      finish(false);
      if (controller) controller.abort();
      image.removeAttribute("src");
    }, config.timeout);
    // Keep the original URL (including signed parameters) and browser cache.
    if (!controller) {
      image.src = job.url;
      return;
    }
    env.fetch(job.url, { signal: controller.signal }).then(function (response) {
      if (finished) return;
      if (!response.ok) {
        finish(false, response.status, retryAfter(response.headers.get("Retry-After")));
        return;
      }
      return response.blob().then(function (blob) {
        if (finished) return;
        job.displayUrl = env.URL.createObjectURL(blob);
        job.bytes = blob.size;
        image.src = job.displayUrl;
      });
    }).catch(function () {
      if (finished) return;
      // A proxy may deny CORS even though native images work. Use the native
      // route on the next delayed attempt, without adding an immediate request.
      job.useFetch = false;
      finish(false);
    });
  }

  function retry(state) {
    var job = state.job;
    if (!job || job.status !== "error") return;
    job.status = "queued";
    job.attempts = 0;
    job.ready = 0;
    jobs.set(job.url, job);
    job.subscribers.forEach(function (subscriber) { display(subscriber, "queued"); });
    schedule();
  }

  function clear(element) {
    var state = states.get(element);
    if (!state) return;
    if (observer) observer.unobserve(element);
    if (state.job) state.job.subscribers.delete(state);
    if (state.job && !state.job.subscribers.size && jobs.get(state.url) !== state.job) {
      dispose(state.job);
    }
    element.removeEventListener("click", state.onClick, true);
    element.removeAttribute("data-image-state");
    element.removeAttribute("aria-busy");
    element.removeAttribute("src");
    element.title = state.title;
    states.delete(element);
  }

  function set(element, url, settings) {
    if (!element) return;
    settings = settings || {};
    url = String(url || "").trim();
    var previous = states.get(element);
    if (previous && previous.url === url) {
      if (element.title !== previous.displayTitle) previous.title = element.title;
      display(previous, previous.job ? previous.job.status : "queued");
      return;
    }
    // Callers may already have updated the title for the newly selected design.
    var title = element.title;
    clear(element);
    if (!url) return;
    var state = { element: element, url: url, title: title, job: null,
      visible: !settings.lazy || !observer, priority: settings.lazy ? 0 : 1 };
    state.onClick = function (event) {
      if (!state.job || state.job.status !== "error") return;
      // A failed viewer image should retry instead of cycling to another view.
      // Thumbnail clicks still select the design while retrying its image.
      if (event && !settings.lazy) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      retry(state);
    };
    states.set(element, state);
    element.addEventListener("click", state.onClick, true);
    element.setAttribute("decoding", "async");
    element.src = placeholder;
    display(state, "queued");
    if (state.visible) subscribe(state);
    else observer.observe(element);
    schedule();
  }

  function release(container) {
    if (!container) return;
    states.forEach(function (state, element) {
      if (container === element || container.contains(element)) clear(element);
    });
    schedule();
  }

  function reset() {
    states.forEach(function (state, element) { clear(element); });
    if (observer) observer.disconnect();
    jobs.forEach(function (job) {
      if (job.cancel) job.cancel();
      dispose(job);
    });
    jobs.clear();
    active = 0;
    // Keep host cooldowns when switching studies; server limits still apply.
    origins.forEach(function (origin) { origin.active = 0; });
    if (timer !== null) env.clearTimeout(timer);
    timer = null;
  }

  return { set: set, clear: clear, release: release, reset: reset };
});
