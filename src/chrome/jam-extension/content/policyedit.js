
Components.utils.import("resource://gre/modules/NetUtil.jsm");
Components.utils.import("resource://gre/modules/FileUtils.jsm");

var _logger = Log4Moz.repository.getLogger("policyedit");
_logger.level = Log4Moz.Level["All"];

var needsSave = false;

function initField(fieldId, data) {
  var polfield = document.getElementById(fieldId);
  polfield.value = data;
  polfield.disabled = false;
}

function saveFile(filename, data) {
  let path = getLocalDirectory();
  path.append(filename);
  _logger.info('Saving file ' + path.path);

  // You can also optionally pass a flags parameter here. It defaults to
  // FileUtils.MODE_WRONLY | FileUtils.MODE_CREATE | FileUtils.MODE_TRUNCATE;
  var ostream = FileUtils.openSafeFileOutputStream(path);

  var converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
  converter.charset = "UTF-8";
  var istream = converter.convertToInputStream(data);

  // The last argument (the callback) is optional.
  NetUtil.asyncCopy(istream, ostream, function(status) {
    if (!Components.isSuccessCode(status)) {
      // Handle error!
      _logger.error('Unable to save file: ' + path.path);
      return;
    }

    // Data has been written to the file.
    needsSave = false;
  });
}

function loadFile(filename, fieldId) {
  let path = getLocalDirectory();
  path.append(filename);
  _logger.info('Loading file ' + path.path);
  
  if (path.exists()) {
    NetUtil.asyncFetch(path, function(inputStream, status) {
      if (!Components.isSuccessCode(status)) {
        // Handle error!
        _logger.error('Unable to open policy file: ' + path.path);
        return;
      }

      // The file data is contained within inputStream.
      // You can read it into a string with
      var data = NetUtil.readInputStreamToString(inputStream, inputStream.available());
      initField(fieldId, data);
    });
  } else {
    initField(fieldId, '');
  }
}

function onChange() {
  needsSave = true;
}

function onLoad() {
  loadFile('policy.js', 'txtPolicy');
  loadFile('libTx.js', 'txtLibrary');
}

function onSave() {
  var poldata = document.getElementById('txtPolicy').value; 
  saveFile('policy.js', poldata);

  var libdata = document.getElementById('txtLibrary').value; 
  saveFile('libTx.js', libdata);
}

function onClose() {
  var ok = true;
  if (needsSave) {
    ok = window.confirm('Data has not been saved, really close?');
  }
  if (ok) window.close();
}

