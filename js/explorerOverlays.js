const welcomePopup = document.getElementById("welcome");
const welcomePanel = document.getElementById("welcomeContainer");
const loadDataPanel = document.getElementById("loadDataContainer");
const getDataButton = document.getElementById("showLoadData");
const explorerRegions = ["explorerNavbar", "sidebar-wrapper", "mainContentLayout"]
  .map(id => document.getElementById(id));
const loadingOnlyRegions = ["showSetting", "showStillLink"]
  .map(id => document.getElementById(id));

let explorerLoading = false;
let focusBeforeLoading = null;

function syncExplorerLayers() {
  const welcomeVisible = !welcomePopup.hidden;
  document.body.classList.toggle("explorer-welcome-visible", welcomeVisible);
  explorerRegions.forEach(region => { region.inert = explorerLoading || welcomeVisible; });
  loadingOnlyRegions.forEach(region => { region.inert = explorerLoading; });
  welcomePopup.inert = explorerLoading || !welcomeVisible;
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

function setExplorerLoading(loading) {
  if (explorerLoading === loading) return;
  if (loading) focusBeforeLoading = document.activeElement;
  explorerLoading = loading;
  syncExplorerLayers();

  if (!loading) {
    if (document.activeElement === document.body) {
      focusBeforeLoading?.focus({ preventScroll: true });
      if (!welcomePopup.hidden && !welcomePopup.contains(document.activeElement)) {
        focusWelcomePopup();
      }
    }
    focusBeforeLoading = null;
  }
}

welcomePopup.addEventListener("keydown", event => {
  if (event.key !== "Tab") return;

  const focusable = Array.from(welcomePopup.querySelectorAll("button, input, a[href]"))
    .filter(element => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length);
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

if (window.Pace) {
  Pace.on("start", () => setExplorerLoading(true));
  Pace.on("hide", () => setExplorerLoading(false));
  Pace.on("stop", () => setExplorerLoading(false));
}

syncExplorerLayers();
if (document.querySelector(".pace.pace-active")) setExplorerLoading(true);
else focusWelcomePopup();
