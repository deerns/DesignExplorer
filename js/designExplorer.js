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

function calWidthAndHeight() {
  (windowWidth = window.innerWidth),
    (windowHeight = window.innerHeight),
    (cleanHeight = windowHeight - 115), // 2
    (cleanWidth = windowWidth - 100),
    (graphHeight = cleanHeight / 3 - 24), //remove 22+2 top tool button
    (zoomedHeight = (cleanHeight * 2) / 3); //remove 22+2 top tool button
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

  _userSetting = {
    studyInfo: {
      name: "",
      date: "",
    },
    dimScales: {},
    dimTicks: {},
    dimMark: {},
    dimLabels: {},
    dimHidden: {},
    dimReversed: {},
    dimSliderTitleSizes: {},
    dimSliderTickSizes: {},
    imageLabels: {},
    labelSize: "",
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

function getSliderWrapperSelection(dimName) {
  if (typeof d3 === "undefined") return null;

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

function applySliderFontOverrides(setting) {
  if (typeof d3 === "undefined") return;

  var effectiveSetting = setting || _userSetting || {};
  var titleMap = effectiveSetting.dimSliderTitleSizes || {};
  var tickMap = effectiveSetting.dimSliderTickSizes || {};
  var baseTitleSize = normalizeSliderPercentSize(effectiveSetting.labelSize);
  var baseTickSize = 9;
  var baseSliderLabelPx = 12;
  var styleEl = ensureSliderFontOverrideStyleTag();
  var cssRules = [];

  if (baseTitleSize === null) {
    baseTitleSize = 85;
  }

  d3.selectAll("#inputSliders .inputSlider").each(function (d) {
    var dimName = d && d.name ? d.name : d;
    var wrapper = getSliderWrapperSelection(dimName);
    if (!wrapper) return;
    var wrapperId = wrapper.attr ? wrapper.attr("id") : null;
    if (!wrapperId) return;

    var titleOverride = normalizeSliderPercentSize(
      findSliderDimOverride(dimName, titleMap)
    );
    var tickOverride = normalizeSliderPixelSize(
      findSliderDimOverride(dimName, tickMap)
    );

    var resolvedTitlePercent =
      titleOverride !== null ? titleOverride : baseTitleSize;
    var resolvedTitlePx = (baseSliderLabelPx * resolvedTitlePercent) / 100;
    var resolvedTitleScale = resolvedTitlePercent / 100;
    var resolvedTick =
      (tickOverride !== null ? tickOverride : baseTickSize) + "px";
    var resolvedTitleLineHeight = Math.max(
      12,
      Math.round(resolvedTitlePx * 1.2)
    ) + "px";
    var wrapperSelector = "#" + wrapperId;

    cssRules.push(
      wrapperSelector +
        " .inputSliderLabel{" +
        "line-height:" +
        resolvedTitleLineHeight +
        " !important;" +
        "display:block !important;" +
        "}"
    );

    cssRules.push(
      wrapperSelector +
        " .inputSliderLabelText{" +
        "font-size:" +
        baseSliderLabelPx +
        "px !important;" +
        "display:inline-block !important;" +
        "transform:scale(" +
        resolvedTitleScale +
        ") !important;" +
        "transform-origin:left top !important;" +
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
  });

  if (styleEl) {
    styleEl.textContent = cssRules.join("\n");
  }
}

function applyLabelFontSize(size) {
  // Accept either preset keys or a raw CSS font-size string/number
  var map = {
    largeLabel: "95%",
    mediumLabel: "85%",
    smallLabel: "75%",
  };

  var resolved = map.hasOwnProperty(size) ? map[size] : size;

  if (typeof resolved === "number") {
    resolved = resolved + "%";
  } else if (typeof resolved === "string") {
    var trimmed = resolved.trim();
    // If only a number is provided, treat it as a percentage for consistency
    if (/^[0-9.]+$/.test(trimmed)) {
      resolved = trimmed + "%";
    } else {
      resolved = trimmed;
    }
  } else {
    return;
  }

  try {
    d3.selectAll(".label").style("font-size", resolved);
    applySliderFontOverrides(
      Object.assign({}, _userSetting || {}, {
        labelSize: resolved,
      })
    );
  } catch (err) {
    console.warn("Could not apply label font size", err);
  }

  // persist into global settings if available
  if (typeof _userSetting !== "undefined") {
    _userSetting.labelSize = resolved;
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
