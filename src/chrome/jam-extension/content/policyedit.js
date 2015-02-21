
Components.utils.import("resource://gre/modules/NetUtil.jsm");
Components.utils.import("resource://gre/modules/FileUtils.jsm");

var _logger = Log4Moz.repository.getLogger("policyedit");
_logger.level = Log4Moz.Level["All"];

function setPolicy(data) {
  var polfield = document.getElementById('txtPolicy');
  polfield.value = data;
  polfield.disabled = false;
}

function onLoad() {
  let polpath = getLocalDirectory();
  polpath.append("policy.js");
  dump('policy: ' + polpath.path + '\n');
  _logger.info('Loading policy: ' + polpath.path);
  
  if (polpath.exists()) {
    NetUtil.asyncFetch(polpath, function(inputStream, status) {
      if (!Components.isSuccessCode(status)) {
        // Handle error!
        _logger.error('Unable to open policy file: ' + polpath.path);
        return;
      }

      // The file data is contained within inputStream.
      // You can read it into a string with
      var data = NetUtil.readInputStreamToString(inputStream, inputStream.available());
      setPolicy(data);
    });
  } else {
    setPolicy('');
  }
}

function onSave() {
  let polpath = getLocalDirectory();
  polpath.append("policy.js");
  dump('policy: ' + polpath.path + '\n');
  _logger.info('Saving policy: ' + polpath.path);
  
  // file is nsIFile, data is a string
  var data = document.getElementById('txtPolicy').value; 

  // You can also optionally pass a flags parameter here. It defaults to
  // FileUtils.MODE_WRONLY | FileUtils.MODE_CREATE | FileUtils.MODE_TRUNCATE;
  var ostream = FileUtils.openSafeFileOutputStream(polpath);

  var converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
  converter.charset = "UTF-8";
  var istream = converter.convertToInputStream(data);

  // The last argument (the callback) is optional.
  NetUtil.asyncCopy(istream, ostream, function(status) {
    if (!Components.isSuccessCode(status)) {
      // Handle error!
      _logger.error('Unable to save policy file: ' + polpath.path);
      return;
    }

    // Data has been written to the file.
  });
}

function onClose() {
  window.close();
}

