const welcomePopup = document.getElementById("welcome");
const welcomePanel = document.getElementById("welcomeContainer");
const loadDataPanel = document.getElementById("loadDataContainer");
const getDataButton = document.getElementById("showLoadData");
const settingsPopup = document.getElementById("showSetting");
const settingsTitle = document.getElementById("settingsTitle");
const settingsButton = document.getElementById("showSettingsButton");
const sharePopup = document.getElementById("showStillLink");
const explorerRegions = ["explorerNavbar", "sidebar-wrapper", "mainContentLayout"]
  .map(id => document.getElementById(id));

let explorerLoading = false;
let focusBeforeLoading = null;

function syncExplorerLayers() {
  const welcomeVisible = !welcomePopup.hidden;
  const settingsVisible = !settingsPopup.hidden;
  const popupVisible = welcomeVisible || settingsVisible;
  document.body.classList.toggle("explorer-popup-visible", popupVisible);
  explorerRegions.forEach(region => { region.inert = explorerLoading || popupVisible; });
  sharePopup.inert = explorerLoading;
  welcomePopup.inert = explorerLoading || !welcomeVisible;
  settingsPopup.inert = explorerLoading || !settingsVisible;
}

function focusWelcomePopup() {
  if (loadDataPanel.hidden) {
    welcomePanel.querySelector(".popupWindowClose").focus({ preventScroll: true });
  } else {
    const input = document.getElementById("folderLink");
    input.focus({ preventScroll: true });
    input.select();
  }
}

function showWelcomePopup(showLoadData = false) {
  closeSettingsPopup();
  welcomePanel.hidden = showLoadData;
  loadDataPanel.hidden = !showLoadData;
  welcomePopup.setAttribute("aria-labelledby", showLoadData ? "loadDataTitle" : "welcomeTitle");
  welcomePopup.hidden = false;
  syncExplorerLayers();
  if (!explorerLoading) focusWelcomePopup();
}

function closeWelcomePopup() {
  if (welcomePopup.hidden) return;
  const restoreFocus = welcomePopup.contains(document.activeElement);
  welcomePopup.hidden = true;
  syncExplorerLayers();
  if (restoreFocus) getDataButton.focus({ preventScroll: true });
}

function showSettingsPopup() {
  closeWelcomePopup();
  settingsPopup.hidden = false;
  syncExplorerLayers();
  if (!explorerLoading) settingsTitle.focus({ preventScroll: true });
}

function closeSettingsPopup() {
  if (settingsPopup.hidden) return;
  settingsPopup.hidden = true;
  syncExplorerLayers();
  if (!explorerLoading) settingsButton.focus({ preventScroll: true });
}

function setExplorerLoading(loading) {
  if (explorerLoading === loading) return;
  if (loading) focusBeforeLoading = document.activeElement;
  explorerLoading = loading;
  syncExplorerLayers();

  if (!loading) {
    if (document.activeElement === document.body) {
      focusBeforeLoading?.focus({ preventScroll: true });
      if (!settingsPopup.hidden && !settingsPopup.contains(document.activeElement)) {
        settingsTitle.focus({ preventScroll: true });
      } else if (!welcomePopup.hidden && !welcomePopup.contains(document.activeElement)) {
        focusWelcomePopup();
      }
    }
    focusBeforeLoading = null;
  }
}

[welcomePopup, settingsPopup].forEach(popup => {
  popup.addEventListener("keydown", event => {
    if (event.key !== "Tab") return;

    const focusable = Array.from(popup.querySelectorAll("button, input, select, textarea, a[href]"))
      .filter(element => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === settingsTitle)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  });
});

if (window.Pace) {
  Pace.on("start", () => setExplorerLoading(true));
  Pace.on("hide", () => setExplorerLoading(false));
  Pace.on("stop", () => setExplorerLoading(false));
}

syncExplorerLayers();
if (document.querySelector(".pace.pace-active")) setExplorerLoading(true);
else focusWelcomePopup();
