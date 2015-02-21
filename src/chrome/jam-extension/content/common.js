
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
	showDialog('policyedit.xul');
}

function doToggle() {
  dump('girdle\n');
}

