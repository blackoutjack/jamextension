
Components.utils.import("chrome://jam-extension/content/log4moz.js");

let formatter = new Log4Moz.BasicFormatter();
let root = Log4Moz.repository.rootLogger;
let logFile = this.getLocalDirectory(); // remember this?
let appender;

logFile.append("log.txt");

// Loggers are hierarchical, lowering this log level will affect all
// output.
root.level = Log4Moz.Level["All"];

// this appender will log to the file system.
appender = new Log4Moz.RotatingFileAppender(logFile, formatter);
appender.level = Log4Moz.Level["All"];
root.addAppender(appender);

var logger = Log4Moz.repository.getLogger("common");
logger.level = Log4Moz.Level["All"];

var enabled = false;

var wpl = Components.interfaces.nsIWebProgressListener;
var wplFlags = { //nsIWebProgressListener state transition flags
    STATE_START: wpl.STATE_START,
    STATE_STOP: wpl.STATE_STOP,
    STATE_REDIRECTING: wpl.STATE_REDIRECTING,
    STATE_TRANSFERRING: wpl.STATE_TRANSFERRING,
    STATE_NEGOTIATING: wpl.STATE_NEGOTIATING,
    STATE_IS_REQUEST: wpl.STATE_IS_REQUEST,
    STATE_IS_DOCUMENT: wpl.STATE_IS_DOCUMENT,
    STATE_IS_NETWORK: wpl.STATE_IS_NETWORK,
    STATE_RESTORING: wpl.STATE_RESTORING,
    LOCATION_CHANGE_SAME_DOCUMENT: wpl.LOCATION_CHANGE_SAME_DOCUMENT,
    LOCATION_CHANGE_ERROR_PAGE: wpl.LOCATION_CHANGE_ERROR_PAGE,
};
function flagString(aFlag) {
  var ret = undefined;
  for (var f in wplFlags) {
    if (wplFlags[f] & aFlag) {
      if (ret === undefined) {
        ret = f;
      } else {
        ret += '|' + f;
      }
    }
  }
  if (ret === undefined) {
    return aFlag + ' (unknown)';
  }
  return aFlag + ' (' + ret + ')';
}

function loadFromFile(filename, obj, propId) {
  let path = getLocalDirectory();
  path.append(filename);
  logger.info('Loading file ' + path.path);
  
  if (path.exists()) {
    NetUtil.asyncFetch(path, function(inputStream, status) {
      if (!Components.isSuccessCode(status)) {
        // Handle error!
        logger.error('Unable to open policy file: ' + path.path);
        return;
      }

      // The file data is contained within inputStream.
      // You can read it into a string with
      var data = NetUtil.readInputStreamToString(inputStream, inputStream.available());
      obj[propId] = data;
    });
  } else {
    obj[propId] = null;
  }
}

var jaminfo = {
  policy: undefined,
  library: undefined,
  // %%% Hard-coded for now
  introspector: 'JAM.policy.pFull',
}

function insertScripts(doc) {
  var head = doc.head;
  if (head) {
    var pol = undefined;
    if (jaminfo.policy !== null) {
      if (jaminfo.policy === undefined) {
        // %%% Should wait if undefined!
        logger.warn('Policy not loaded!');
      } else {
        pol = doc.createElement('script');
        pol.type = 'text/javascript';
        pol.textContent = jaminfo.policy;
      }
    }

    var lib = undefined
    if (jaminfo.library !== null) {
      if (jaminfo.library === undefined) {
        // %%% Should wait if undefined!
        logger.warn('Library not loaded!');
      } else {
        lib = doc.createElement('script');
        lib.type = 'text/javascript';
        lib.textContent = jaminfo.library;
      }
    }

    var ispect = undefined;
    if (jaminfo.introspector !== null) {
      if (jaminfo.introspector === undefined) {
        // %%% Should wait if undefined!
        logger.warn('Introspector not loaded!');
      } else {
        var itxt = 'JAM.setDynamicIntrospector(' + jaminfo.introspector + ');';
        ispect = doc.createElement('script');
        ispect.type = 'text/javascript';
        ispect.textContent = itxt;
      }
    }
    
    logger.info('HEAD BEFORE: ' + head.innerHTML);
    var scripts = head.getElementsByTagName('script');
    if (scripts.length > 0) {
      var first = scripts[0];
      if (pol !== undefined)
        head.insertBefore(pol, first);
      if (lib !== undefined)
        head.insertBefore(lib, first);
      if (ispect !== undefined)
        head.insertBefore(ispect, first);
    } else {
      if (pol !== undefined)
        head.appendChild(pol);
      if (lib !== undefined)
        head.appendChild(lib);
      if (ispect !== undefined)
        head.appendChild(ispect);
    }

    logger.info('HEAD AFTER: ' + head.innerHTML);
  } else {
    logger.warn('No head available');
  }
}

function writeScripts(doc) {
  var pol = undefined;
  if (jaminfo.policy !== null) {
    if (jaminfo.policy === undefined) {
      // %%% Should wait if undefined!
      logger.warn('Policy not loaded!');
    } else {
      pol = doc.createElement('script');
      pol.type = 'text/javascript';
      pol.textContent = jaminfo.policy;
      doc.write(pol.outerHTML);
    }
  }

  var lib = undefined
  if (jaminfo.library !== null) {
    if (jaminfo.library === undefined) {
      // %%% Should wait if undefined!
      logger.warn('Library not loaded!');
    } else {
      lib = doc.createElement('script');
      lib.type = 'text/javascript';
      lib.textContent = jaminfo.library;
      doc.write(lib.outerHTML);
    }
  }

  var ispect = undefined;
  if (jaminfo.introspector !== null) {
    if (jaminfo.introspector === undefined) {
      // %%% Should wait if undefined!
      logger.warn('Introspector not loaded!');
    } else {
      var itxt = 'alert("goober");JAM.setDynamicIntrospector(' + jaminfo.introspector + ');';
      ispect = doc.createElement('script');
      ispect.type = 'text/javascript';
      ispect.textContent = itxt;
      doc.write(ispect.outerHTML);
    }
  }
}

var myListener = {
    QueryInterface: XPCOMUtils.generateQI(["nsIWebProgressListener", "nsISupportsWeakReference"]),

    onStateChange: function(aWebProgress, aRequest, aFlag, aStatus) {
      // If you use myListener for more than one tab/window, use
      // aWebProgress.DOMWindow to obtain the tab/window which triggers the state change
      var win = aWebProgress.DOMWindow;
      logger.info('StateChange: aFlag=' + flagString(aFlag) + ', aRequest=' + aRequest.name + ', aStatus=' + aStatus + ' win: ' + win);
      if ((aFlag & wpl.STATE_TRANSFERRING) && (aFlag & wpl.STATE_IS_REQUEST) && (aFlag & wpl.STATE_IS_DOCUMENT)) {
        // iframes are transitively handled by other mechanisms.
        if (win && win === win.top) {
          Services.scriptloader.loadSubScript('chrome://jam-extension/content/policy.js', win, 'UTF-8');
          Services.scriptloader.loadSubScript('chrome://jam-extension/content/libTx.js', win, 'UTF-8');
          logger.info("LOADUNED");
        } else {
          logger.warn('No window available');
        }
      }
    },

    onLocationChange: function(aProgress, aRequest, aURI, aFlag) {
      // This fires when the location bar changes; that is load event is confirmed
      // or when the user switches tabs. If you use myListener for more than one tab/window,
      // use aProgress.DOMWindow to obtain the tab/window which triggered the change.
      logger.info('LocationChange: aFlag=' + flagString(aFlag) + ', aRequest=' + aRequest.name + ', aURI=' + aURI.spec);
    },

    // For definitions of the remaining functions see related documentation
    onProgressChange: function(aWebProgress, aRequest, curSelf, maxSelf, curTot, maxTot) {
      logger.info('ProgressChange: aRequest=' + aRequest.name + ', curSelf=' + curSelf + ', maxSelf=' + maxSelf + ', curTot=' + curTot + ', maxTot=' + maxTot);
      /*
      var win = aWebProgress.DOMWindow;
      // iframes are transitively handled by other mechanisms.
      if (win && win === win.top) {
        Services.scriptloader.loadSubScript('chrome://jam-extension/content/policy.js', win, 'UTF-8');
        Services.scriptloader.loadSubScript('chrome://jam-extension/content/libTx.js', win, 'UTF-8');
        logger.info("LOADEDED");
      } else {
        logger.warn('No window available');
      }
      */
    },

    onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage) {
      logger.info('StatusChange: aStatus=' + aStatus + ', aRequest=' + aRequest.name + ', aMessage=' + aMessage);
    },

    onSecurityChange: function(aWebProgress, aRequest, aState) {
      logger.info('SecurityChange: aRequest=' + aRequest.name + ', aState=' + aState);
    },

}

function getLocalDirectory() {
  let directoryService =
    Components.classes["@mozilla.org/file/directory_service;1"].
      getService(Components.interfaces.nsIProperties);
  // this is a reference to the profile dir (ProfD) now.
  let localDir = directoryService.get("ProfD", Components.interfaces.nsIFile);

  localDir.append("jam-extension");

  if (!localDir.exists() || !localDir.isDirectory()) {
    // read and write permissions to owner and group, read-only for others.
    localDir.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0774);
  }

  return localDir;
}

function doHttpRequest(script,data) {
	debugln('-------------------');
	debugln('request to: ' + script);
	debugln('      data: ' + data);

	data = data + '';
	
	var req = new XMLHttpRequest();
	req.open('POST', script, false );
	req.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
	req.setRequestHeader('Content-Length', data.length);
	req.send(data);
	
	debugln('  response: ' + req.responseText);
	
	return req.responseText;
}

function xmldecode(val) {
	val = val.replace(/&quot;/ig, "'");
	val = val.replace(/&lt;/ig, "<");
	val = val.replace(/&gt;/ig, ">");
	val = val.replace(/&amp;/ig, "&");
	return val;
}

function plaintextencode(val) {
    val = val.replace(/&/ig, "&amp;");
    val = val.replace(/</ig, "&lt;");
    val = val.replace(/>/ig, "&gt;");
    val = val.replace(/\x22/ig, "&quot;");
    val = val.replace(/\n/ig, "<br>");
    val = val.replace(/\r/ig, "");
    return val;
}

function doPolicy() {
  jaminfo.policy = undefined;
  jaminfo.library = undefined;
	showDialog('policyedit.xul');
  loadFromFile('policy.js', jaminfo, 'policy');
  loadFromFile('libTx.js', jaminfo, 'library');
}

function browserListen(browser) {
  browser.webProgress.addProgressListener(myListener, browser.webProgress.NOTIFY_ALL);
}

function browserForget(browser) {
  browser.webProgress.removeProgressListener(myListener);
}

function tabListen(ev) {
  var browser = ev.target;
  browserListen(browser);
}

function tabForget(browser) {
  var browser = ev.target;
  browserForget(browser);
}

function doToggle() {
  var chk = document.getElementById('chkOnOff');
  var val = chk.checked;
  if (val) {
    enabled = true;
    //gBrowser.addProgressListener(myListener);
    gBrowser.browsers.forEach(function (browser) {
      browserListen(browser);
    });
    if (jaminfo.policy === undefined) {
      loadFromFile('policy.js', jaminfo, 'policy');
    }
    if (jaminfo.library === undefined) {
      loadFromFile('libTx.js', jaminfo, 'library');
    }
  } else {
    enabled = false;
    //gBrowser.removeProgressListener(myListener);
    gBrowser.browsers.forEach(function (browser) {
      browserForget(browser);
    });
  }
  logger.info('Toggled: ' + val);
}
gBrowser.tabContainer.addEventListener("TabOpen", tabListen, false);
gBrowser.tabContainer.addEventListener("TabClose", tabForget, false);


