var policy = function() {
  var _Window_prototype_open = window.open;
  var _Window_prototype_openDialog = window.openDialog;
  var _Window_prototype_alert = window.alert;
  var _Window_prototype_confirm = window.confirm;
  var _HTMLDocument_prototype_createElement = HTMLDocument.prototype.createElement;
  var _RegExp_prototype_test = RegExp.prototype.test;
  var __RegExp_prototype_test_call_bind__RegExp_prototype_test_ = _RegExp_prototype_test.call.bind(_RegExp_prototype_test);
  var _HTMLDocument_prototype_createElementNS = HTMLDocument.prototype.createElementNS;
  function pFull(tx) {
    var commit = true;
    var as = tx.getCallSequence();
    var len = as.length;
    for (var i = 0;i < len;i++) {
      var node = as[i];
      if (JAM.identical(node.value, _Window_prototype_open) || JAM.identical(node.value, _Window_prototype_openDialog) || JAM.identical(node.value, _Window_prototype_alert) || JAM.identical(node.value, _Window_prototype_confirm) || JAM.identical(node.value, _HTMLDocument_prototype_createElement) && (node.argc > 0 && __RegExp_prototype_test_call_bind__RegExp_prototype_test_(/^iframe$/i, node.args[0])) || JAM.identical(node.value, _HTMLDocument_prototype_createElementNS) && (node.argc > 0 && __RegExp_prototype_test_call_bind__RegExp_prototype_test_(/^iframe$/i, 
      node.args[0]))) {
        commit = false;
        break;
      }
    }
    if (commit) {
      JAM.process(tx);
    } else {
      JAM.prevent(tx);
    }
  }
  pFull.subsumedBy = pFull;
  pFull.itype = "invoke";
  Object.freeze(pFull);
  return {pFull:pFull};
}()
