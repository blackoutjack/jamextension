var policy = function() {
  var _Location_prototype_reload = Location.prototype.reload;
  var _Location_prototype_replace = Location.prototype.replace;
  var _Location_prototype_assign = Location.prototype.assign;
  var _Window = Window;
  var _Location = Location;
  function pFull(tx) {
    var commit = true;
    var as = tx.getActionSequence();
    var len = as.length;
    for (var i = 0;i < len;i++) {
      var node = as[i];
      if ((node.type === "call" || node.type === "construct") && (JAM.identical(node.value, _Location_prototype_reload) || JAM.identical(node.value, _Location_prototype_replace) || JAM.identical(node.value, _Location_prototype_assign))) {
        commit = false;
        break;
      }
      if (node.type === "write" && (node.id === "location" && JAM.instanceof(node.obj, _Window) || true && JAM.instanceof(node.obj, _Location))) {
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
  Object.freeze(pFull);
  return {pFull:pFull};
}()