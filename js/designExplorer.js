function ensureInitialGlobalDataState() {
  if (typeof originalData === "undefined") originalData = "";
  if (typeof cleanedData === "undefined") cleanedData = [];
  if (typeof numericalData === "undefined") numericalData = [];
  if (typeof inputData === "undefined") inputData = [];
  if (typeof outputData === "undefined") outputData = [];
  if (typeof slidersInfo === "undefined") slidersInfo = [];
  if (typeof currentSliderValues === "undefined") currentSliderValues = {};
  if (typeof allDataCollector === "undefined") allDataCollector = {};
  if (typeof slidersMapping === "undefined") slidersMapping = {};
  if (typeof ids === "undefined") ids = [];
  if (typeof cleanedKeys4pc === "undefined") cleanedKeys4pc = {};
  if (typeof googleFolderLink === "undefined") googleFolderLink = "";
  if (typeof inputDataKeys === "undefined") inputDataKeys = [];
  if (typeof outputDataKeys === "undefined") outputDataKeys = [];
  if (typeof image1LinkKeys === "undefined") image1LinkKeys = [];
  if (typeof image2LinkKeys === "undefined") image2LinkKeys = [];
  if (typeof imageLinkKeys === "undefined") imageLinkKeys = [];
  if (typeof imageKeyAliases === "undefined") imageKeyAliases = {};
}

ensureInitialGlobalDataState();

function unloadPageContent() {
  /*
    	// This function removes current contents from the page
    	// Only base HTML objects will remain in the page afterwards
    	// Use this in case you want to load new data to the page
    */
  overwriteInitialGlobalValues();

  d3.select("div.legend").selectAll("*").remove(); // remove legend

  d3.select("#inputSliders").selectAll("*").remove(); //remove sliders
  d3.select("#inputSliders").append("form").attr("class", "sliders"); // append a form

  d3.select("div#graph").selectAll("*").remove(); //remove left side parallel coord graph
  d3.select("div#radarChart").selectAll("*").remove(); //remove right side graph

  d3.select("div#thumbnails-btm_container")
    .select("div#sorting")
    .selectAll("*")
    .remove(); // remove sorting drop-down
  d3.select("div#thumbnails-btm_container").select("div#sorting").text("");
  d3.select("div#thumbnails-btm_container")
    .select("div#thumbnails-btm")
    .selectAll("*")
    .remove(); // remove thumbnail images

  d3.select("div#thumbnails-side_container")
    .select("div#sorting")
    .selectAll("*")
    .remove(); // remove thumbnail images
  d3.select("div#thumbnails-side_container").select("div#sorting").text("");
  d3.select("div#thumbnails-side_container")
    .select("div#thumbnails-side")
    .selectAll("*")
    .remove(); // remove thumbnail images

  d3.select("div#zoomed").selectAll("*").remove(); //remove zoomed image if any
  d3.select("div#viewer3d").selectAll("*").remove(); //remove any object inside 3D viewer
}

var mainVerticalLayoutState = {
  topRatio: 0.58,
  topControlsHeight: 24,
  minGraphHeight: 120,
  minBottomHeight: 150,
};

function getAvailableMainViewportHeight() {
  var viewportHeight =
    typeof window !== "undefined" && isFinite(window.innerHeight)
      ? window.innerHeight
      : 0;

  if (!(viewportHeight > 0) || typeof document === "undefined") {
    return Math.max(viewportHeight, 0);
  }

  var anchorNode =
    document.getElementById("mainContentLayout") ||
    document.getElementById("page-content-wrapper");
  var pageContentNode = document.getElementById("page-content-wrapper");
  var topOffset = 0;
  var bottomPadding = 0;

  if (
    anchorNode &&
    typeof anchorNode.getBoundingClientRect === "function"
  ) {
    topOffset = anchorNode.getBoundingClientRect().top;
  }

  if (
    pageContentNode &&
    typeof window.getComputedStyle === "function"
  ) {
    bottomPadding =
      parseFloat(window.getComputedStyle(pageContentNode).paddingBottom) || 0;
  }

  return Math.max(viewportHeight - topOffset - bottomPadding, 0);
}

function resolveMainVerticalTopControlsHeight() {
  var measuredTopControlsHeight = null;

  if (
    typeof window !== "undefined" &&
    typeof window.getMeasuredMainVerticalTopControlsHeight === "function"
  ) {
    measuredTopControlsHeight = window.getMeasuredMainVerticalTopControlsHeight();
  }

  if (
    isFinite(measuredTopControlsHeight) &&
    measuredTopControlsHeight > 0
  ) {
    mainVerticalLayoutState.topControlsHeight = measuredTopControlsHeight;
  }

  return mainVerticalLayoutState.topControlsHeight;
}

function getMainVerticalLayoutBounds(totalHeight) {
  var topControlsHeight = resolveMainVerticalTopControlsHeight();
  var resolvedTotalHeight =
    isFinite(totalHeight) && totalHeight > 0
      ? totalHeight
      : getAvailableMainViewportHeight();
  var minTopHeight =
    topControlsHeight + mainVerticalLayoutState.minGraphHeight;
  var minBottomHeight = mainVerticalLayoutState.minBottomHeight;

  if (minTopHeight + minBottomHeight > resolvedTotalHeight) {
    minBottomHeight = Math.max(
      100,
      Math.min(minBottomHeight, resolvedTotalHeight * 0.35)
    );
    minTopHeight = Math.max(
      topControlsHeight + 80,
      resolvedTotalHeight - minBottomHeight
    );
  }

  return {
    minTop: minTopHeight,
    maxTop: Math.max(minTopHeight, resolvedTotalHeight - minBottomHeight),
  };
}

function getMainVerticalLayoutTopHeight() {
  var topControlsHeight = resolveMainVerticalTopControlsHeight();
  return (
    (isFinite(graphHeight) ? graphHeight : 0) +
    topControlsHeight
  );
}

function setMainVerticalLayoutTopHeight(nextTopHeight) {
  if (!isFinite(nextTopHeight)) {
    return getMainVerticalLayoutTopHeight();
  }

  var totalHeight = getAvailableMainViewportHeight();
  var bounds = getMainVerticalLayoutBounds(totalHeight);
  var resolvedTopHeight = Math.max(
    bounds.minTop,
    Math.min(bounds.maxTop, nextTopHeight)
  );

  mainVerticalLayoutState.topRatio =
    totalHeight > 0 ? resolvedTopHeight / totalHeight : mainVerticalLayoutState.topRatio;
  if (
    typeof window !== "undefined" &&
    typeof window.syncLayoutRatiosToUserSetting === "function"
  ) {
    window.syncLayoutRatiosToUserSetting();
  }

  return resolvedTopHeight;
}

function calWidthAndHeight() {
  var topControlsHeight = resolveMainVerticalTopControlsHeight();
  windowWidth = window.innerWidth;
  windowHeight = window.innerHeight;
  cleanHeight = getAvailableMainViewportHeight();
  cleanWidth = windowWidth;

  var bounds = getMainVerticalLayoutBounds(cleanHeight);
  var desiredTopHeight = cleanHeight * mainVerticalLayoutState.topRatio;
  if (!isFinite(desiredTopHeight) || desiredTopHeight <= 0) {
    desiredTopHeight = cleanHeight / 3;
  }

  var topHeight = Math.max(
    bounds.minTop,
    Math.min(bounds.maxTop, desiredTopHeight)
  );

  mainVerticalLayoutState.topRatio =
    cleanHeight > 0 ? topHeight / cleanHeight : 1 / 3;
  if (
    typeof window !== "undefined" &&
    typeof window.syncLayoutRatiosToUserSetting === "function"
  ) {
    window.syncLayoutRatiosToUserSetting();
  }
  graphHeight = Math.max(
    topHeight - topControlsHeight,
    80
  ); // remove 22+2 top tool button
  zoomedHeight = Math.max(cleanHeight - topHeight, 0);
}

function overwriteInitialGlobalValues() {
  /*
    	// This function initiates all the global values for the page
    	// I'm not sure if this is the best practice in javascript (probably it's not)
    	// Let me (github.com/mostaphaRoudsari) know if you know a better solution
    */

  originalData = ""; //csv as it is imported
  cleanedData = []; //all the columns to be used for parallel coordinates
  (numericalData = []), (inputData = []); // columns with input values - to be used for sliders
  outputData = []; // columns with output values - to be used for radar graph
  slidersInfo = []; // {name:'inputName', tickValues : [sorted set of values]},
  currentSliderValues = {}; // collector for values
  allDataCollector = {};
  slidersMapping = {}; // I collect the data for all the input sliders here so I can use it to remap the sliders later
  ids = []; // Here I collect all data based on a unique ID from inputs
  cleanedKeys4pc = {};
  googleFolderLink = "";

  inputDataKeys = [];
  outputDataKeys = [];
  image1LinkKeys = [];
  image2LinkKeys = [];
  imageLinkKeys = [];
  imageKeyAliases = {};
  if (typeof window !== "undefined") {
    window.__allDimensions = {};
  }

  var defaultUserSetting =
    typeof createDefaultUserSettingState === "function"
      ? createDefaultUserSettingState()
      : {
          studyInfo: {
            name: "",
            date: "",
          },
          dimScales: {},
          dimTicks: {},
          dimMark: {},
          dimLabels: {},
          dimLabelsNormalized: {},
          dimHidden: {},
          dimHiddenNormalized: {},
          dimReversed: {},
          dimReversedNormalized: {},
          dimOrder: [],
          sliderOrder: [],
          dimSliderTitleSizes: {},
          dimSliderTickSizes: {},
          imageLabels: {},
          thumbnailSortBy: "",
          thumbnailSortAscending: true,
          scatterSelectedVariables: [],
          hideScatterPlots: false,
          showInputOutputBars: false,
          mainVerticalRatio: 0.58,
          chartHorizontalRatio: null,
          labelSize:
            typeof defaultLabelSizeValue !== "undefined"
              ? defaultLabelSizeValue
              : "90%",
          labelSizeBase:
            typeof defaultLabelSizeValue !== "undefined"
              ? defaultLabelSizeValue
              : "90%",
          sliderTickSize:
            typeof defaultSliderTickSize !== "undefined"
              ? defaultSliderTickSize + "px"
              : "9px",
          labelRotation:
            typeof defaultLabelRotationValue !== "undefined"
              ? defaultLabelRotationValue
              : 0,
          sliderTagHighlightColor:
            typeof defaultSliderTagHighlightColor !== "undefined"
              ? defaultSliderTagHighlightColor
              : "#000000",
          sliderTagFontSize:
            typeof defaultSliderTagFontSize !== "undefined"
              ? defaultSliderTagFontSize
              : 12,
          targetMarkFontSize:
            typeof defaultTargetMarkFontSize !== "undefined"
              ? defaultTargetMarkFontSize
              : 12,
          lineGradient: {
            enabled: false,
            start:
              typeof defaultLineGradientColors !== "undefined"
                ? defaultLineGradientColors[0]
                : "#102F86",
            end:
              typeof defaultLineGradientColors !== "undefined"
                ? defaultLineGradientColors[1]
                : "#2FADDD",
          },
        };

  _userSetting =
    typeof mergeUserSettingWithDefaults === "function"
      ? mergeUserSettingWithDefaults(defaultUserSetting)
      : defaultUserSetting;

  if (typeof window !== "undefined") {
    window.sortBy = "";
    window.__thumbnailSortAscending = true;
  }
  sortBy = "";
  ascending = true;

  if (
    typeof color !== "undefined" &&
    color &&
    typeof color.range === "function"
  ) {
    color.range(
      typeof defaultLineGradientColors !== "undefined"
        ? defaultLineGradientColors.slice()
        : ["#102F86", "#2FADDD"]
    );
  }

  if (typeof clearScatterSelectionState === "function") {
    clearScatterSelectionState();
  }

  rcheight = height = d3.select("#graph").style("height").replace("px", "");

  selectedDataFormatted = [];

  firstRating = true; // variable for star rating

  //set up heights of divs ro default
  calWidthAndHeight();

  pcHeight = d3.select("#graph").style("height").replace("px", "");
  // hide zoomed area
  d3.selectAll(".zoomed").style("height", "0px");
  // show btm thumbnail
  d3.select("#thumbnails-btm_container").style("height", zoomedHeight + "px");

  // re-set the viewer to 2D
  currentView = "2D";
  // set view toggle to 2D
  d3.select("input#toggleView").property("checked", "true");

  initit3DViewer = true;
  d3.select("#zoomed").classed("hidden", false);
  d3.select("#viewer3d").classed("hidden", true);
}

function getUrlVars(rawUrl) {
  var vars = {};
  var parts = rawUrl.replace(
    /[?&]+([^=&]+)=([^&]*)/gi,
    function (m, key, value) {
      vars[key] = value;
    }
  );
  return vars;
}

var Gkey = "AIzaSyCSrF08UMawxKIb0m4JsA1mYE5NMmP36bY";
var BitlyKey = "52e99e2d788d32ae8ea99007d96917ac4ba50a5a";

function prepareGFolder(folderLink) {
  googleReturnObj = {
    //{"fileName":Google Drive ID}
    csvFiles: {},
    img1Files: {},
    img2Files: {},
    jsonFiles: {},
    settingFiles: {},
  };

  var folder = {
    DE_PW: "", // short code from google or base64 coded inLink
    inLink: "", //raw url
    url: "", //url to load the list item inside the folder
    type: "", //folder type : GoogleDrive, OneDrive, or userServerLink
  };
  //_folderInfo = folderLink;

  folder = folderLink;

  d3.json(folder.url, function (data) {
    var csvFiles = {};
    var img1Files = {};
    var img2Files = {};
    var jsonFiles = {};
    var settingFiles = {};

    if (folder.type === "GoogleDrive") {
      //this is google returned obj
      data.files.forEach(function (item) {
        var GLink = "";
        //googleReturnObj[item.name]=item.id

        if (item.mimeType === "text/csv") {
          GLink =
            "https://www.googleapis.com/drive/v3/files/" +
            item.id +
            "?alt=media&key=" +
            Gkey;
          //this item is a data csv file
          csvFiles[item.name] = GLink;
        } else if (item.mimeType.startsWith("image")) {
          GLink =
            "https://drive.google.com/thumbnail?id=" + item.id + "&sz=w1000";
          //this item is a image file
          imgFiles[item.name] = GLink;
        } else if (item.mimeType === "application/json") {
          GLink =
            "https://www.googleapis.com/drive/v3/files/" +
            item.id +
            "?alt=media&key=" +
            Gkey;

          if (item.name.startsWith("settings")) {
            //this item is a Design Explore's setting file
            settingFiles[item.name] = GLink;
          } else {
            //this item is a json model
            jsonFiles[item.name] = GLink;
          }
        }
      });
    } else if (folder.type === "OneDrive") {
      //this is OneDrive returned obj
      var files = [];

      if (data.children !== undefined) {
        files = data.children;
      } else if (data.value !== undefined) {
        files = data.value;
      }

      files.forEach(function (item) {
        //googleReturnObj[item.name]=item.id
        var fileName = item.name;
        var fileType = item.file.mimeType;
        var fileLink = item["@content.downloadUrl"];

        if (fileName.toLowerCase().endsWith(".csv")) {
          //this item is a data csv file
          csvFiles[fileName] = fileLink; //{"fileName":"fileURL"}
        } else if (fileType.startsWith("image")) {
          //this item is a image file
          imgFiles[fileName] = fileLink;
        } else if (fileType === "application/json") {
          if (fileName.startsWith("settings")) {
            //this item is a Design Explore's setting file
            settingFiles[fileName] = fileLink;
          } else {
            //this item is a json model
            jsonFiles[fileName] = fileLink;
          }
        }
      });
    }

    $.extend(_googleReturnObj.csvFiles, csvFiles);
    $.extend(_googleReturnObj.imgFiles, imgFiles);
    $.extend(_googleReturnObj.jsonFiles, jsonFiles);
    $.extend(_googleReturnObj.settingFiles, settingFiles);
    //console.log(data);

    if (data.nextPageToken !== undefined) {
      if (folder.url.search("&pageToken=") > 0) {
        folder.url = folder.url.split("&pageToken=", 1)[0];
      }

      folder.url += "&pageToken=" + data.nextPageToken;

      prepareGFolder(folder);
    } else if (data["children@odata.nextLink"] !== undefined) {
      folder.url = data["children@odata.nextLink"];

      prepareGFolder(folder);
    } else if (data["@odata.nextLink"] !== undefined) {
      folder.url = data["odata.nextLink"];

      prepareGFolder(folder);
    } else {
      //this is the last page, so return googleReturnObj directly

      var csvFile = _googleReturnObj.csvFiles["data.csv"];

      if (csvFile === undefined) {
        alert(
          "Could not find the data.csv file in this folder, please double check!"
        );
      } else {
        readyToLoad(csvFile);
      }
    }
  });
}

function MP_getGoogleIDandLoad(dataMethod) {
  var serverFolderLink;

  document.getElementById("csv-file").value = "";

  if (dataMethod === "URL") {
    document.getElementById("folderLink").value = "";

    var inUrl = window.location.href;
    decodeUrlID(inUrl, function (d) {
      loadFromUrl(d);
    });
  } else {
    serverFolderLink = document.getElementById("folderLink").value;
    loadFromUrl(serverFolderLink);
  }
}

function loadFromUrl(rawUrl) {
  checkInputLink(rawUrl, function (d) {
    _folderInfo = d; //set global foler obj

    if (d.type === "userServerLink") {
      //this is a user's server link, and load csv directly
      readyToLoad(d.url + "data.csv", d.url + "settings.json");
    } else {
      //this is from Google or MS
      prepareGFolder(d);
    }

    //console.log(link);
  });
}

function normalizeSliderPercentSize(size) {
  if (size === undefined || size === null) return null;
  if (typeof size === "number" && isFinite(size)) return size;

  var str = String(size).trim();
  if (!str) return null;
  if (/%$/.test(str)) {
    str = str.replace(/%$/, "");
  }

  var num = parseFloat(str);
  return isNaN(num) ? null : num;
}

function normalizeSliderPixelSize(size) {
  if (size === undefined || size === null) return null;
  if (typeof size === "number" && isFinite(size)) return size;

  var str = String(size).trim();
  if (!str) return null;
  if (/px$/i.test(str)) {
    str = str.replace(/px$/i, "");
  }

  var num = parseFloat(str);
  return isNaN(num) ? null : num;
}

function normalizeSliderDimKey(key) {
  if (typeof normalizeDimKey === "function") {
    return normalizeDimKey(key);
  }

  var raw = key;
  if (raw && typeof raw === "object") {
    raw =
      raw.name ||
      raw.key ||
      raw.dim ||
      raw.dimension ||
      (typeof raw.toString === "function" ? raw.toString() : "");
  }

  return (raw || "")
    .toString()
    .trim()
    .replace(/[_\.]/g, " ")
    .replace(/^in:/i, "")
    .replace(/^out:/i, "")
    .toLowerCase();
}

function findSliderDimOverride(dimName, settingMap) {
  var map = settingMap || {};

  if (map[dimName] !== undefined) {
    return map[dimName];
  }

  var target = normalizeSliderDimKey(dimName);
  var match = Object.keys(map).find(function (key) {
    return normalizeSliderDimKey(key) === target;
  });

  return match ? map[match] : undefined;
}

function getSliderDimNameFromNode(node, datum) {
  var attrDim =
    node && typeof node.getAttribute === "function"
      ? node.getAttribute("data-dim")
      : "";
  if (attrDim) {
    return attrDim;
  }

  if (datum && typeof datum === "object") {
    return datum.name || datum.key || datum.dim || datum.dimension || datum;
  }

  return datum;
}

function getSliderWrapperSelection(dimName) {
  if (typeof d3 === "undefined") return null;

  var byDataDim = d3.selectAll("#inputSliders .inputSlider").filter(function (d) {
    var currentDim = getSliderDimNameFromNode(this, d);
    return normalizeSliderDimKey(currentDim) === normalizeSliderDimKey(dimName);
  });
  if (!byDataDim.empty()) {
    return byDataDim;
  }

  if (typeof string_as_unicode_escape === "function") {
    var escaped = string_as_unicode_escape(String(dimName));
    var byId = d3.select("#sliderWrap_" + escaped);
    if (!byId.empty()) {
      return byId;
    }
  }

  var fallback = d3.selectAll("#inputSliders .inputSlider").filter(function (d) {
    var currentDim = d && d.name ? d.name : d;
    return normalizeSliderDimKey(currentDim) === normalizeSliderDimKey(dimName);
  });

  return fallback.empty() ? null : fallback;
}

function getGraphDimensionSelection(dimName) {
  if (typeof d3 === "undefined") return null;

  var byData = d3.selectAll("#graph .dimension").filter(function (d) {
    var currentDim = getSliderDimNameFromNode(this, d);
    return normalizeSliderDimKey(currentDim) === normalizeSliderDimKey(dimName);
  });
  if (!byData.empty()) {
    return byData;
  }

  if (typeof string_as_unicode_escape === "function") {
    var escaped = string_as_unicode_escape(String(dimName));
    var byId = d3.select("#dim_" + escaped);
    if (!byId.empty()) {
      return byId;
    }
  }

  return null;
}

function ensureSliderFontOverrideStyleTag() {
  if (typeof document === "undefined") return null;

  var styleEl = document.getElementById("slider-font-overrides");
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "slider-font-overrides";
    (document.head || document.getElementsByTagName("head")[0]).appendChild(
      styleEl
    );
  }

  return styleEl;
}

function getBaseLabelFontSizePercent() {
  var baseSize = normalizeSliderPercentSize(
    _userSetting && _userSetting.labelSizeBase
  );
  if (baseSize === null) {
    baseSize = normalizeSliderPercentSize(_userSetting && _userSetting.labelSize);
  }
  if (baseSize === null && typeof defaultLabelSizeValue !== "undefined") {
    baseSize = normalizeSliderPercentSize(defaultLabelSizeValue);
  }
  return baseSize === null ? 90 : baseSize;
}

function getDefaultSliderLabelPixelBase() {
  return 12;
}

function resolveLabelFontSizePercentValue(size) {
  var presetResolved = resolveRelativeLabelFontSize(size);
  var resolved = presetResolved !== null ? presetResolved : size;
  var percent = normalizeSliderPercentSize(resolved);

  if (percent === null) {
    return null;
  }

  return Math.max(50, Math.min(200, percent));
}

function formatResolvedLabelFontSizePercent(size) {
  var percent = resolveLabelFontSizePercentValue(size);
  if (percent === null) {
    return null;
  }

  return Math.round(percent * 100) / 100 + "%";
}

function convertLabelFontSizePercentToPixels(size) {
  var percent = resolveLabelFontSizePercentValue(size);
  if (percent === null) {
    return null;
  }

  var pixels = (getDefaultSliderLabelPixelBase() * percent) / 100;
  return Math.max(8, Math.round(pixels * 100) / 100);
}

function resolveRelativeLabelFontSize(size) {
  var scaleMap = {
    largeLabel: 1.2,
    mediumLabel: 1,
    smallLabel: 0.8,
  };
  if (!scaleMap.hasOwnProperty(size)) {
    return null;
  }

  var resolvedPercent = Math.max(
    50,
    Math.min(200, getBaseLabelFontSizePercent() * scaleMap[size])
  );
  return Math.round(resolvedPercent * 100) / 100 + "%";
}

function applySliderFontOverrides(setting) {
  if (typeof d3 === "undefined") return;

  var effectiveSetting = setting || _userSetting || {};
  var titleMap = effectiveSetting.dimSliderTitleSizes || {};
  var tickMap = effectiveSetting.dimSliderTickSizes || {};
  var baseTitleSize = resolveLabelFontSizePercentValue(
    effectiveSetting.labelSize
  );
  if (baseTitleSize === null) {
    baseTitleSize = resolveLabelFontSizePercentValue(
      effectiveSetting.labelSizeBase
    );
  }
  var baseTickSize = normalizeSliderPixelSize(effectiveSetting.sliderTickSize);
  var baseSliderLabelPx = getDefaultSliderLabelPixelBase();
  var styleEl = ensureSliderFontOverrideStyleTag();
  var cssRules = [];
  var dimNames = [];
  var seenDims = {};

  function addDimName(dimName) {
    var normalized = normalizeSliderDimKey(dimName);
    if (!normalized || seenDims[normalized]) return;
    seenDims[normalized] = true;
    dimNames.push(dimName);
  }

  if (baseTitleSize === null) {
    baseTitleSize =
      typeof defaultLabelSizePercent !== "undefined"
        ? defaultLabelSizePercent
        : 90;
  }
  if (baseTickSize === null) {
    baseTickSize =
      typeof defaultSliderTickSize !== "undefined"
        ? defaultSliderTickSize
        : 9;
  }

  d3.selectAll("#inputSliders .inputSlider").each(function (d) {
    addDimName(getSliderDimNameFromNode(this, d));
  });

  d3.selectAll("#graph .dimension").each(function (d) {
    addDimName(getSliderDimNameFromNode(this, d));
  });

  Object.keys(titleMap).forEach(addDimName);
  Object.keys(tickMap).forEach(addDimName);

  dimNames.forEach(function (dimName) {
    var wrapper = getSliderWrapperSelection(dimName);
    var wrapperId = wrapper && wrapper.attr ? wrapper.attr("id") : null;
    var graphDim = getGraphDimensionSelection(dimName);
    var graphDimId = graphDim && graphDim.attr ? graphDim.attr("id") : null;
    var graphDimSelector = graphDimId ? "#" + graphDimId : null;
    if (!graphDimSelector && typeof string_as_unicode_escape === "function") {
      graphDimSelector = "#dim_" + string_as_unicode_escape(String(dimName));
    }

    var titleOverride = normalizeSliderPercentSize(
      findSliderDimOverride(dimName, titleMap)
    );
    var tickOverride = normalizeSliderPixelSize(
      findSliderDimOverride(dimName, tickMap)
    );

    var resolvedTitlePercent =
      titleOverride !== null ? titleOverride : baseTitleSize;
    var resolvedTitlePx = Math.max(
      8,
      (baseSliderLabelPx * resolvedTitlePercent) / 100
    );
    var resolvedTickPx = tickOverride !== null ? tickOverride : baseTickSize;
    var resolvedTick = resolvedTickPx + "px";
    var resolvedTitleLineHeight = Math.max(
      12,
      Math.round(resolvedTitlePx * 1.2)
    ) + "px";
    var resolvedGridHeight = Math.max(
      20,
      Math.round(resolvedTickPx * 2.2)
    ) + "px";
    var resolvedSliderHeight = Math.max(
      60,
      40 + Math.round(resolvedTickPx * 1.4)
    ) + "px";

    if (graphDimSelector) {
      cssRules.push(
        graphDimSelector +
          " .label{" +
          "font-size:" +
          resolvedTitlePx +
          "px !important;" +
          "}"
      );

      cssRules.push(
        graphDimSelector +
          " .axis .tick:not(.mark) text{" +
          "font-size:" +
          resolvedTick +
          " !important;" +
          "}"
      );
    }

    if (wrapperId) {
      var wrapperSelector = "#" + wrapperId;

      cssRules.push(
        wrapperSelector +
          " .inputSliderLabel{" +
          "line-height:" +
          resolvedTitleLineHeight +
          " !important;" +
          "min-height:" +
          resolvedTitleLineHeight +
          " !important;" +
          "display:block !important;" +
          "}"
      );

      cssRules.push(
        wrapperSelector +
          " .inputSliderLabelText{" +
          "font-size:" +
          resolvedTitlePx +
          "px !important;" +
          "line-height:" +
          resolvedTitleLineHeight +
          " !important;" +
          "display:inline-block !important;" +
          "transform:none !important;" +
          "}"
      );

      cssRules.push(
        wrapperSelector +
          " .irs-with-grid{" +
          "height:" +
          resolvedSliderHeight +
          " !important;" +
          "}"
      );

      cssRules.push(
        wrapperSelector +
          " .irs-grid{" +
          "height:" +
          resolvedGridHeight +
          " !important;" +
          "}"
      );

      cssRules.push(
        wrapperSelector +
          " .irs-grid-text{" +
          "font-size:" +
          resolvedTick +
          " !important;" +
          "line-height:" +
          resolvedTick +
          " !important;" +
          "}"
      );
    }
  });

  if (styleEl) {
    styleEl.textContent = cssRules.join("\n");
  }
}

function applyLabelFontSize(size) {
  var presetResolved = resolveRelativeLabelFontSize(size);
  var shouldUpdateBaseSize = presetResolved === null;
  var resolvedPercent = formatResolvedLabelFontSizePercent(
    presetResolved !== null ? presetResolved : size
  );
  var resolvedPixels = convertLabelFontSizePercentToPixels(
    presetResolved !== null ? presetResolved : size
  );

  if (resolvedPercent === null || resolvedPixels === null) {
    return;
  }

  try {
    d3.selectAll(".label").style("font-size", resolvedPixels + "px");
    applySliderFontOverrides(
      Object.assign({}, _userSetting || {}, {
        labelSize: resolvedPercent,
      })
    );
  } catch (err) {
    console.warn("Could not apply label font size", err);
  }

  // persist into global settings if available
  if (typeof _userSetting !== "undefined") {
    if (shouldUpdateBaseSize) {
      _userSetting.labelSizeBase = resolvedPercent;
    }
    _userSetting.labelSize = resolvedPercent;
  }
}

function changeLabelSize(size) {
  applyLabelFontSize(size);
}
//TODO remove link after test
function checkInputLink(link, callback) {
  var folderLinkObj = {
    DE_PW: "",
    inLink: "",
    url: "",
    type: "",
  };

  {
    var sanitizedLink = (link || "").trim();
    var lowerLink = sanitizedLink.toLowerCase();
    var csvSuffix = "data.csv";

    // strip a trailing data.csv file reference
    if (lowerLink.endsWith(csvSuffix)) {
      sanitizedLink = sanitizedLink.slice(0, sanitizedLink.length - csvSuffix.length);
    }

    // strip trailing file references (csv/json/png) to get the containing folder
    var fileMatch = sanitizedLink.match(/^(.*\/)[^\/]+\.(csv|json|png)(\?.*)?$/i);
    if (fileMatch && fileMatch[1]) {
      sanitizedLink = fileMatch[1];
    }

    if (sanitizedLink.slice(-1) !== "/") {
      sanitizedLink += "/";
    }

    folderLinkObj.url = sanitizedLink;
    folderLinkObj.type = "userServerLink";
  }

  folderLinkObj.inLink = folderLinkObj.url;
  // console.log(folderLinkObj);
  callback(folderLinkObj);
}

function encodeUrl(url) {
  // URL-safe wrapper so shared links survive copy/paste
  return encodeURIComponent(btoa(url));
}

function decodeUrl(encodedString) {
  var url = "";
  var decodedComponent = encodedString;
  try {
    decodedComponent = decodeURIComponent(encodedString);
  } catch (err) {
    decodedComponent = encodedString;
  }

  try {
    url = atob(decodedComponent);
  } catch (err) {
    // Fallback for older or malformed base64 strings
    var fixed = decodedComponent.replace(/_/g, "/").replace(/-/g, "+");
    while (fixed.length % 4 !== 0) {
      fixed += "=";
    }
    url = atob(fixed);
  }

  return url;
}

function getGFolderID(link) {
  var linkID;

  if (link.includes("google.com")) {
    if (link.includes("?usp=sharing")) {
      linkID = link.replace("?usp=sharing", "");
    } else if (link.includes("open?id=")) {
      linkID = link.replace("open?id=", "");
    } else {
      linkID = link;
    }

    linkID = linkID.split("/");
    linkID = linkID[linkID.length - 1];
  } else {
    //server link or ms
    linkID = link;
  }

  return linkID;
}

function CopyToClipboard(element) {
  var $temp = $("<input>");
  $("body").append($temp);
  $temp.val($(element).text()).select();
  document.execCommand("copy");
  $temp.remove();
}

function makeUrlId(rawUrl, callback) {
  var longUrl = rawUrl;
  var authHeader =
    BitlyKey && BitlyKey.toLowerCase().indexOf("bearer ") === 0
      ? BitlyKey
      : "Bearer " + BitlyKey;

  $.ajax({
    type: "POST",
    contentType: "application/json",
    url: "https://api-ssl.bitly.com/v4/shorten",
    data: JSON.stringify({
      long_url: longUrl,
    }),
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    error: function (e) {
      // Fall back to the actual ID value embedded in the URL so shared links still work without the shortener
      var fallbackId = getUrlVars(longUrl).ID || encodeUrl(longUrl);
      callback(fallbackId);
    },
    dataType: "json",
    success: function (response) {
      // Bitly v4 returns `link` (https://bit.ly/XXXX) and `id` (bit.ly/XXXX)
      var bitlyLink = response.link || response.id || "";
      var UrlID = bitlyLink ? bitlyLink.split("/").pop() : "";
      if (!UrlID) {
        var fallbackId = getUrlVars(longUrl).ID || encodeUrl(longUrl);
        callback(fallbackId);
        return;
      }
      callback("BL_" + UrlID);
    },
  });
}

function getUrlID(urlID, callback) {
  var authHeader =
    BitlyKey && BitlyKey.toLowerCase().indexOf("bearer ") === 0
      ? BitlyKey
      : "Bearer " + BitlyKey;

  $.ajax({
    url: "https://api-ssl.bitly.com/v4/expand",
    type: "POST",
    dataType: "json",
    data: JSON.stringify({
      bitlink_id: "bit.ly/" + urlID,
    }),
    headers: {
      Authorization: authHeader,
    },
    contentType: "application/json",
    success: function (result) {
      callback(result.long_url);
    },
    error: function (error) {},
  });
}

function decodeUrlID(rawUrl, callback) {
  var serverFolderLink = "";
  var urlVars = getUrlVars(rawUrl);
  var GfolderORUrl = urlVars.GFOLDER;
  var DEID = urlVars.ID;

  //old GFOLDER
  if (GfolderORUrl !== undefined) {
    if (GfolderORUrl.search("/") == -1) {
      //GfolderORUrl is google folder ID
      serverFolderLink =
        "https://drive.google.com/drive/folders/" + GfolderORUrl;
    } else {
      serverFolderLink = GfolderORUrl;
    }

    callback(serverFolderLink);
  } else if (DEID !== undefined) {
    //linkID = rawUrl.split("/");
    //linkID = linkID[linkID.length - 1];
    linkID = DEID;
    //console.log(linkID)

    if (linkID.length === 6) {
      d3.json(
        "https://www.googleapis.com/urlshortener/v1/url?key=" +
          Gkey +
          "&shortUrl=http://goo.gl/" +
          linkID,
        function (d) {
          var GID = getUrlVars(d.longUrl).ID;
          serverFolderLink = decodeUrl(GID);
          callback(serverFolderLink);
        }
      );
    } else if (linkID.startsWith("BL_")) {
      getUrlID(linkID.replace("BL_", ""), function (d) {
        var GID = getUrlVars(d).ID;
        serverFolderLink = decodeUrl(GID);
        callback(serverFolderLink);
      });
    } else {
      serverFolderLink = decodeUrl(linkID);
      callback(serverFolderLink);
    }
  } else {
  }
}
