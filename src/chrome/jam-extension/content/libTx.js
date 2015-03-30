// We assume that first, some policy.js has been included in a script
// tag in the HTML page, and then this file, followed by all others.

const PERFORMANCE_TESTING = false;
const DEFAULT_ALLOW = false;
const MIMIC = false;

// Allow testing scripts with |alert| in the JS shell.
if (typeof alert === "undefined" && typeof print === "function") {
  alert = print;
}

// If no policy is provided, use a default. It either allows or
// disallows everything, based on DEFAULT_ALLOW.
if (typeof policy !== "object") {
  // See file txjs/policy.template.js for documentation of the format
  // of policy objects.
  var policy = (function () {
    return {
      pFull: function (tx) {
        if (DEFAULT_ALLOW) {
          JAM.process(tx);
        } else {
          JAM.prevent(tx);
        }
      },
    }
  }());
}

// Define the JAM property to be read-only.
Object.defineProperty(this, 'JAM', { 'value': (function() {

  var pFull = policy.pFull;

  // Close over some native values and objects that may be needed.
  var _global = this;
  var _undefined = undefined;
  var _eval = eval;
  var _Function = Function;
  var _bind = Function.prototype.bind;
  var _apply = Function.prototype.apply;
  var _call = Function.prototype.call;
  var _bind_apply = _apply.bind(_bind);
  var _apply_apply = _apply.bind(_apply);
  var _Array_slice = Array.slice;
  var _String_startsWith = String.startsWith;

  var _Array_prototype_sort = Array.prototype.sort;
  var _String_prototype_replace = String.prototype.replace;

  if (typeof Object.prototype.__defineGetter__ !== "undefined")
    var ___defineGetter__ = Object.prototype.__defineGetter__;
  if (typeof Object.prototype.__defineSetter__ !== "undefined")
    var ___defineSetter__ = Object.prototype.__defineSetter__;
  if (typeof Object.defineProperty !== "undefined")
    var _defineProperty = Object.defineProperty;
  if (typeof setTimeout !== "undefined") {
    var _setTimeout = setTimeout;
    var _setInterval = setInterval;
    var _clearInterval = clearInterval;
  }

  if (typeof document === "object") {
    // Close over |document| methods needed by instrumentation.

    // These are to test for equality.
    var _document = document;
    var _HTMLDocument_prototype_write = HTMLDocument.prototype.write;
    var _HTMLDocument_prototype_writeln = HTMLDocument.prototype.writeln; 
    var _HTMLElement = HTMLElement;
    var _HTMLScriptElement = HTMLScriptElement;
    var _HTMLIFrameElement = HTMLIFrameElement;

    // These are to call for effect from within methods.
    var _document_getElementById = document.getElementById.bind(_document);
    var _document_createElement = document.createElement.bind(_document);
  }

  if (typeof console === "object")
    var _console = console;
  if (typeof alert === "function")
    var _alert = alert;

  function recursiveWrap(frag) {
    var children = frag.childNodes;
    for (var i=0; i<children.length; i++) {
      var c = children.item(i);
      if (c.tagName === "SCRIPT") {
        c.innerHTML = "introspect(JAM.policy.pFull) { " + c.innerHTML + " }";
      }
      // Find all "on..." attributes.
      if (c.attributes) {
        for (var a=0; a<c.attributes.length; a++) { 
          var attr = c.attributes[a];
          if (_String_startsWith(attr.localName, "on")) {
            attr.value = "introspect(JAM.policy.pFull) { " + attr.value + " }";
          }
        }
      }
      recursiveWrap(c);
    }
  }

  // Wrap the given function |fn| in a transaction and an outer
  // function. In this way, when untrusted guest code that registers
  // event introspectors we can innocculate that also.
  //
  // given:
  //   ispect  An introspector to apply
  //   fn  A function to wrap in a transaction
  //   rec  An optional receiver (for event handlers)
  // return:
  //   The wrapper function, that when called, initiates a transaction
  //     and then calls the original |fn|.
  function wrapFunction(hdlr, fn, rec) {
    rec = rec ? rec : null;
    var txfn = function() {
      // |arguments| will be whatever arguments are provided to |txfn|
      // when it is called. So if we're wrapping an event handler,
      // that will typically be the event object.
      var args = _Array_slice(arguments, 0);
      var ret;
      introspect(hdlr) {
        ret = _apply_apply(fn, [rec, args]);
      }
      return ret;
    };
    return txfn;
  }

  function wrapMethod(hdlr, meth) {
    var txmeth = function() {
      var rec = this;
      // |arguments| will be whatever arguments are provided to |txmeth|
      // when it is called.
      var args = _Array_slice(arguments, 0);
      var ret;
      introspect(hdlr) {
        ret = _apply_apply(meth, [rec, args]);
      }
      return ret;
    };
    return txmeth;
  }

  function wrapHTMLEventScript(elt, html) {
    if (JAM.instanceof(elt, _HTMLElement)) {
      var frag = _document_createElement(elt.tagName);
      frag.innerHTML = html;
      recursiveWrap(frag);
      var wrapped = frag.innerHTML;
    }
    return frag.innerHTML;
  }

  function commitSuspendFine(tx) {

    // Get the cause of the suspend.
    var sx = tx.getSuspendInfo();
    if (!sx) return;

    var type = sx.type;

    var ret;
    if (type === "write") {
      // Get the receiver of the write.
      var obj = sx.obj;
      // Transaction suspensions caused by assignment to a property.
      var value = sx.value;
      ret = value;
      // Get the property name that was accessed.
      var id = sx.id;

      if (_String_startsWith(id, "on")) {
        // Wrap event handlers in transaction blocks.
        var typ = typeof value;
        if (JAM.isNativeFunction(value)) {
          value = wrapFunction(pFull, value, obj);
        } else if (typ === "string") {
          value = "introspect(JAM.policy.pFull) { " + value + " }";
        }
      } else if (id === "outerHTML") {
        // Writing to |outerHTML| replaces the node altogether, so the
        // action is irrespective of the element type.
        // %%% Can |outerHTML| be used like |document.write| to
        // %%% incrementally create elements?
        value = wrapHTMLEventScript(obj, value);
      } else if (JAM.instanceof(obj, _HTMLScriptElement)) {
        if (id === "textContent" || id === "innerHTML") {
          value = "introspect(JAM.policy.pFull) { " + value + " };";
        }
      } else if (id === "innerHTML") {
        // Dig down into other element types to find scripts.
        value = wrapHTMLEventScript(obj, value);
      }
      obj[id] = value;

      // Set the return value to the *original* value.
      tx.setRetval(ret);

    } else if (type === "call") {
      // Transaction suspensions caused by call to a function.

      // Get the receiver of the call.
      var obj = sx.obj;
      // Get the function that triggered the suspend.
      var fun = sx.value;
      // And the arguments.
      var args = sx.args;
      var len = sx.argc;

      // Mark this false if special invocation is done in place.
      var invoke = true;
      if (len > 0) {
        if (JAM.identical(fun, _Array_prototype_sort)) {
          // Array.prototype.sort may invoke a user-provided
          // comparison function.
          if (JAM.isNativeFunction(args[0])) {
            args[0] = wrapMethod(pFull, args[0]);
          }
        } else if (JAM.identical(fun, _setTimeout) || JAM.identical(fun, _setInterval)) {
          if (JAM.isNativeFunction(args[0])) {
            args[0] = wrapMethod(pFull, args[0]);
          }
        } else if (JAM.identical(fun, _Function)) {
          // %%% What happens in non-string cases?
          ret = _apply_apply(fun, [obj, args]);
          if (typeof ret === "function") {
            ret = wrapMethod(pFull, ret)
          }
          invoke = false;
        } else if (JAM.identical(fun, _eval)) {
          // Given that the callsite transformation will handle all
          // direct calls to |eval|, we can assume this is indirect.
          // %%% What about the modular case?

          // Per MDN, SpiderMonkey no longer supports |eval| with
          // more than 1 argument.
          // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval
          JAM.setDynamicIntrospector(pFull);
          ret = _apply_apply(fun, [obj, args]);
          JAM.setDynamicIntrospector();
          invoke = false;
        } else if (JAM.identical(fun, _HTMLDocument_prototype_write) || JAM.identical(fun, _HTMLDocument_prototype_writeln)) {
          JAM.setDynamicIntrospector(pFull);
          ret = _apply_apply(fun, [obj, args]);
          JAM.setDynamicIntrospector();
          invoke = false;
        } else if (fun.name === "appendChild" || fun.name === "replaceChild" || fun.name === "insertBefore" || fun.name === "setAttribute" || fun.name === "setAttributeNode") {
          // For |appendChild|, |replaceChild| and |insertBefore|,
          // the first argument is the element to be inserted.
          JAM.setDynamicIntrospector(pFull);
          ret = _apply_apply(fun, [obj, args]);
          JAM.setDynamicIntrospector();
          invoke = false;
        }
        
        if (len > 1) {
          if (JAM.identical(fun, _String_prototype_replace)) {
            // String.prototype.replace may invoke a user-provided
            // replacement-generator function.
            if (JAM.isNativeFunction(args[1])) {
              args[1] = wrapMethod(pFull, args[1]);
            }
          } else if (fun.name === "addEventListener") {
            // For |addEventListener|, the first argument is the type
            // of event and the second (index 1) is the event handler.
            // There may be optional further arguments.
            // %%% What if the second argument is an |EventListener|
            // %%% rather than a simple |Function|?
            if (JAM.isNativeFunction(args[1])) {
              args[1] = wrapMethod(pFull, args[1]);
            }
          } else if (fun.name === "removeEventListener" || JAM.identical(fun, _clearInterval)) {
            // The second argument must specify the |Function| or
            // |EventListener| to remove, so we need to maintain a
            // mapping from the "original" functions to their
            // wrapped version. The latter is the value to pass as
            // second argument, if it exists in the mapping. If not,
            // use the passed argument (which should cover the case
            // in which the user retrieves the current event handler
            // and requests that it be removed, as opposed to
            // requesting that a reference to the original, unwrapped
            // function value be removed.
            // %%% Implement mapping described above.
          } else if (JAM.identical(fun, ___defineGetter__) || JAM.identical(fun, ___defineSetter__)) {
            // Wrap the native function in a comprehensive transaction.
            if (JAM.isNativeFunction(args[1])) {
              args[1] = wrapMethod(pFull, args[1]);
            }
          } else if (len > 2) {
            if (JAM.identical(fun, _defineProperty)) {
              // Wrap the getter/setter function in a comprehensive transaction.
              var o = args[2];
              if (JAM.isNativeFunction(o.set)) {
                o.set = wrapMethod(pFull, o.set);
              }
              if (JAM.isNativeFunction(o.get)) {
                o.get = wrapMethod(pFull, o.get);
              }
            }
          }
        }
      }

      if (invoke) ret = _apply_apply(fun, [obj, args]);

      // Set the return value.
      tx.setRetval(ret);
    } else if (type === "new") {
      var c = sx.value;
      var args = sx.args;
      var len = args.length;

      if (len > 0) {
        if (JAM.identical(c, _Function)) {
            args[len-1] = "introspect(JAM.policy.pFull) {" + args[len-1] + "}";
        }
      }

      ret = JAM.newApply(c, args);
      tx.setRetval(ret);
    } else if (type === "forin") {
      // Transaction suspensions caused by entering a for-in loop.

      // Do nothing, we just rely on the commit to sync the state
      // of the transaction with the heap.
    } else if (type === "read") {
      // Get the receiver of the read.
      var obj = sx.obj;
      var id = sx.id;
      // %%% May need to wrap a user-defined getter in a tx.
      ret = obj[id];
      tx.setRetval(ret);
    } else {
      // Other suspension types.
      // %%% May need to handle these in the future.
      alert("Unhandled suspend type: " + type);
    }

    return;
  }

  function commitSuspendCoarse(tx) {

    // Get the cause of the suspend.
    var sx = tx.getSuspendInfo();
    if (!sx) return;

    var type = sx.type;

    var ret;
    if (type === "write") {
      // Get the receiver of the write.
      var obj = sx.obj;
      // Transaction suspensions caused by assignment to a property.
      var value = sx.value;
      ret = value;
      // Get the property name that was accessed.
      var id = sx.id;

      if (_String_startsWith(id, "on")) {
        // Wrap event handlers in transaction blocks.
        var typ = typeof value;
        if (typ === "function") {
          value = wrapFunction(pFull, value, obj);
        } else if (typ === "string") {
          value = "introspect(JAM.policy.pFull) { " + value + " }";
        }
      } else if (id === "outerHTML") {
        // Writing to |outerHTML| replaces the node altogether, so the
        // action is irrespective of the element type.
        // %%% Can |outerHTML| be used like |document.write| to
        // %%% incrementally create elements?
        value = wrapHTMLEventScript(obj, value);
      } else if (JAM.instanceof(obj, _HTMLScriptElement)) {
        if (id === "textContent" || id === "innerHTML") {
          value = "introspect(JAM.policy.pFull) { " + value + " };";
        }
      } else if (id === "innerHTML") {
        // Dig down into other element types to find scripts.
        value = wrapHTMLEventScript(obj, value);
      }
      obj[id] = value;

      // Set the return value to the *original* value.
      tx.setRetval(ret);

    } else if (type === "call") {
      // Transaction suspensions caused by call to a function.

      // Get the receiver of the call.
      var obj = sx.obj;
      // Get the function that triggered the suspend.
      var fun = sx.value;
      // And the arguments.
      var args = sx.args;
      var len = sx.argc;

      // Mark this false if special invocation is done in place.
      var invoke = true;
      if (len > 0) {
        var fname = fun.name;
        if (JAM.identical(fun, _Array_prototype_sort)) {
          // Array.prototype.sort may invoke a user-provided
          // comparison function.
          args[0] = wrapMethod(pFull, args[0]);
        } else if (JAM.identical(fun, _setTimeout) || JAM.identical(fun, _setInterval)) {
          // %%% Currently assumes args[0] is a function object
          args[0] = wrapMethod(pFull, args[0]);
        } else if (JAM.identical(fun, _Function)) {
          // %%% What happens in non-string cases?
          ret = _apply_apply(fun, [obj, args]);
          if (typeof ret === "function") {
            ret = wrapMethod(pFull, ret)
          }
          invoke = false;
        } else if (JAM.identical(fun, _eval)) {
          // Given that the callsite transformation will handle all
          // direct calls to |eval|, we can assume this is indirect.
          // %%% What about the modular case?

          // Per MDN, SpiderMonkey no longer supports |eval| with
          // more than 1 argument.
          // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval
          JAM.setDynamicIntrospector(pFull);
          ret = _apply_apply(fun, [obj, args]);
          JAM.setDynamicIntrospector();
          invoke = false;
        } else if (JAM.identical(fun, _HTMLDocument_prototype_write) || JAM.identical(fun, _HTMLDocument_prototype_writeln)) {
          JAM.setDynamicIntrospector(pFull);
          ret = _apply_apply(fun, [obj, args]);
          JAM.setDynamicIntrospector();
          invoke = false;
        } else if (fname === "appendChild" || fname === "replaceChild" || fname === "insertBefore" || fname === "setAttribute" || fname === "setAttributeNode") {
          // For |appendChild|, |replaceChild| and |insertBefore|,
          // the first argument is the element to be inserted.
          JAM.setDynamicIntrospector(pFull);
          ret = _apply_apply(fun, [obj, args]);
          JAM.setDynamicIntrospector();
          invoke = false;
        }
        
        if (len > 1) {
          if (JAM.identical(fun, _String_prototype_replace)) {
            // String.prototype.replace may invoke a user-provided
            // replacement-generator function.
            if (typeof args[1] === "function") {
              args[1] = wrapMethod(pFull, args[1]);
            }
          } else if (fname === "addEventListener") {
            // For |addEventListener|, the first argument is the type
            // of event and the second (index 1) is the event handler.
            // There may be optional further arguments.
            // %%% What if the second argument is an |EventListener|
            // %%% rather than a simple |Function|?
            args[1] = wrapMethod(pFull, args[1]);
          } else if (fname === "removeEventListener" || JAM.identical(fun, _clearInterval)) {
            // The second argument must specify the |Function| or
            // |EventListener| to remove, so we need to maintain a
            // mapping from the "original" functions to their
            // wrapped version. The latter is the value to pass as
            // second argument, if it exists in the mapping. If not,
            // use the passed argument (which should cover the case
            // in which the user retrieves the current event handler
            // and requests that it be removed, as opposed to
            // requesting that a reference to the original, unwrapped
            // function value be removed.
            // %%% Implement mapping described above.
          } else if (JAM.identical(fun, ___defineGetter__) || JAM.identical(fun, ___defineSetter__)) {
            // Wrap the native function in a comprehensive transaction.
            args[1] = wrapMethod(pFull, args[1]);
          } else if (len > 2) {
            if (JAM.identical(fun, _defineProperty)) {
              // Wrap the getter/setter function in a comprehensive transaction.
              var o = args[2];
              if (typeof o.set === "function") {
                o.set = wrapMethod(pFull, o.set);
              }
              if (typeof o.get === "function") {
                o.get = wrapMethod(pFull, o.get);
              }
            }
          }
        }
      }

      if (invoke) ret = _apply_apply(fun, [obj, args]);

      // Set the return value.
      tx.setRetval(ret);
    } else if (type === "new") {
      var c = sx.value;
      var args = sx.args;
      var len = args.length;

      if (len > 0) {
        if (JAM.identical(c, _Function)) {
            args[len-1] = "introspect(JAM.policy.pFull) {" + args[len-1] + "}";
        }
      }

      ret = JAM.newApply(c, args);
      tx.setRetval(ret);
    } else if (type === "forin") {
      // Transaction suspensions caused by entering a for-in loop.

      // Do nothing, we just rely on the commit to sync the state
      // of the transaction with the heap.
    } else if (type === "read") {
      // Get the receiver of the read.
      var obj = sx.obj;
      var id = sx.id;
      // %%% May need to wrap a user-defined getter in a tx.
      ret = obj[id];
      tx.setRetval(ret);
    } else {
      // Other suspension types.
      // %%% May need to handle these in the future.
      alert("Unhandled suspend type: " + type);
    }

    return;
  }

  // This object can play the role of a single-node transaction.
  var nodeTx = {
    node: _undefined,
    ret: _undefined,
    getActionSequence: function() { return typeof this.node === "object" ? [this.node] : []; },
    getCallSequence: function() { return typeof this.node === "object" && this.node.type === "call" ? [this.node] : []; },
    getReadSequence: function() { return typeof this.node === "object" && this.node.type === "read" ? [this.node] : []; },
    getWriteSequence: function() { return typeof this.node === "object" && this.node.type === "write" ? [this.node] : []; },
    suppress: function() { },
    commit: function() { JAM.commitNode(this) },
    isSuspended: function () { return false; },
    getSuspendInfo: function() { return _undefined; },
    setRetval: function(val) { this.ret = val; }
  }

  return {
    policy: policy,

    // Commandeer the native JAM utility functions.
    __proto__: JAM,

    process: function(tx) {
      tx.commit();
      if (tx.isSuspended()) {
        JAM.commitSuspend(tx);
        // Clear all the reads and writes. This is only needed if the
        // transaction is suspended, since not commiting at the
        // end of a transaction effectively suppresses.
        tx.suppress();
      }
    },

    // Generate an exception to prevent policy violation.
    prevent: function(tx) {
      tx.suppress();
      JAM.violation();
    },

    violation: function() {
      //console.trace();
      var msg = "JAM prevented a policy violation";
      JAM.log(msg + " at");

      var e = new Error(msg);
      var stack = e.stack;
        //.replace(/^[^\(]+?[\n$]/gm, '')
        //.replace(/^\s+at\s+/gm, '')
        //.replace(/^Object.<anonymous>\s*\(/gm, '{anonymous}()@')
        //.split('\n');
      JAM.log(stack);
      throw new Error(msg);
    },

    isEval: function(e) {
      return JAM.identical(e, _eval);
    },

    // Write the message to the log (for debugging/notification).
    log: function(message) {
      var logElt;
      if (_document_getElementById && (logElt = _document_getElementById("log"))) {
        logElt.textContent += "\n" + message;
      } else if (_console) {
        _console.log(message);
      } else if (_alert) {
        _alert(message);
      } else if (typeof _print === "function") {
        _print(message);
      }
    },

    new: function(c, args, ispect) {
      // General notes:
      // * The receiver won't matter, so |args| only contains the
      //   original arguments.

      if (!JAM.isNativeFunction(c)) {
        return JAM.newApply(c, args);
      }

      var len = args.length; 

      // The first element of |args| is the object that we're binding
      // the function to. The rest are the arguments, which we may need
      // to sanitize for some cases.
      if (len > 0) {
        if (JAM.identical(c, _Function)) {
          // The last argument is the function body. Any prior arguments
          // are the formals for the new function.
          ispect = pFull;
        }
      }

      var ret;
      if (typeof ispect === "function") {
        //if (MIMIC) {
          nodeTx.node = { type: "new", value: c, obj: null, args: args, argc: len };
          ispect(nodeTx);
          ret = nodeTx.ret;
          nodeTx.node = nodeTx.ret = _undefined;
        //} else {
        //  introspect(ispect) {
        //    ret = JAM.newApply(c, args);
        //  }
        //}
      } else {
        ret = JAM.newApply(c, args);
      }
      return ret;
    },

    call: function(f, rec, args, ispect) {
      // General notes:
      // * |HTMLElement.prototype.setAttribute| cannot be used to
      //   trigger parsing of |innerHTML|.

      if (!JAM.isNativeFunction(f)) {
        return _apply_apply(f, [rec, args]);
      }

      var len = args.length;

      if (JAM.identical(f, _bind)) {
        // Prevent a sneaky script from calling |bind| to obscure the
        // identity of a policy-transitioning function prior to a call.
        f = rec;
        if (JAM.isNativeFunction(f)) {
          f = wrapMethod(pFull, f);
        }
        return _bind_apply(f, args);
      }
      if (JAM.identical(f, _apply)) {
        // Given that the call is now formatted as follows...
        // 
        //   JAM.call(f.apply, f, [rec, args]);
        //
        // ...the original call was this:
        //
        //   f.apply(rec, args);
        // 
        // So for the logic below to evaluate what's actually being
        // called, we extract the function |f| and recreate the original
        // |args| array. Then recursively examine the result.
        f = rec;
        rec = len > 0 ? args[0] : null;
        args = len > 1 ? args[1] : [];
        return JAM.call(f, rec, args, ispect);
      }
      if (JAM.identical(f, _call)) {
        // This is largely the same as for |apply|, but with a different
        // method of forming the new arguments.
        f = rec;
        rec = len > 0 ? args[0] : null;
        args = len > 1 ? _Array_slice(args, 1) : [];
        return JAM.call(f, rec, args, ispect);
      }

      var fname = f.name;

      // Recognize higher-order scripts.
      if (len > 0) {
        if (JAM.identical(f, _eval) || JAM.identical(f, _Function)
            || JAM.identical(f, _HTMLDocument_prototype_write)
            || JAM.identical(f, _HTMLDocument_prototype_writeln)
            || (fname === "appendChild" && JAM.instanceof(rec, Element))
            || (fname === "insertBefore" && JAM.instanceof(rec, Element))
            || (fname === "replaceChild" && JAM.instanceof(rec, Element))
            || (fname === "setAttributeNode" && JAM.instanceof(rec, Element))) {
          ispect = pFull;
        } else if (JAM.identical(f, _Array_prototype_sort)
            || JAM.identical(f, _setTimeout) || JAM.identical(f, _setInterval)) {
          // Only protect if a native function is being invoked, since
          // we assume all user-defined functions are instrumented.
          // %%% What about string values?
          if (JAM.isNativeFunction(args[0])) ispect = pFull;
        }

        if (len > 1) {
          if (JAM.identical(f, _String_prototype_replace)
              || JAM.identical(f, ___defineGetter__)
              || JAM.identical(f, ___defineSetter__)) {
            // Array.prototype.sort may invoke a user-provided
            // comparison function.
            if (JAM.isNativeFunction(args[1])) ispect = pFull;
          } else if (fname === "setAttribute" && JAM.instanceof(rec, Element)) {
            // We check |name| because each subclass of |Element|
            // (i.e. |HTMLElement|, |HTMLImageElement|,
            // |HTMLInputElement|, etc) has a distinct |setAttribute|
            // method. The |name| property is read-only, so this is
            // safe (though overly conservative).
            var attr = args[0].toString();
            
            if (attr === "src") {
              if (JAM.instanceof(rec, _HTMLScriptElement)) {
                ispect = pFull;
              }
            } else if (attr === "data") {
              if (JAM.instanceof(rec, _HTMLObjectElement)) {
                ispect = pFull;
              }
            } else if (_String_startsWith(attr, "on")) {
              ispect = pFull;
            }
          }

          if (len > 2) {
            if (JAM.identical(f, _defineProperty)) {
              // The 3rd argument to Object.defineProperty is an object with
              // properties describing attributes of the new property. We
              // are interested in the |get| and |set| attributes.
              var o = args[2];
              if (typeof o === "object") {
                if (JAM.isNativeFunction(o.get) || JAM.isNativeFunction(o.set)) {
                  // %%% Don't I need to wrap this?
                  ispect = pFull;
                }
              }
            }
          }
        }
      }

      var ret;
      if (typeof ispect === "function") {
        //if (MIMIC) {
          nodeTx.node = { type: "call", value: f, obj: rec, args: args, argc: len };
          ispect(nodeTx);
          ret = nodeTx.ret;
          nodeTx.node = nodeTx.ret = _undefined;
        //} else {
        //  introspect(ispect) {
        //    ret = _apply_apply(f, [rec, args]);
        //  }
        //}
      } else {
        ret = _apply_apply(f, [rec, args]);
      }
      return ret;
    },

    get: function(obj, memb, ispect) {
      if (obj === null) obj = _global;
      var ret;
      if (ispect) {
        //if (MIMIC) {
          nodeTx.node = { type: "read", id: memb, obj: obj };
          ispect(nodeTx);
          ret = nodeTx.ret;
          nodeTx.node = nodeTx.ret = _undefined;
        //} else {
        //  introspect(ispect) {
        //    ret = obj[memb];
        //  }
        //}
      } else {
        ret = obj[memb];
      }
      return ret;
    },

    set: function(obj, memb, val, ispect) {
      // General notes:
      // * |Attr.nodeName| and |Attr.name| are both read-only.
      // * From https://developer.mozilla.org/en-US/docs/Web/API/HTMLScriptElement:
      //   ``Note: When inserted using the document.write() method,
      //     <script> elements execute (typically synchronously), but
      //     when inserted using innerHTML and outerHTML attributes,
      //     they do not execute at all.''
      //
      //   This does not prevent "on..." event handlers from being
      //   included and fired within HTML manipulation.
      // * Per mozilla-esr17/content/base/public/nsIScriptElement.h:
      //   ``when adding a src attribute to an element that already
      //     contains an inline script, the script referenced by the src
      //     attribute will not be loaded.''

      // Shortcut this common case that won't affect any policies.
      if (typeof memb === "number")
        return obj[memb] = val;

      if (obj === null) obj = _global;
      // %%% Need to be more general? |Node|, perhaps?
      if (JAM.instanceof(obj, _HTMLElement)) {
        if (memb === "outerHTML") {
          ispect = pFull;
        } else if (_String_startsWith(memb, "on")) {
          if (typeof val === "function") {
            if (JAM.isNativeFunction(val)) {
              // This should be rare.
              ispect = pFull;
            }
          } else {
            ispect = pFull;
          }
        } else if (JAM.instanceof(obj, _HTMLScriptElement)) {
          // The contents of script elements are directly interpreted.
          // I believe this should work with CDATA-enclosed text also,
          // since the CDATA tags have to be commented.
          if (memb === "innerHTML" || memb === "textContent") {
            ispect = pFull;
          }
        } else {
          if (memb === "innerHTML") {
            ispect = pFull;
          }
          // No action needed for |textContent|.
        }
        if (memb === "src") {
          if (JAM.instanceof(obj, _HTMLScriptElement)) {
            ispect = pFull;
          }
        } else if (memb === "data") {
          if (JAM.instanceof(obj, _HTMLObjectElement)) {
            ispect = pFull;
          }
        }
      }
      
      if (typeof ispect === "function") {
        var ret;
        //if (MIMIC) {
          nodeTx.node = { type: "write", id: memb, value: val, obj: obj };
          ispect(nodeTx);
          ret = nodeTx.ret;
          nodeTx.node = nodeTx.ret = _undefined;
        //} else {
          // %%% Seg. fault occurs when return is inside the transaction.
        //  introspect(ispect) {
        //    ret = obj[memb] = val;
        //  }
        //}
        return ret;
      } else {
        obj[memb] = val;
        return val;
      }
    },

    commitNode: function(tx) {
      var node = tx.node;
      var type = node.type;

      var ret;
      if (type === "write") {
        // Get the receiver of the write.
        var obj = node.obj;
        // Get the property name that was accessed.
        var id = node.id;
        // Transaction suspensions caused by assignment to a property.
        var value = node.value;
        ret = value;

        if (_String_startsWith(id, "on")) {
          // Wrap event handlers in transaction blocks.
          if (JAM.isNativeFunction(value)) {
            value = wrapFunction(pFull, value, obj);
          } else if (typeof value === "string") {
            value = "introspect(JAM.policy.pFull) { " + value + " }";
          }
        } else if (id === "outerHTML") {
          // Writing to |outerHTML| replaces the node altogether, so the
          // action is irrespective of the element type.
          // %%% Can |outerHTML| be used like |document.write| to
          // %%% incrementally create elements?
          value = wrapHTMLEventScript(obj, value);
        } else if (JAM.instanceof(obj, _HTMLScriptElement)) {
          if (id === "textContent" || id === "innerHTML") {
            value = "introspect(JAM.policy.pFull) { " + value + " };";
          }
        } else if (id === "innerHTML") {
          // Dig down into other element types to find scripts.
          value = wrapHTMLEventScript(obj, value);
        }
        obj[id] = value;

        // Set the return value to the *original* value.
        tx.setRetval(ret);

      } else if (type === "call") {
        // Transaction suspensions caused by call to a function.

        // Get the receiver of the call.
        var obj = node.obj;
        // Get the function that triggered the suspend.
        var fun = node.value;
        // And the arguments.
        var args = node.args;
        var len = node.argc;

        // Recursively unwrap these cases.
        if (JAM.identical(fun, _apply)) {
          node.value = obj;
          node.obj = node.argc > 0 ? args[0] : _undefined;
          node.args = node.argc > 1 ? args[1] : _undefined;
          node.argc = node.args.length;
          return JAM.commitNode(tx);
        } else if (JAM.identical(fun, _call)) {
          node.value = obj;
          node.obj = node.argc > 0 ? args[0] : _undefined;
          node.args = node.argc > 1 ? _Array_slice(args, 1) : _undefined;
          node.argc = node.args.length;
          return JAM.commitNode(tx);
        }

        // Mark this false if special invocation is done in place.
        var invoke = true;
        if (len > 0) {
          var fname = fun.name;
          if (JAM.identical(fun, _Array_prototype_sort)) {
            // Array.prototype.sort may invoke a user-provided
            // comparison function.
            if (JAM.isNativeFunction(args[0])) {
              args[0] = wrapMethod(pFull, args[0]);
            }
          } else if (JAM.identical(fun, _setTimeout) || JAM.identical(fun, _setInterval)) {
            // %%% Currently assumes args[0] is a function object
            if (JAM.isNativeFunction(args[0])) {
              args[0] = wrapMethod(pFull, args[0]);
            }
          } else if (JAM.identical(fun, _Function)) {
            // %%% What happens in non-string cases?
            ret = _apply_apply(fun, [obj, args]);
            if (typeof ret === "function") {
              ret = wrapMethod(pFull, ret)
            }
            invoke = false;
          } else if (JAM.identical(fun, _eval)) {
            // Given that the callsite transformation will handle all
            // direct calls to |eval|, we can assume this is indirect.
            // %%% What about the modular case?

            // Per MDN, SpiderMonkey no longer supports |eval| with
            // more than 1 argument.
            // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval
            JAM.setDynamicIntrospector(pFull);
            ret = _apply_apply(fun, [obj, args]);
            JAM.setDynamicIntrospector();
            invoke = false;
          } else if (JAM.identical(fun, _HTMLDocument_prototype_write) || JAM.identical(fun, _HTMLDocument_prototype_writeln)) {
            JAM.setDynamicIntrospector(pFull);
            ret = _apply_apply(fun, [obj, args]);
            JAM.setDynamicIntrospector();
            invoke = false;
          } else if (fname === "appendChild" || fname === "replaceChild" || fname === "insertBefore" || fname === "setAttribute" || fname === "setAttributeNode") {
            // For |appendChild|, |replaceChild| and |insertBefore|,
            // the first argument is the element to be inserted.
            JAM.setDynamicIntrospector(pFull);
            ret = _apply_apply(fun, [obj, args]);
            JAM.setDynamicIntrospector();
            invoke = false;
          }
          
          if (len > 1) {
            if (JAM.identical(fun, _String_prototype_replace)) {
              // String.prototype.replace may invoke a user-provided
              // replacement-generator function.
              if (JAM.isNativeFunction(args[1])) {
                args[1] = wrapMethod(pFull, args[1]);
              }
            } else if (fname === "addEventListener") {
              // For |addEventListener|, the first argument is the type
              // of event and the second (index 1) is the event handler.
              // There may be optional further arguments.
              // %%% What if the second argument is an |EventListener|
              // %%% rather than a simple |Function|?
              if (JAM.isNativeFunction(args[1])) {
                args[1] = wrapMethod(pFull, args[1]);
              }
            } else if (fname === "removeEventListener" || JAM.identical(fun, _clearInterval)) {
              // The second argument must specify the |Function| or
              // |EventListener| to remove, so we need to maintain a
              // mapping from the "original" functions to their
              // wrapped version. The latter is the value to pass as
              // second argument, if it exists in the mapping. If not,
              // use the passed argument (which should cover the case
              // in which the user retrieves the current event handler
              // and requests that it be removed, as opposed to
              // requesting that a reference to the original, unwrapped
              // function value be removed.
              // %%% Implement mapping described above.
            } else if (JAM.identical(fun, ___defineGetter__) || JAM.identical(fun, ___defineSetter__)) {
              // Wrap the native function in a comprehensive transaction.
              if (JAM.isNativeFunction(args[1])) {
                args[1] = wrapMethod(pFull, args[1]);
              }
            } else if (len > 2) {
              if (JAM.identical(fun, _defineProperty)) {
                // Wrap the getter/setter function in a comprehensive transaction.
                var o = args[2];
                if (JAM.isNativeFunction(o.set)) {
                  o.set = wrapMethod(pFull, o.set);
                }
                if (JAM.isNativeFunction(o.get)) {
                  o.get = wrapMethod(pFull, o.get);
                }
              }
            }
          }
        }

        if (invoke) ret = _apply_apply(fun, [obj, args]);

        // Set the return value.
        tx.setRetval(ret);
      } else if (type === "new") {
        var c = node.value;
        var args = node.args;
        var len = node.argc;

        if (len > 0) {
          if (JAM.identical(c, _Function)) {
            args[len-1] = "introspect(JAM.policy.pFull) {" + args[len-1] + "}";
          }
        }

        ret = JAM.newApply(c, args);
        tx.setRetval(ret);
      } else if (type === "forin") {
        // Transaction suspensions caused by entering a for-in loop.

        // Do nothing, we just rely on the commit to sync the state
        // of the transaction with the heap.
      } else if (type === "read") {
        // Get the receiver of the read.
        var obj = node.obj;
        var id = node.id;
        // %%% May need to wrap a user-defined getter in a tx.
        ret = obj[id];
        tx.setRetval(ret);
      } else {
        // Other suspension types.
        // %%% May need to handle these in the future.
        alert("Unhandled suspend type: " + type);
      }

      return undefined;
    },

    commitSuspend: policy.woven ? commitSuspendFine : commitSuspendCoarse,

    // Additional methods useful for debugging.
    dump: function(obj, depth) {
      if (typeof obj !== "object" && typeof obj !== "function") {
        // Just print a primitive as is.
        alert(obj);
        return;
      }
      if (typeof depth === "undefined") {
        // Default value for prototype depth.
        depth = 1;
      }

      //var str = "";
      //for (var p in obj) {
      //  var v = obj[p];
      //  str += p + ": " + v + "\n";
      //}
      //alert(str);
      alert(Object.getOwnPropertyNames(obj));
      if (depth > 0 && obj.__proto__) {
        // Recurse up the prototype chain.
        this.dump(obj.__proto__, depth - 1);
      }
    },

    // %%% Maybe make |TxAction.prototype.toString()| do this or similar.
    rwsetToString: function(rwset) {
      var str = "";
      for (var i=0; i<rwset.length; i++) {
        str += i + ":\n";
        // %%% Explicitly enumerate rather than using for-in.
        for (var p in rwset[i]) {
          str += "\t" + p + ": " + rwset[i][p] + "\n";
        }
      }
      return str;
    },

  };

}()) } );

if (PERFORMANCE_TESTING) {
  // Pass through violations for performance testing.
  JAM.prevent = JAM.process;
}

Object.freeze(JAM);
Object.freeze(JAM.policy);

// Prevent access to the policy except within the JAM object.
delete window.policy;
JAM.setDynamicIntrospector(JAM.policy.pFull);
