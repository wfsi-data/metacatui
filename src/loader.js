/**
 *   MetacatUI
 *   https://github.com/NCEAS/metacatui
 *   MetacatUI is a client-side web interface for querying Metacat servers and other servers that implement the DataONE REST API.
 **/

// Step 1: Find the data-theme specified in the script include
var MetacatUI = MetacatUI || {};
MetacatUI.theme = document.getElementById("loader").getAttribute("data-theme");
MetacatUI.metacatContext = document.getElementById("loader").getAttribute("data-metacat-context");
MetacatUI.mapKey = document.getElementById("loader").getAttribute("data-map-key");
if ( (MetacatUI.mapKey == "YOUR-GOOGLE-MAPS-API-KEY") || (!MetacatUI.mapKey) ) {
    MetacatUI.mapKey = null;
}
MetacatUI.useD3 = true;

// Find out of MetacatUI is deployed in a sub-directory off the top level of
// the domain. This value is used throughout the app to determin the location
// of assets and, if not set correctly, a lot of things break. Your web server
// should also set a FallbackResource directive accordingly in order to support
// users entering MetacatUI from URLs other than the root
MetacatUI.root = "/metacatui"
// Remove trailing slash if one is present
MetacatUI.root = MetacatUI.root.replace(/\/$/, "");

//This version of Metacat UI - used for cache busting
MetacatUI.metacatUIVersion = "2.3.1";

/** Insert a Schema.org/Dataset description as JSON-LD for the current page
	  when appropriate. Note that there is very similar code in MetadataView.js
	  and the codebase is not shared. This code is here for clients like
	  Google's web crawler that need the JSON-LD injected earlier than 
	  MetadataView.js does. The reason for the duplication is that MetadataView.js
	  properly refreshes the JSON-LD on page navigation whereas this code cannot
	  because it's outside the Backbone app. */
(function() {
	var getIdentifier = function(url) {
		if (typeof url !== "string" && !(url.length > 0)) {
			return null;
		}

		var identifier_index = url.indexOf("view/");

		if (identifier_index === -1) {
			return null;
		}

		return decodeURIComponent(url.slice(identifier_index + 5, url.length + 1));
	}

	var getDatePublishedText = function (doc) {
		if (typeof doc === "undefined" || doc === null) {
			return null;
		}

		return doc.pubDate || doc.dateUploaded || null;
	}

	

	var getYearPublishedText = function(doc) {
		if (typeof doc === "undefined" || doc === null) {
			return null;
		}

		var datePublishedText = getDatePublishedText(doc);
		var yearPublishedDate = new Date(datePublishedText);

		if (typeof yearPublishedDate.getUTCFullYear === "function" &&
			  !isNaN(yearPublishedDate.getUTCFullYear())) {
			return yearPublishedDate.getUTCFullYear().toString();
		} else {
			return "";
		}
	}

	var generateSchemaOrgGeo = function (north, east, south, west) {
		if (north === south) {
			return {
				"@type": "GeoCoordinates",
				"latitude": north,
				"longitude": west
			};
		} else {
			return {
				"@type": "GeoShape",
				"box": west + ", " + south + " " + east + ", " + north
			};
		}
	};

	var generateGeoJSONString = function (north, east, south, west) {
		if (north === south) {
			var preamble = "{\"type\":\"Point\",\"coordinates\":",
				inner = "[" + east + "," + north + "]",
				postamble = "}";

			return preamble + inner + postamble;
		} else {
			var preamble = "{\"type\":\"Feature\",\"properties\":{},\"geometry\"" +
				":{\"type\"\:\"Polygon\",\"coordinates\":[[";

			// Handle the case when the polygon wraps across the 180W/180E boundary
			if (east < west) {
				east = 360 - east
			}

			var inner = "[" + west + "," + south + "]," +
				"[" + east + "," + south + "]," +
				"[" + east + "," + north + "]," +
				"[" + west + "," + north + "]," +
				"[" + west + "," + south + "]";

			var postamble = "]]}}";

			return preamble + inner + postamble;
		}
	};

	var getAuthorText = function(authors) {
		if (typeof authors === "undefined" ||
				authors === null ||
				!authors.length) {
			return "";
		}

		var authorText = "";

		for (var i = 0; i < authors.length; i++) {
			if (i == 5) {
				authorText += ", et al";
				break;
			}

			if (i > 0) {
				if (authors.length > 2) {
					authorText += ",";
				}

				if (i + 1 == authors.length) {
					authorText += " and";
				}

				if (authors.length > 1) {
					authorText += " ";
				}
			}

			authorText += authors[i];
		}

		return authorText;
	}

	var getCitationIdentifierText = function (doc, nodeName) {
		if (typeof doc === "undefined" ||
		    doc === null) {
			return "";
		}

		if (doc.seriesId) {
			if (typeof nodeName === "string" && nodeName === "PANGAEA") {
				return doc.seriesId || "";
			} else {
				return (doc.seriesId + ", version: " + doc.identifier) || "";
			}
		} else {
			return doc.identifier || "";
		}
	}

	var generateXhrCallbackNodeRequest = function generateXhrCallbackNodeRequest(doc) {
    return function () {
			if (typeof doc === "undefined" || doc === null) {
				return;
			}

			var domParser = new DOMParser();
			var dom = domParser.parseFromString(this.responseText, "application/xml");

			if (dom.querySelector("parsererror")) {
				return;
			}
			
			var nameNode = dom.querySelector("name");

			if (nameNode) {
				var nodeName = dom.querySelector("name").innerHTML;
			} else {
				nodeName = doc.datasource || null;
			}

			var jsonld = {
				"@context": {
					"@vocab": "http://schema.org/",
				},
				"@type": "Dataset",
				"@id": "https://dataone.org/datasets/" + 
					encodeURIComponent(doc.identifier),
				"url": window.location.href,
				"isAccessibleForFree": true,
				"version": doc.identifier,
				"identifier": doc.identifier,
				"datePublished" : getDatePublishedText(doc)
			};

			if (nodeName) {
				jsonld.publisher = nodeName;
			}
	
			if (doc.title) {
				jsonld.name = doc.title;
			}
	
			if (doc.abstract) {
				jsonld.description = doc.abstract;
			}
	
			if (doc.origin) {
				jsonld.creator = doc.origin
			}
	
			if (doc.keywords) {
				jsonld.keywords = doc.keywords.join(", ");
			}
	
			if (doc.attributeName) {
				jsonld.variablesMeasured = doc.attributeName;
			}
	
			if (doc.beginDate && doc.endDate) {
				jsonld.temporalCoverage = doc.beginDate + "/" + doc.endDate;
			} else if (doc.beginDate || doc.endDate) {
				jsonld.temporalCoverage = doc.beginDate || doc.endDate;
			}

			if (doc.northBoundCoord &&
				doc.eastBoundCoord &&
				doc.southBoundCoord &&
				doc.westBoundCoord) {
	
				jsonld.spatialCoverage = {
					"@type": "Place",
					"additionalProperty": [
						{
							"@type": "PropertyValue",
							"additionalType": 
								"http://dbpedia.org/resource/Coordinate_reference_system",
							"name": "Coordinate Reference System",
							"value": "http://www.opengis.net/def/crs/OGC/1.3/CRS84"
						}
					],
					"geo": generateSchemaOrgGeo(doc.northBoundCoord, 
						doc.eastBoundCoord, 
						doc.southBoundCoord, 
						doc.westBoundCoord),
					"subjectOf": {
						"@type": "CreativeWork",
						"fileFormat": "application/vnd.geo+json",
						"text": generateGeoJSONString(doc.northBoundCoord, 
							doc.eastBoundCoord, 
							doc.southBoundCoord, 
							doc.westBoundCoord)
					}
				}
			}

			if (doc.title && doc.origin) {
				var citationParts = [
					getAuthorText(doc.origin),
				  getYearPublishedText(doc),
					(doc.title || ""),
					(nodeName || ""),
					getCitationIdentifierText(doc, nodeName)];
	
				jsonld.citation = citationParts.join(". ") + ".";
			}

			var head = document.getElementsByTagName("head")[0];
			var script_tag = document.createElement("script");
			script_tag.setAttribute("type", "application/ld+json");
			script_tag.innerHTML = JSON.stringify(jsonld);
			head.appendChild(script_tag);
    };
  };

	var xhrCallbackSolrRequest = function xhrCallbackSolrRequest() {
		var responseJSON = JSON.parse(this.responseText);

		if (!(responseJSON &&
					responseJSON.response &&
					responseJSON.response.docs &&
					Array.isArray(responseJSON.response.docs) &&
					responseJSON.response.docs.length === 1)) {
			return;
		}

		var doc = responseJSON.response.docs[0];

    var xhrNodeRequest = new XMLHttpRequest();
    var xhrCallbackNodeRequest = generateXhrCallbackNodeRequest(doc);
    xhrNodeRequest.addEventListener("load", xhrCallbackNodeRequest);
    xhrNodeRequest.open("GET", "https://cn.dataone.org/cn/v2/node/" + doc.datasource);
    xhrNodeRequest.send();
  };

	var identifier = getIdentifier(window.location.href),
		  solr_query_url = "https://search.dataone.org/cn/v2/query/solr/?fl=" +
		"identifier,seriesId,origin,title,abstract,keywords,attributeName," + 
		"beginDate,endDate,pubDate,datasource,dateUploaded," +
		"northBoundCoord,eastBoundCoord,southBoundCoord,westBoundCoord" + 
		"&wt=json&q=id:\"" + 
		encodeURIComponent(identifier) + 
		"\"+AND+formatType:METADATA";
	
  var xhrSolrRequest = new XMLHttpRequest();
  xhrSolrRequest.addEventListener("load", xhrCallbackSolrRequest);
  xhrSolrRequest.open("GET", solr_query_url);
  xhrSolrRequest.send();
})();

MetacatUI.loadTheme = function(theme) {
    var script = document.createElement("script");
    script.setAttribute("type", "text/javascript");
    script.setAttribute("src", MetacatUI.root + "/js/themes/" + theme + "/config.js?v=" + MetacatUI.metacatUIVersion);
    document.getElementsByTagName("body")[0].appendChild(script);

    script.onload = function(){
	    //If this theme has a custom function to start the app, then use it
	    if(typeof MetacatUI.customInitApp == "function") {
            MetacatUI.customInitApp();
        }
	    //Start the app
	    else MetacatUI.initApp();
    }
}
MetacatUI.initApp = function () {
    var script = document.createElement("script");
    script.setAttribute("data-main", MetacatUI.root + "/js/app.js?v=" + MetacatUI.metacatUIVersion);
    script.src = MetacatUI.root + "/components/require.js";
    document.getElementsByTagName("body")[0].appendChild(script);
}


// Fix compatibility issues with mainly IE 8 and earlier. Do this before the rest of the app loads since even common
// functions are missing, such as console.log
MetacatUI.preventCompatibilityIssues = function(){
	// Detecting IE
	function isIE () {
		  var myNav = navigator.userAgent.toLowerCase();
		  return (myNav.indexOf('msie') != -1) ? parseInt(myNav.split('msie')[1]) : false;
	}
	//If IE 8 or earlier, don't use D3
	if (isIE() && (isIE() < 9)) MetacatUI.useD3 = false;


	/* Add trim() function for IE*/
	if(typeof String.prototype.trim !== 'function') {
		  String.prototype.trim = function() {
		    return this.replace(/^\s+|\s+$/g, '');
		  }
	}

	/* Polyfill for startsWith() - IE 8 and earlier */
	if (!String.prototype.startsWith) {
		  String.prototype.startsWith = function(searchString, position) {
		    position = position || 0;
		    return this.indexOf(searchString, position) === position;
		  };
	}

	/* Polyfill for endsWith() - IE 8 and earlier */
	if (!String.prototype.endsWith) {
		  String.prototype.endsWith = function(searchString, position) {
		      var subjectString = this.toString();
		      if (typeof position !== 'number' || !isFinite(position) || Math.floor(position) !== position || position > subjectString.length) {
		        position = subjectString.length;
		      }
		      position -= searchString.length;
		      var lastIndex = subjectString.indexOf(searchString, position);
		      return lastIndex !== -1 && lastIndex === position;
		  };
	}

	/* POlyfill for Array.isArray() - IE 8 and earlier */
	if (!Array.isArray) {
		  Array.isArray = function(arg) {
		    return Object.prototype.toString.call(arg) === '[object Array]';
		  };
	}

	/**
	 * Protect window.console method calls, e.g. console is not defined on IE
	 * unless dev tools are open, and IE doesn't define console.debug
	 */
	(function() {
	  if (!window.console) {
	    window.console = {};
	  }
	  // union of Chrome, FF, IE, and Safari console methods
	  var m = [
	    "log", "info", "warn", "error", "debug", "trace", "dir", "group",
	    "groupCollapsed", "groupEnd", "time", "timeEnd", "profile", "profileEnd",
	    "dirxml", "assert", "count", "markTimeline", "timeStamp", "clear"
	  ];
	  // define undefined methods as noops to prevent errors
	  for (var i = 0; i < m.length; i++) {
	    if (!window.console[m[i]]) {
	      window.console[m[i]] = function() {};
	    }
	  }
	})();

	//Add a polyfill for the .map() function for arrays for IE 8. Taken from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map
	// Production steps of ECMA-262, Edition 5, 15.4.4.19
	// Reference: http://es5.github.io/#x15.4.4.19
	if (!Array.prototype.map) {

	  Array.prototype.map = function(callback, thisArg) {

	    var T, A, k;

	    if (this == null) {
	      throw new TypeError(" this is null or not defined");
	    }

	    // 1. Let O be the result of calling ToObject passing the |this|
	    //    value as the argument.
	    var O = Object(this);

	    // 2. Let lenValue be the result of calling the Get internal
	    //    method of O with the argument "length".
	    // 3. Let len be ToUint32(lenValue).
	    var len = O.length >>> 0;

	    // 4. If IsCallable(callback) is false, throw a TypeError exception.
	    // See: http://es5.github.com/#x9.11
	    if (typeof callback !== "function") {
	      throw new TypeError(callback + " is not a function");
	    }

	    // 5. If thisArg was supplied, let T be thisArg; else let T be undefined.
	    if (arguments.length > 1) {
	      T = thisArg;
	    }

	    // 6. Let A be a new array created as if by the expression new Array(len)
	    //    where Array is the standard built-in constructor with that name and
	    //    len is the value of len.
	    A = new Array(len);

	    // 7. Let k be 0
	    k = 0;

	    // 8. Repeat, while k < len
	    while (k < len) {

	      var kValue, mappedValue;

	      // a. Let Pk be ToString(k).
	      //   This is implicit for LHS operands of the in operator
	      // b. Let kPresent be the result of calling the HasProperty internal
	      //    method of O with argument Pk.
	      //   This step can be combined with c
	      // c. If kPresent is true, then
	      if (k in O) {

	        // i. Let kValue be the result of calling the Get internal
	        //    method of O with argument Pk.
	        kValue = O[k];

	        // ii. Let mappedValue be the result of calling the Call internal
	        //     method of callback with T as the this value and argument
	        //     list containing kValue, k, and O.
	        mappedValue = callback.call(T, kValue, k, O);

	        // iii. Call the DefineOwnProperty internal method of A with arguments
	        // Pk, Property Descriptor
	        // { Value: mappedValue,
	        //   Writable: true,
	        //   Enumerable: true,
	        //   Configurable: true },
	        // and false.

	        // In browsers that support Object.defineProperty, use the following:
	        // Object.defineProperty(A, k, {
	        //   value: mappedValue,
	        //   writable: true,
	        //   enumerable: true,
	        //   configurable: true
	        // });

	        // For best browser support, use the following:
	        A[k] = mappedValue;
	      }
	      // d. Increase k by 1.
	      k++;
	    }

	    // 9. return A
	    return A;
	  };
	}

	// Polyfill for Array function foreach() - from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach#Polyfill
	// Production steps of ECMA-262, Edition 5, 15.4.4.18
	// Reference: http://es5.github.io/#x15.4.4.18
	if (!Array.prototype.forEach) {

	  Array.prototype.forEach = function(callback, thisArg) {

	    var T, k;

	    if (this == null) {
	      throw new TypeError(' this is null or not defined');
	    }

	    // 1. Let O be the result of calling ToObject passing the |this| value as the argument.
	    var O = Object(this);

	    // 2. Let lenValue be the result of calling the Get internal method of O with the argument "length".
	    // 3. Let len be ToUint32(lenValue).
	    var len = O.length >>> 0;

	    // 4. If IsCallable(callback) is false, throw a TypeError exception.
	    // See: http://es5.github.com/#x9.11
	    if (typeof callback !== "function") {
	      throw new TypeError(callback + ' is not a function');
	    }

	    // 5. If thisArg was supplied, let T be thisArg; else let T be undefined.
	    if (arguments.length > 1) {
	      T = thisArg;
	    }

	    // 6. Let k be 0
	    k = 0;

	    // 7. Repeat, while k < len
	    while (k < len) {

	      var kValue;

	      // a. Let Pk be ToString(k).
	      //   This is implicit for LHS operands of the in operator
	      // b. Let kPresent be the result of calling the HasProperty internal method of O with argument Pk.
	      //   This step can be combined with c
	      // c. If kPresent is true, then
	      if (k in O) {

	        // i. Let kValue be the result of calling the Get internal method of O with argument Pk.
	        kValue = O[k];

	        // ii. Call the Call internal method of callback with T as the this value and
	        // argument list containing kValue, k, and O.
	        callback.call(T, kValue, k, O);
	      }
	      // d. Increase k by 1.
	      k++;
	    }
	    // 8. return undefined
	  };
	}

	// Polyfill for Object.keys()
	// From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/keys
	if (!Object.keys) {
	  Object.keys = (function() {
	    'use strict';
	    var hasOwnProperty = Object.prototype.hasOwnProperty,
	        hasDontEnumBug = !({ toString: null }).propertyIsEnumerable('toString'),
	        dontEnums = [
	          'toString',
	          'toLocaleString',
	          'valueOf',
	          'hasOwnProperty',
	          'isPrototypeOf',
	          'propertyIsEnumerable',
	          'constructor'
	        ],
	        dontEnumsLength = dontEnums.length;

	    return function(obj) {
	      if (typeof obj !== 'object' && (typeof obj !== 'function' || obj === null)) {
	        throw new TypeError('Object.keys called on non-object');
	      }

	      var result = [], prop, i;

	      for (prop in obj) {
	        if (hasOwnProperty.call(obj, prop)) {
	          result.push(prop);
	        }
	      }

	      if (hasDontEnumBug) {
	        for (i = 0; i < dontEnumsLength; i++) {
	          if (hasOwnProperty.call(obj, dontEnums[i])) {
	            result.push(dontEnums[i]);
	          }
	        }
	      }
	      return result;
	    };
	  }());
	}

    // Polyfill for Array.indexOf
    // Taken from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/indexOf#Polyfill
    // Production steps of ECMA-262, Edition 5, 15.4.4.14
    // Reference: http://es5.github.io/#x15.4.4.14
    if (!Array.prototype.indexOf) {
      Array.prototype.indexOf = function(searchElement, fromIndex) {

        var k;

        // 1. Let o be the result of calling ToObject passing
        //    the this value as the argument.
        if (this == null) {
          throw new TypeError('"this" is null or not defined');
        }

        var o = Object(this);

        // 2. Let lenValue be the result of calling the Get
        //    internal method of o with the argument "length".
        // 3. Let len be ToUint32(lenValue).
        var len = o.length >>> 0;

        // 4. If len is 0, return -1.
        if (len === 0) {
          return -1;
        }

        // 5. If argument fromIndex was passed let n be
        //    ToInteger(fromIndex); else let n be 0.
        var n = fromIndex | 0;

        // 6. If n >= len, return -1.
        if (n >= len) {
          return -1;
        }

        // 7. If n >= 0, then Let k be n.
        // 8. Else, n<0, Let k be len - abs(n).
        //    If k is less than 0, then let k be 0.
        k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);

        // 9. Repeat, while k < len
        while (k < len) {
          // a. Let Pk be ToString(k).
          //   This is implicit for LHS operands of the in operator
          // b. Let kPresent be the result of calling the
          //    HasProperty internal method of o with argument Pk.
          //   This step can be combined with c
          // c. If kPresent is true, then
          //    i.  Let elementK be the result of calling the Get
          //        internal method of o with the argument ToString(k).
          //   ii.  Let same be the result of applying the
          //        Strict Equality Comparison Algorithm to
          //        searchElement and elementK.
          //  iii.  If same is true, return k.
          if (k in o && o[k] === searchElement) {
            return k;
          }
          k++;
        }
        return -1;
      };
    }
}

if (typeof Object.assign != 'function') {
  // Must be writable: true, enumerable: false, configurable: true
  Object.defineProperty(Object, "assign", {
    value: function assign(target, varArgs) { // .length of function is 2
      'use strict';
      if (target == null) { // TypeError if undefined or null
        throw new TypeError('Cannot convert undefined or null to object');
      }

      var to = Object(target);

      for (var index = 1; index < arguments.length; index++) {
        var nextSource = arguments[index];

        if (nextSource != null) { // Skip over if undefined or null
          for (var nextKey in nextSource) {
            // Avoid bugs when hasOwnProperty is shadowed
            if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
              to[nextKey] = nextSource[nextKey];
            }
          }
        }
      }
      return to;
    },
    writable: true,
    configurable: true
  });
}

MetacatUI.preventCompatibilityIssues();
MetacatUI.loadTheme(MetacatUI.theme);
