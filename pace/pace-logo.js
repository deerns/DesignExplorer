/* Render Pace's existing page-load percentage using the Solar Shading logo. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory;
  else factory(root);
})(typeof window !== "undefined" ? window : this, function (env) {
  "use strict";
  var pace = env.Pace;
  if (!pace) return;
  var progress = null;
  var observer = null;

  function update(value) {
    if (!progress) return;
    if (value === undefined) value = parseFloat(progress.getAttribute("data-progress-text"));
    var percent = isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
    // Area grows with radius squared: 50% should fill half the logo's area.
    progress.style.setProperty("--pace-fill", String(Math.sqrt(percent / 100)));
    progress.setAttribute("aria-valuenow", String(percent));
  }

  function disconnect() {
    if (observer) observer.disconnect();
    observer = null;
    progress = null;
  }

  function connect() {
    disconnect();
    progress = env.document.querySelector(".pace .pace-progress");
    if (!progress) return;
    progress.setAttribute("role", "progressbar");
    progress.setAttribute("aria-label", "Loading Design Explorer");
    progress.setAttribute("aria-valuemin", "0");
    progress.setAttribute("aria-valuemax", "100");
    update();
    observer = new env.MutationObserver(function () { update(); });
    observer.observe(progress, { attributes: true, attributeFilter: ["data-progress-text"] });
  }

  pace.on("start", connect);
  pace.on("done", function () { update(100); });
  pace.on("stop", disconnect);
  pace.on("hide", disconnect);
  // Pace may have started before this script was loaded.
  if (pace.running) connect();
});
