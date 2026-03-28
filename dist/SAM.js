(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global = global || self, global.tp = factory());
}(this, function () { 'use strict';

	function createCommonjsModule(fn, module) {
		return module = { exports: {} }, fn(module, module.exports), module.exports;
	}

	var _typeof_1 = createCommonjsModule(function (module) {
	function _typeof2(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof2 = function _typeof2(obj) { return typeof obj; }; } else { _typeof2 = function _typeof2(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof2(obj); }

	function _typeof(obj) {
	  if (typeof Symbol === "function" && _typeof2(Symbol.iterator) === "symbol") {
	    module.exports = _typeof = function _typeof(obj) {
	      return _typeof2(obj);
	    };
	  } else {
	    module.exports = _typeof = function _typeof(obj) {
	      return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : _typeof2(obj);
	    };
	  }

	  return _typeof(obj);
	}

	module.exports = _typeof;
	});

	function _arrayWithoutHoles(arr) {
	  if (Array.isArray(arr)) {
	    for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) {
	      arr2[i] = arr[i];
	    }

	    return arr2;
	  }
	}

	var arrayWithoutHoles = _arrayWithoutHoles;

	function _iterableToArray(iter) {
	  if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter);
	}

	var iterableToArray = _iterableToArray;

	function _nonIterableSpread() {
	  throw new TypeError("Invalid attempt to spread non-iterable instance");
	}

	var nonIterableSpread = _nonIterableSpread;

	function _toConsumableArray(arr) {
	  return arrayWithoutHoles(arr) || iterableToArray(arr) || nonIterableSpread();
	}

	var toConsumableArray = _toConsumableArray;

	function _arrayWithHoles(arr) {
	  if (Array.isArray(arr)) return arr;
	}

	var arrayWithHoles = _arrayWithHoles;

	function _iterableToArrayLimit(arr, i) {
	  var _arr = [];
	  var _n = true;
	  var _d = false;
	  var _e = undefined;

	  try {
	    for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
	      _arr.push(_s.value);

	      if (i && _arr.length === i) break;
	    }
	  } catch (err) {
	    _d = true;
	    _e = err;
	  } finally {
	    try {
	      if (!_n && _i["return"] != null) _i["return"]();
	    } finally {
	      if (_d) throw _e;
	    }
	  }

	  return _arr;
	}

	var iterableToArrayLimit = _iterableToArrayLimit;

	function _nonIterableRest() {
	  throw new TypeError("Invalid attempt to destructure non-iterable instance");
	}

	var nonIterableRest = _nonIterableRest;

	function _slicedToArray(arr, i) {
	  return arrayWithHoles(arr) || iterableToArrayLimit(arr, i) || nonIterableRest();
	}

	var slicedToArray = _slicedToArray;

	var runtime_1 = createCommonjsModule(function (module) {
	/**
	 * Copyright (c) 2014-present, Facebook, Inc.
	 *
	 * This source code is licensed under the MIT license found in the
	 * LICENSE file in the root directory of this source tree.
	 */

	var runtime = (function (exports) {

	  var Op = Object.prototype;
	  var hasOwn = Op.hasOwnProperty;
	  var undefined$1; // More compressible than void 0.
	  var $Symbol = typeof Symbol === "function" ? Symbol : {};
	  var iteratorSymbol = $Symbol.iterator || "@@iterator";
	  var asyncIteratorSymbol = $Symbol.asyncIterator || "@@asyncIterator";
	  var toStringTagSymbol = $Symbol.toStringTag || "@@toStringTag";

	  function wrap(innerFn, outerFn, self, tryLocsList) {
	    // If outerFn provided and outerFn.prototype is a Generator, then outerFn.prototype instanceof Generator.
	    var protoGenerator = outerFn && outerFn.prototype instanceof Generator ? outerFn : Generator;
	    var generator = Object.create(protoGenerator.prototype);
	    var context = new Context(tryLocsList || []);

	    // The ._invoke method unifies the implementations of the .next,
	    // .throw, and .return methods.
	    generator._invoke = makeInvokeMethod(innerFn, self, context);

	    return generator;
	  }
	  exports.wrap = wrap;

	  // Try/catch helper to minimize deoptimizations. Returns a completion
	  // record like context.tryEntries[i].completion. This interface could
	  // have been (and was previously) designed to take a closure to be
	  // invoked without arguments, but in all the cases we care about we
	  // already have an existing method we want to call, so there's no need
	  // to create a new function object. We can even get away with assuming
	  // the method takes exactly one argument, since that happens to be true
	  // in every case, so we don't have to touch the arguments object. The
	  // only additional allocation required is the completion record, which
	  // has a stable shape and so hopefully should be cheap to allocate.
	  function tryCatch(fn, obj, arg) {
	    try {
	      return { type: "normal", arg: fn.call(obj, arg) };
	    } catch (err) {
	      return { type: "throw", arg: err };
	    }
	  }

	  var GenStateSuspendedStart = "suspendedStart";
	  var GenStateSuspendedYield = "suspendedYield";
	  var GenStateExecuting = "executing";
	  var GenStateCompleted = "completed";

	  // Returning this object from the innerFn has the same effect as
	  // breaking out of the dispatch switch statement.
	  var ContinueSentinel = {};

	  // Dummy constructor functions that we use as the .constructor and
	  // .constructor.prototype properties for functions that return Generator
	  // objects. For full spec compliance, you may wish to configure your
	  // minifier not to mangle the names of these two functions.
	  function Generator() {}
	  function GeneratorFunction() {}
	  function GeneratorFunctionPrototype() {}

	  // This is a polyfill for %IteratorPrototype% for environments that
	  // don't natively support it.
	  var IteratorPrototype = {};
	  IteratorPrototype[iteratorSymbol] = function () {
	    return this;
	  };

	  var getProto = Object.getPrototypeOf;
	  var NativeIteratorPrototype = getProto && getProto(getProto(values([])));
	  if (NativeIteratorPrototype &&
	      NativeIteratorPrototype !== Op &&
	      hasOwn.call(NativeIteratorPrototype, iteratorSymbol)) {
	    // This environment has a native %IteratorPrototype%; use it instead
	    // of the polyfill.
	    IteratorPrototype = NativeIteratorPrototype;
	  }

	  var Gp = GeneratorFunctionPrototype.prototype =
	    Generator.prototype = Object.create(IteratorPrototype);
	  GeneratorFunction.prototype = Gp.constructor = GeneratorFunctionPrototype;
	  GeneratorFunctionPrototype.constructor = GeneratorFunction;
	  GeneratorFunctionPrototype[toStringTagSymbol] =
	    GeneratorFunction.displayName = "GeneratorFunction";

	  // Helper for defining the .next, .throw, and .return methods of the
	  // Iterator interface in terms of a single ._invoke method.
	  function defineIteratorMethods(prototype) {
	    ["next", "throw", "return"].forEach(function(method) {
	      prototype[method] = function(arg) {
	        return this._invoke(method, arg);
	      };
	    });
	  }

	  exports.isGeneratorFunction = function(genFun) {
	    var ctor = typeof genFun === "function" && genFun.constructor;
	    return ctor
	      ? ctor === GeneratorFunction ||
	        // For the native GeneratorFunction constructor, the best we can
	        // do is to check its .name property.
	        (ctor.displayName || ctor.name) === "GeneratorFunction"
	      : false;
	  };

	  exports.mark = function(genFun) {
	    if (Object.setPrototypeOf) {
	      Object.setPrototypeOf(genFun, GeneratorFunctionPrototype);
	    } else {
	      genFun.__proto__ = GeneratorFunctionPrototype;
	      if (!(toStringTagSymbol in genFun)) {
	        genFun[toStringTagSymbol] = "GeneratorFunction";
	      }
	    }
	    genFun.prototype = Object.create(Gp);
	    return genFun;
	  };

	  // Within the body of any async function, `await x` is transformed to
	  // `yield regeneratorRuntime.awrap(x)`, so that the runtime can test
	  // `hasOwn.call(value, "__await")` to determine if the yielded value is
	  // meant to be awaited.
	  exports.awrap = function(arg) {
	    return { __await: arg };
	  };

	  function AsyncIterator(generator) {
	    function invoke(method, arg, resolve, reject) {
	      var record = tryCatch(generator[method], generator, arg);
	      if (record.type === "throw") {
	        reject(record.arg);
	      } else {
	        var result = record.arg;
	        var value = result.value;
	        if (value &&
	            typeof value === "object" &&
	            hasOwn.call(value, "__await")) {
	          return Promise.resolve(value.__await).then(function(value) {
	            invoke("next", value, resolve, reject);
	          }, function(err) {
	            invoke("throw", err, resolve, reject);
	          });
	        }

	        return Promise.resolve(value).then(function(unwrapped) {
	          // When a yielded Promise is resolved, its final value becomes
	          // the .value of the Promise<{value,done}> result for the
	          // current iteration.
	          result.value = unwrapped;
	          resolve(result);
	        }, function(error) {
	          // If a rejected Promise was yielded, throw the rejection back
	          // into the async generator function so it can be handled there.
	          return invoke("throw", error, resolve, reject);
	        });
	      }
	    }

	    var previousPromise;

	    function enqueue(method, arg) {
	      function callInvokeWithMethodAndArg() {
	        return new Promise(function(resolve, reject) {
	          invoke(method, arg, resolve, reject);
	        });
	      }

	      return previousPromise =
	        // If enqueue has been called before, then we want to wait until
	        // all previous Promises have been resolved before calling invoke,
	        // so that results are always delivered in the correct order. If
	        // enqueue has not been called before, then it is important to
	        // call invoke immediately, without waiting on a callback to fire,
	        // so that the async generator function has the opportunity to do
	        // any necessary setup in a predictable way. This predictability
	        // is why the Promise constructor synchronously invokes its
	        // executor callback, and why async functions synchronously
	        // execute code before the first await. Since we implement simple
	        // async functions in terms of async generators, it is especially
	        // important to get this right, even though it requires care.
	        previousPromise ? previousPromise.then(
	          callInvokeWithMethodAndArg,
	          // Avoid propagating failures to Promises returned by later
	          // invocations of the iterator.
	          callInvokeWithMethodAndArg
	        ) : callInvokeWithMethodAndArg();
	    }

	    // Define the unified helper method that is used to implement .next,
	    // .throw, and .return (see defineIteratorMethods).
	    this._invoke = enqueue;
	  }

	  defineIteratorMethods(AsyncIterator.prototype);
	  AsyncIterator.prototype[asyncIteratorSymbol] = function () {
	    return this;
	  };
	  exports.AsyncIterator = AsyncIterator;

	  // Note that simple async functions are implemented on top of
	  // AsyncIterator objects; they just return a Promise for the value of
	  // the final result produced by the iterator.
	  exports.async = function(innerFn, outerFn, self, tryLocsList) {
	    var iter = new AsyncIterator(
	      wrap(innerFn, outerFn, self, tryLocsList)
	    );

	    return exports.isGeneratorFunction(outerFn)
	      ? iter // If outerFn is a generator, return the full iterator.
	      : iter.next().then(function(result) {
	          return result.done ? result.value : iter.next();
	        });
	  };

	  function makeInvokeMethod(innerFn, self, context) {
	    var state = GenStateSuspendedStart;

	    return function invoke(method, arg) {
	      if (state === GenStateExecuting) {
	        throw new Error("Generator is already running");
	      }

	      if (state === GenStateCompleted) {
	        if (method === "throw") {
	          throw arg;
	        }

	        // Be forgiving, per 25.3.3.3.3 of the spec:
	        // https://people.mozilla.org/~jorendorff/es6-draft.html#sec-generatorresume
	        return doneResult();
	      }

	      context.method = method;
	      context.arg = arg;

	      while (true) {
	        var delegate = context.delegate;
	        if (delegate) {
	          var delegateResult = maybeInvokeDelegate(delegate, context);
	          if (delegateResult) {
	            if (delegateResult === ContinueSentinel) continue;
	            return delegateResult;
	          }
	        }

	        if (context.method === "next") {
	          // Setting context._sent for legacy support of Babel's
	          // function.sent implementation.
	          context.sent = context._sent = context.arg;

	        } else if (context.method === "throw") {
	          if (state === GenStateSuspendedStart) {
	            state = GenStateCompleted;
	            throw context.arg;
	          }

	          context.dispatchException(context.arg);

	        } else if (context.method === "return") {
	          context.abrupt("return", context.arg);
	        }

	        state = GenStateExecuting;

	        var record = tryCatch(innerFn, self, context);
	        if (record.type === "normal") {
	          // If an exception is thrown from innerFn, we leave state ===
	          // GenStateExecuting and loop back for another invocation.
	          state = context.done
	            ? GenStateCompleted
	            : GenStateSuspendedYield;

	          if (record.arg === ContinueSentinel) {
	            continue;
	          }

	          return {
	            value: record.arg,
	            done: context.done
	          };

	        } else if (record.type === "throw") {
	          state = GenStateCompleted;
	          // Dispatch the exception by looping back around to the
	          // context.dispatchException(context.arg) call above.
	          context.method = "throw";
	          context.arg = record.arg;
	        }
	      }
	    };
	  }

	  // Call delegate.iterator[context.method](context.arg) and handle the
	  // result, either by returning a { value, done } result from the
	  // delegate iterator, or by modifying context.method and context.arg,
	  // setting context.delegate to null, and returning the ContinueSentinel.
	  function maybeInvokeDelegate(delegate, context) {
	    var method = delegate.iterator[context.method];
	    if (method === undefined$1) {
	      // A .throw or .return when the delegate iterator has no .throw
	      // method always terminates the yield* loop.
	      context.delegate = null;

	      if (context.method === "throw") {
	        // Note: ["return"] must be used for ES3 parsing compatibility.
	        if (delegate.iterator["return"]) {
	          // If the delegate iterator has a return method, give it a
	          // chance to clean up.
	          context.method = "return";
	          context.arg = undefined$1;
	          maybeInvokeDelegate(delegate, context);

	          if (context.method === "throw") {
	            // If maybeInvokeDelegate(context) changed context.method from
	            // "return" to "throw", let that override the TypeError below.
	            return ContinueSentinel;
	          }
	        }

	        context.method = "throw";
	        context.arg = new TypeError(
	          "The iterator does not provide a 'throw' method");
	      }

	      return ContinueSentinel;
	    }

	    var record = tryCatch(method, delegate.iterator, context.arg);

	    if (record.type === "throw") {
	      context.method = "throw";
	      context.arg = record.arg;
	      context.delegate = null;
	      return ContinueSentinel;
	    }

	    var info = record.arg;

	    if (! info) {
	      context.method = "throw";
	      context.arg = new TypeError("iterator result is not an object");
	      context.delegate = null;
	      return ContinueSentinel;
	    }

	    if (info.done) {
	      // Assign the result of the finished delegate to the temporary
	      // variable specified by delegate.resultName (see delegateYield).
	      context[delegate.resultName] = info.value;

	      // Resume execution at the desired location (see delegateYield).
	      context.next = delegate.nextLoc;

	      // If context.method was "throw" but the delegate handled the
	      // exception, let the outer generator proceed normally. If
	      // context.method was "next", forget context.arg since it has been
	      // "consumed" by the delegate iterator. If context.method was
	      // "return", allow the original .return call to continue in the
	      // outer generator.
	      if (context.method !== "return") {
	        context.method = "next";
	        context.arg = undefined$1;
	      }

	    } else {
	      // Re-yield the result returned by the delegate method.
	      return info;
	    }

	    // The delegate iterator is finished, so forget it and continue with
	    // the outer generator.
	    context.delegate = null;
	    return ContinueSentinel;
	  }

	  // Define Generator.prototype.{next,throw,return} in terms of the
	  // unified ._invoke helper method.
	  defineIteratorMethods(Gp);

	  Gp[toStringTagSymbol] = "Generator";

	  // A Generator should always return itself as the iterator object when the
	  // @@iterator function is called on it. Some browsers' implementations of the
	  // iterator prototype chain incorrectly implement this, causing the Generator
	  // object to not be returned from this call. This ensures that doesn't happen.
	  // See https://github.com/facebook/regenerator/issues/274 for more details.
	  Gp[iteratorSymbol] = function() {
	    return this;
	  };

	  Gp.toString = function() {
	    return "[object Generator]";
	  };

	  function pushTryEntry(locs) {
	    var entry = { tryLoc: locs[0] };

	    if (1 in locs) {
	      entry.catchLoc = locs[1];
	    }

	    if (2 in locs) {
	      entry.finallyLoc = locs[2];
	      entry.afterLoc = locs[3];
	    }

	    this.tryEntries.push(entry);
	  }

	  function resetTryEntry(entry) {
	    var record = entry.completion || {};
	    record.type = "normal";
	    delete record.arg;
	    entry.completion = record;
	  }

	  function Context(tryLocsList) {
	    // The root entry object (effectively a try statement without a catch
	    // or a finally block) gives us a place to store values thrown from
	    // locations where there is no enclosing try statement.
	    this.tryEntries = [{ tryLoc: "root" }];
	    tryLocsList.forEach(pushTryEntry, this);
	    this.reset(true);
	  }

	  exports.keys = function(object) {
	    var keys = [];
	    for (var key in object) {
	      keys.push(key);
	    }
	    keys.reverse();

	    // Rather than returning an object with a next method, we keep
	    // things simple and return the next function itself.
	    return function next() {
	      while (keys.length) {
	        var key = keys.pop();
	        if (key in object) {
	          next.value = key;
	          next.done = false;
	          return next;
	        }
	      }

	      // To avoid creating an additional object, we just hang the .value
	      // and .done properties off the next function object itself. This
	      // also ensures that the minifier will not anonymize the function.
	      next.done = true;
	      return next;
	    };
	  };

	  function values(iterable) {
	    if (iterable) {
	      var iteratorMethod = iterable[iteratorSymbol];
	      if (iteratorMethod) {
	        return iteratorMethod.call(iterable);
	      }

	      if (typeof iterable.next === "function") {
	        return iterable;
	      }

	      if (!isNaN(iterable.length)) {
	        var i = -1, next = function next() {
	          while (++i < iterable.length) {
	            if (hasOwn.call(iterable, i)) {
	              next.value = iterable[i];
	              next.done = false;
	              return next;
	            }
	          }

	          next.value = undefined$1;
	          next.done = true;

	          return next;
	        };

	        return next.next = next;
	      }
	    }

	    // Return an iterator with no values.
	    return { next: doneResult };
	  }
	  exports.values = values;

	  function doneResult() {
	    return { value: undefined$1, done: true };
	  }

	  Context.prototype = {
	    constructor: Context,

	    reset: function(skipTempReset) {
	      this.prev = 0;
	      this.next = 0;
	      // Resetting context._sent for legacy support of Babel's
	      // function.sent implementation.
	      this.sent = this._sent = undefined$1;
	      this.done = false;
	      this.delegate = null;

	      this.method = "next";
	      this.arg = undefined$1;

	      this.tryEntries.forEach(resetTryEntry);

	      if (!skipTempReset) {
	        for (var name in this) {
	          // Not sure about the optimal order of these conditions:
	          if (name.charAt(0) === "t" &&
	              hasOwn.call(this, name) &&
	              !isNaN(+name.slice(1))) {
	            this[name] = undefined$1;
	          }
	        }
	      }
	    },

	    stop: function() {
	      this.done = true;

	      var rootEntry = this.tryEntries[0];
	      var rootRecord = rootEntry.completion;
	      if (rootRecord.type === "throw") {
	        throw rootRecord.arg;
	      }

	      return this.rval;
	    },

	    dispatchException: function(exception) {
	      if (this.done) {
	        throw exception;
	      }

	      var context = this;
	      function handle(loc, caught) {
	        record.type = "throw";
	        record.arg = exception;
	        context.next = loc;

	        if (caught) {
	          // If the dispatched exception was caught by a catch block,
	          // then let that catch block handle the exception normally.
	          context.method = "next";
	          context.arg = undefined$1;
	        }

	        return !! caught;
	      }

	      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
	        var entry = this.tryEntries[i];
	        var record = entry.completion;

	        if (entry.tryLoc === "root") {
	          // Exception thrown outside of any try block that could handle
	          // it, so set the completion value of the entire function to
	          // throw the exception.
	          return handle("end");
	        }

	        if (entry.tryLoc <= this.prev) {
	          var hasCatch = hasOwn.call(entry, "catchLoc");
	          var hasFinally = hasOwn.call(entry, "finallyLoc");

	          if (hasCatch && hasFinally) {
	            if (this.prev < entry.catchLoc) {
	              return handle(entry.catchLoc, true);
	            } else if (this.prev < entry.finallyLoc) {
	              return handle(entry.finallyLoc);
	            }

	          } else if (hasCatch) {
	            if (this.prev < entry.catchLoc) {
	              return handle(entry.catchLoc, true);
	            }

	          } else if (hasFinally) {
	            if (this.prev < entry.finallyLoc) {
	              return handle(entry.finallyLoc);
	            }

	          } else {
	            throw new Error("try statement without catch or finally");
	          }
	        }
	      }
	    },

	    abrupt: function(type, arg) {
	      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
	        var entry = this.tryEntries[i];
	        if (entry.tryLoc <= this.prev &&
	            hasOwn.call(entry, "finallyLoc") &&
	            this.prev < entry.finallyLoc) {
	          var finallyEntry = entry;
	          break;
	        }
	      }

	      if (finallyEntry &&
	          (type === "break" ||
	           type === "continue") &&
	          finallyEntry.tryLoc <= arg &&
	          arg <= finallyEntry.finallyLoc) {
	        // Ignore the finally entry if control is not jumping to a
	        // location outside the try/catch block.
	        finallyEntry = null;
	      }

	      var record = finallyEntry ? finallyEntry.completion : {};
	      record.type = type;
	      record.arg = arg;

	      if (finallyEntry) {
	        this.method = "next";
	        this.next = finallyEntry.finallyLoc;
	        return ContinueSentinel;
	      }

	      return this.complete(record);
	    },

	    complete: function(record, afterLoc) {
	      if (record.type === "throw") {
	        throw record.arg;
	      }

	      if (record.type === "break" ||
	          record.type === "continue") {
	        this.next = record.arg;
	      } else if (record.type === "return") {
	        this.rval = this.arg = record.arg;
	        this.method = "return";
	        this.next = "end";
	      } else if (record.type === "normal" && afterLoc) {
	        this.next = afterLoc;
	      }

	      return ContinueSentinel;
	    },

	    finish: function(finallyLoc) {
	      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
	        var entry = this.tryEntries[i];
	        if (entry.finallyLoc === finallyLoc) {
	          this.complete(entry.completion, entry.afterLoc);
	          resetTryEntry(entry);
	          return ContinueSentinel;
	        }
	      }
	    },

	    "catch": function(tryLoc) {
	      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
	        var entry = this.tryEntries[i];
	        if (entry.tryLoc === tryLoc) {
	          var record = entry.completion;
	          if (record.type === "throw") {
	            var thrown = record.arg;
	            resetTryEntry(entry);
	          }
	          return thrown;
	        }
	      }

	      // The context.catch method must only be called with a location
	      // argument that corresponds to a known catch block.
	      throw new Error("illegal catch attempt");
	    },

	    delegateYield: function(iterable, resultName, nextLoc) {
	      this.delegate = {
	        iterator: values(iterable),
	        resultName: resultName,
	        nextLoc: nextLoc
	      };

	      if (this.method === "next") {
	        // Deliberately forget the last sent value so that we don't
	        // accidentally pass it on to the delegate.
	        this.arg = undefined$1;
	      }

	      return ContinueSentinel;
	    }
	  };

	  // Regardless of whether this script is executing as a CommonJS module
	  // or not, return the runtime object so that we can declare the variable
	  // regeneratorRuntime in the outer scope, which allows this module to be
	  // injected easily by `bin/regenerator --include-runtime script.js`.
	  return exports;

	}(
	  // If this script is executing as a CommonJS module, use module.exports
	  // as the regeneratorRuntime namespace. Otherwise create a new empty
	  // object. Either way, the resulting object will be used to initialize
	  // the regeneratorRuntime variable at the top of this file.
	   module.exports 
	));

	try {
	  regeneratorRuntime = runtime;
	} catch (accidentalStrictMode) {
	  // This module should not be running in strict mode, so the above
	  // assignment should always work unless something is misconfigured. Just
	  // in case runtime.js accidentally runs in strict mode, we can escape
	  // strict mode using a global Function call. This could conceivably fail
	  // if a Content Security Policy forbids using Function, but in that case
	  // the proper solution is to fix the accidental strict mode problem. If
	  // you've misconfigured your bundler to force strict mode and applied a
	  // CSP to forbid Function, and you're not willing to fix either of those
	  // problems, please detail your unique predicament in a GitHub issue.
	  Function("r", "regeneratorRuntime = r")(runtime);
	}
	});

	var regenerator = runtime_1;

	function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
	  try {
	    var info = gen[key](arg);
	    var value = info.value;
	  } catch (error) {
	    reject(error);
	    return;
	  }

	  if (info.done) {
	    resolve(value);
	  } else {
	    Promise.resolve(value).then(_next, _throw);
	  }
	}

	function _asyncToGenerator(fn) {
	  return function () {
	    var self = this,
	        args = arguments;
	    return new Promise(function (resolve, reject) {
	      var gen = fn.apply(self, args);

	      function _next(value) {
	        asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
	      }

	      function _throw(err) {
	        asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
	      }

	      _next(undefined);
	    });
	  };
	}

	var asyncToGenerator = _asyncToGenerator;

	// ISC License (ISC)
	// Copyright 2019 Jean-Jacques Dubray

	// Permission to use, copy, modify, and/or distribute this software for any purpose
	// with or without fee is hereby granted, provided that the above copyright notice
	// and this permission notice appear in all copies.

	// THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
	// REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
	// FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT,
	// OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA
	// OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION,
	// ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

	/**
	 * Modernized SAM Utilities
	 * 
	 * Note: Many functions have been replaced with native JavaScript features:
	 * - O() → optional chaining (?.) and nullish coalescing (??)
	 * - A() → optional chaining (?.) and nullish coalescing (??)
	 * - S() → optional chaining (?.) and nullish coalescing (??)
	 * - F() → nullish coalescing (??)
	 * - E() → nullish checks (!= null) for simple cases
	 * 
	 * The remaining functions provide specialized functionality beyond
	 * what native optional chaining offers.
	 */

	// Util functions often used in SAM implementations
	var first = function first() {
	  var arr = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
	  return arr[0];
	};
	var or = function or(acc, current) {
	  return acc || current;
	};
	var and = function and(acc, current) {
	  return acc && current;
	};
	var match = function match(conditions, values) {
	  return first(conditions.map(function (condition, index) {
	    return condition ? values[index] : null;
	  }).filter(e));
	};
	var step = function step() {
	  return {};
	};
	var doNotRender = function doNotRender(model) {
	  return function () {
	    return model["continue"]() === true;
	  };
	};
	var wrap = function wrap(s, w) {
	  return function (m) {
	    return s(w(m));
	  };
	};
	var log = function log(f) {
	  return function () {
	    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
	      args[_key] = arguments[_key];
	    }
	    console.log(args);
	    f.apply(void 0, args);
	  };
	};

	/**
	 * Standardized error handling for SAM
	 * Creates a consistent error object that can be used across the system
	 * 
	 * @param {Error|string} error - The error to standardize
	 * @param {string} [context] - Optional context for the error
	 * @param {string} [type='SAM_ERROR'] - Optional error type
	 * @returns {Object} Standardized error object
	 */
	var standardizeError = function standardizeError(error) {
	  var context = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
	  var type = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 'SAM_ERROR';
	  if (error instanceof Error) {
	    return {
	      __error: true,
	      message: error.message,
	      stack: error.stack,
	      type: type,
	      context: context,
	      originalError: error
	    };
	  }
	  return {
	    __error: true,
	    message: String(error),
	    type: type,
	    context: context
	  };
	};

	// Enhanced existence check with support for complex cases
	// This goes beyond simple nullish checks to handle:
	// - Array element existence
	// - String substring checks  
	// - Object key existence with truthy values
	var e = function e(value) {
	  return Array.isArray(value) ? value.map(e).reduce(and, true) : value !== false && value !== null && value !== undefined && value !== 0 && value !== '';
	};
	var i = function i(value, element) {
	  switch (_typeof_1(value)) {
	    case 'string':
	      return typeof element === 'string' && element !== '' && value.includes(element);
	    case 'object':
	      return Array.isArray(value) ? value.includes(element) : typeof element === 'string' && e(value[element]);
	  }
	  return value === element;
	};

	/**
	 * Enhanced existence check - checks if value exists and optionally if element exists within value
	 * 
	 * @param {*} value - The value to check
	 * @param {*} [element] - Optional element to check within value
	 * @returns {boolean} True if value exists and (element is undefined or element exists within value)
	 * 
	 * Examples:
	 * E(null) → false
	 * E(undefined) → false  
	 * E(false) → false
	 * E('hello') → true
	 * E('hello', 'ell') → true
	 * E('hello', 'xyz') → false
	 * E([1,2,3], 2) → true
	 * E({a: 1}, 'a') → true
	 * E({a: null}, 'a') → false
	 */
	var E = function E(value, element) {
	  if (!e(value)) return false;
	  if (element === undefined) return e(value);
	  if (!e(element)) return false;
	  return i(value, element);
	};

	/**
	 * Chainable conditional executor - executes function if value is truthy
	 * 
	 * @param {*} value - Value to check
	 * @param {Function} f - Function to execute if value is truthy
	 * @param {boolean} [guard=true] - Optional guard condition
	 * @returns {Object} Chainable object with .on method
	 * 
	 * Example:
	 * on(user.loggedIn, () => console.log('Welcome'))
	 *   .on(user.isAdmin, () => console.log('Admin access'))
	 */
	var oneOf = function oneOf(value, f) {
	  var guard = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
	  var triggered = e(value) && guard;
	  triggered && f(value);
	  return mon(triggered);
	};

	/**
	 * Chainable conditional executor - executes function if value is truthy
	 * Continues chain regardless of execution
	 * 
	 * @param {*} value - Value to check
	 * @param {Function} f - Function to execute if value is truthy
	 * @param {boolean} [guard=true] - Optional guard condition
	 * @returns {Object} Chainable object with .on method
	 */
	var on = function on(value, f) {
	  var guard = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
	  var triggered = e(value) && guard;
	  triggered && f(value);
	  return {
	    on: on
	  };
	};
	var mon = function mon() {
	  var triggered = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
	  return {
	    oneOf: triggered ? function () {
	      return mon(false);
	    } : oneOf
	  };
	};

	// Number utilities - still useful for NaN handling
	var N = function N(val) {
	  var value = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
	  return Number.isNaN(val) ? value : val;
	};
	var NZ = function NZ(val) {
	  var value = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1;
	  return val === 0 || Number.isNaN(val) ? value === 0 ? 1 : value : val;
	};

	// Legacy functions kept for backward compatibility
	// These have been largely replaced by native optional chaining (?.) and nullish coalescing (??)
	var O = function O(val) {
	  var value = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
	  return val && _typeof_1(val) === 'object' ? val : value;
	};
	var A = function A(val) {
	  var value = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
	  return val && Array.isArray(val) ? val : value;
	};
	var S = function S(val) {
	  var value = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
	  return val && typeof val === 'string' ? val : value;
	};
	var F = function F(f) {
	  var f0 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : function () {
	    return null;
	  };
	  return f || f0;
	};

	function _classCallCheck(instance, Constructor) {
	  if (!(instance instanceof Constructor)) {
	    throw new TypeError("Cannot call a class as a function");
	  }
	}

	var classCallCheck = _classCallCheck;

	function _defineProperties(target, props) {
	  for (var i = 0; i < props.length; i++) {
	    var descriptor = props[i];
	    descriptor.enumerable = descriptor.enumerable || false;
	    descriptor.configurable = true;
	    if ("value" in descriptor) descriptor.writable = true;
	    Object.defineProperty(target, descriptor.key, descriptor);
	  }
	}

	function _createClass(Constructor, protoProps, staticProps) {
	  if (protoProps) _defineProperties(Constructor.prototype, protoProps);
	  if (staticProps) _defineProperties(Constructor, staticProps);
	  return Constructor;
	}

	var createClass = _createClass;

	function _objectWithoutPropertiesLoose(source, excluded) {
	  if (source == null) return {};
	  var target = {};
	  var sourceKeys = Object.keys(source);
	  var key, i;

	  for (i = 0; i < sourceKeys.length; i++) {
	    key = sourceKeys[i];
	    if (excluded.indexOf(key) >= 0) continue;
	    target[key] = source[key];
	  }

	  return target;
	}

	var objectWithoutPropertiesLoose = _objectWithoutPropertiesLoose;

	function _objectWithoutProperties(source, excluded) {
	  if (source == null) return {};
	  var target = objectWithoutPropertiesLoose(source, excluded);
	  var key, i;

	  if (Object.getOwnPropertySymbols) {
	    var sourceSymbolKeys = Object.getOwnPropertySymbols(source);

	    for (i = 0; i < sourceSymbolKeys.length; i++) {
	      key = sourceSymbolKeys[i];
	      if (excluded.indexOf(key) >= 0) continue;
	      if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue;
	      target[key] = source[key];
	    }
	  }

	  return target;
	}

	var objectWithoutProperties = _objectWithoutProperties;

	var safeDeepClone = function safeDeepClone(obj) {
	  if (obj === null || _typeof_1(obj) !== 'object') return obj;
	  if (Array.isArray(obj)) return obj.map(safeDeepClone);
	  return Object.fromEntries(Object.entries(obj).map(function (_ref) {
	    var _ref2 = slicedToArray(_ref, 2),
	      k = _ref2[0],
	      v = _ref2[1];
	    return [k, safeDeepClone(v)];
	  }));
	};
	var clone = function clone(state) {
	  var comps = state.__components;
	  var __components = state.__components,
	    stateWithoutComps = objectWithoutProperties(state, ["__components"]);
	  var cln = safeDeepClone(stateWithoutComps);
	  if (comps) {
	    cln.__components = {};
	    Object.keys(comps).forEach(function (key) {
	      var _comps$key = comps[key],
	        parent = _comps$key.parent,
	        compWithoutParent = objectWithoutProperties(_comps$key, ["parent"]);
	      cln.__components[key] = Object.assign(clone(compWithoutParent), {
	        parent: cln
	      });
	    });
	  }
	  return cln;
	};
	var History = /*#__PURE__*/function () {
	  function History() {
	    var h = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
	    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
	    classCallCheck(this, History);
	    this.currentIndex = 0;
	    this.history = h;
	    this.max = options.max;
	  }
	  createClass(History, [{
	    key: "snap",
	    value: function snap(state, index) {
	      var snapshot = clone(state);
	      if (index) {
	        this.history[index] = snapshot;
	      } else {
	        this.history.push(snapshot);
	        if (this.max && this.history.length > this.max) {
	          this.history.shift();
	        }
	      }
	      return state;
	    }
	  }, {
	    key: "travel",
	    value: function travel() {
	      var index = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
	      this.currentIndex = index;
	      return this.history[index];
	    }
	  }, {
	    key: "next",
	    value: function next() {
	      return this.history[this.currentIndex++];
	    }
	  }, {
	    key: "hasNext",
	    value: function hasNext() {
	      return this.history[this.currentIndex] != null;
	    }
	  }, {
	    key: "last",
	    value: function last() {
	      this.currentIndex = this.history.length - 1;
	      return this.history[this.currentIndex];
	    }
	  }]);
	  return History;
	}();

	function _defineProperty(obj, key, value) {
	  if (key in obj) {
	    Object.defineProperty(obj, key, {
	      value: value,
	      enumerable: true,
	      configurable: true,
	      writable: true
	    });
	  } else {
	    obj[key] = value;
	  }

	  return obj;
	}

	var defineProperty = _defineProperty;

	function _objectSpread(target) {
	  for (var i = 1; i < arguments.length; i++) {
	    var source = arguments[i] != null ? arguments[i] : {};
	    var ownKeys = Object.keys(source);

	    if (typeof Object.getOwnPropertySymbols === 'function') {
	      ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) {
	        return Object.getOwnPropertyDescriptor(source, sym).enumerable;
	      }));
	    }

	    ownKeys.forEach(function (key) {
	      defineProperty(target, key, source[key]);
	    });
	  }

	  return target;
	}

	var objectSpread = _objectSpread;

	var handlers = {};
	var events = {
	  on: function on(event, handler) {
	    if (handlers[event] == null) {
	      handlers[event] = [];
	    }
	    handlers[event].push(handler);
	  },
	  off: function off(event, handler) {
	    var _handlers$event$filte, _handlers$event;
	    handlers[event] = (_handlers$event$filte = (_handlers$event = handlers[event]) === null || _handlers$event === void 0 ? void 0 : _handlers$event.filter(function (h) {
	      return h !== handler;
	    })) !== null && _handlers$event$filte !== void 0 ? _handlers$event$filte : [];
	  },
	  emit: function emit() {
	    var events = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
	    var data = arguments.length > 1 ? arguments[1] : undefined;
	    if (Array.isArray(events)) {
	      events.forEach(function (event) {
	        var _handlers$event2;
	        return (_handlers$event2 = handlers[event]) === null || _handlers$event2 === void 0 ? void 0 : _handlers$event2.forEach(function (f) {
	          return f(data);
	        });
	      });
	    } else {
	      var _handlers$events;
	      (_handlers$events = handlers[events]) === null || _handlers$events === void 0 || _handlers$events.forEach(function (f) {
	        return f(data);
	      });
	    }
	  }
	};

	var Model = /*#__PURE__*/function () {
	  function Model(name) {
	    classCallCheck(this, Model);
	    this.__components = {};
	    this.__behavior = [];
	    this.__name = name;
	    this.__lastProposalTimestamp = 0;
	    this.__allowedActions = [];
	    this.__disallowedActions = [];
	    this.__eventQueue = [];
	  }
	  createClass(Model, [{
	    key: "localState",
	    value: function localState(name) {
	      return this.__components[name] || {};
	    }
	  }, {
	    key: "hasError",
	    value: function hasError() {
	      return E(this.__error);
	    }
	  }, {
	    key: "error",
	    value: function error() {
	      return this.__error || undefined;
	    }
	  }, {
	    key: "errorMessage",
	    value: function errorMessage() {
	      var _this$__error;
	      return (_this$__error = this.__error) === null || _this$__error === void 0 ? void 0 : _this$__error.message;
	    }
	  }, {
	    key: "clearError",
	    value: function clearError() {
	      return delete this.__error;
	    }
	  }, {
	    key: "allowedActions",
	    value: function allowedActions() {
	      return this.__allowedActions;
	    }
	  }, {
	    key: "disallowedActions",
	    value: function disallowedActions() {
	      return this.__disallowedActions;
	    }
	  }, {
	    key: "clearAllowedActions",
	    value: function clearAllowedActions() {
	      this.__allowedActions = [];
	    }
	  }, {
	    key: "clearDisallowedActions",
	    value: function clearDisallowedActions() {
	      this.__disallowedActions = [];
	    }
	  }, {
	    key: "addAllowedActions",
	    value: function addAllowedActions(a) {
	      this.__allowedActions.push(a);
	    }
	  }, {
	    key: "addDisallowedActions",
	    value: function addDisallowedActions(a) {
	      this.__disallowedActions.push(a);
	    }
	  }, {
	    key: "allow",
	    value: function allow(a) {
	      this.__allowedActions = this.__allowedActions.concat(a);
	    }
	  }, {
	    key: "resetBehavior",
	    value: function resetBehavior() {
	      this.__behavior = [];
	    }
	  }, {
	    key: "update",
	    value: function update() {
	      var snapshot = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
	      Object.assign(this, snapshot);
	    }
	  }, {
	    key: "setComponentState",
	    value: function setComponentState(component) {
	      var _component$localState;
	      this.__components[component.name] = Object.assign((_component$localState = component.localState) !== null && _component$localState !== void 0 ? _component$localState : {}, {
	        parent: this
	      });
	      component.localState = component.localState || this.__components[component.name];
	    }
	  }, {
	    key: "hasNext",
	    value: function hasNext(val) {
	      if (val !== undefined) {
	        this.__hasNext = val;
	      }
	      return this.__hasNext;
	    }
	  }, {
	    key: "continue",
	    value: function _continue() {
	      return this.__continue === true;
	    }
	  }, {
	    key: "renderNextTime",
	    value: function renderNextTime() {
	      delete this.__continue;
	    }
	  }, {
	    key: "doNotRender",
	    value: function doNotRender() {
	      this.__continue = true;
	    }
	  }, {
	    key: "setLogger",
	    value: function setLogger(logger) {
	      this.__logger = logger;
	    }
	  }, {
	    key: "log",
	    value: function log(_ref) {
	      var _this = this;
	      var trace = _ref.trace,
	        info = _ref.info,
	        warning = _ref.warning,
	        error = _ref.error,
	        fatal = _ref.fatal;
	      if (this.__logger) {
	        oneOf(trace, function (v) {
	          return _this.__logger.trace(v);
	        }).oneOf(info, function (v) {
	          return _this.__logger.info(v);
	        }).oneOf(warning, function (v) {
	          return _this.__logger.warning(v);
	        }).oneOf(error, function (v) {
	          return _this.__logger.error(v);
	        }).oneOf(fatal, function (v) {
	          return _this.__logger.fatal(v);
	        });
	      }
	    }
	  }, {
	    key: "prepareEvent",
	    value: function prepareEvent(event, data) {
	      this.__eventQueue.push([event, data]);
	    }
	  }, {
	    key: "resetEventQueue",
	    value: function resetEventQueue() {
	      this.__eventQueue = [];
	    }
	  }, {
	    key: "flush",
	    value: function flush() {
	      if (this["continue"]() === false) {
	        var _this$__eventQueue;
	        (_this$__eventQueue = this.__eventQueue) === null || _this$__eventQueue === void 0 || _this$__eventQueue.forEach(function (_ref2) {
	          var _ref3 = slicedToArray(_ref2, 2),
	            event = _ref3[0],
	            data = _ref3[1];
	          return events.emit(event, data);
	        });
	        this.__eventQueue = [];
	      }
	    }
	  }, {
	    key: "clone",
	    value: function clone() {
	      var _this2 = this;
	      var state = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : this;
	      var comps = state.__components;
	      var __components = state.__components,
	        stateWithoutComps = objectWithoutProperties(state, ["__components"]); // Optimized cloning - avoid JSON.parse(JSON.stringify) for better performance
	      var cln = Array.isArray(stateWithoutComps) ? toConsumableArray(stateWithoutComps) : objectSpread({}, stateWithoutComps);

	      // Deep clone nested objects
	      Object.keys(cln).forEach(function (key) {
	        var value = cln[key];
	        if (value && _typeof_1(value) === 'object' && !Array.isArray(value)) {
	          cln[key] = _this2.clone(value);
	        } else if (Array.isArray(value)) {
	          cln[key] = value.map(function (item) {
	            return item && _typeof_1(item) === 'object' ? _this2.clone(item) : item;
	          });
	        }
	      });
	      if (comps) {
	        cln.__components = {};
	        Object.keys(comps).forEach(function (key) {
	          var _comps$key = comps[key],
	            parent = _comps$key.parent,
	            compWithoutParent = objectWithoutProperties(_comps$key, ["parent"]);
	          cln.__components[key] = Object.assign(_this2.clone(compWithoutParent), {
	            parent: cln
	          });
	        });
	      }
	      return cln;
	    }
	  }, {
	    key: "state",
	    value: function state(name, clone) {
	      var _this3 = this;
	      var prop = function prop(n) {
	        return E(_this3[n]) ? _this3[n] : E(_this3.__components[n]) ? _this3.__components[n] : _this3;
	      };
	      var state;
	      if (Array.isArray(name)) {
	        state = name.map(function (n) {
	          return prop(n);
	        });
	      } else {
	        state = prop(name);
	      }
	      return clone && state ? this.clone(state) : state;
	    }
	  }]);
	  return Model;
	}();

	// This is an implementation of SAM using SAM's own principles
	// - SAM's internal model
	// - SAM's internal acceptors
	// - SAM's present function

	// eslint-disable-next-line arrow-body-style
	var stringify = function stringify(s, pretty) {
	  return pretty ? JSON.stringify(s, null, 4) : JSON.stringify(s);
	};
	var display = function display() {
	  var json = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
	  var pretty = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
	  var keys = Object.keys(json);
	  return "".concat(keys.map(function (key) {
	    if (typeof key !== 'string') {
	      return '';
	    }
	    return key.indexOf('__') === 0 ? '' : stringify(json[key], pretty);
	  }).filter(function (val) {
	    return val !== '';
	  }).join(', '));
	};
	var react = function react(r) {
	  return r();
	};
	var accept = function accept(proposal) {
	  return /*#__PURE__*/function () {
	    var _ref = asyncToGenerator(/*#__PURE__*/regenerator.mark(function _callee(a) {
	      return regenerator.wrap(function _callee$(_context) {
	        while (1) {
	          switch (_context.prev = _context.next) {
	            case 0:
	              return _context.abrupt("return", a(proposal));
	            case 1:
	            case "end":
	              return _context.stop();
	          }
	        }
	      }, _callee);
	    }));
	    return function (_x) {
	      return _ref.apply(this, arguments);
	    };
	  }();
	};
	function createInstance () {
	  var _options$timetravel;
	  var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
	  var _ref2 = (_options$timetravel = options.timetravel) !== null && _options$timetravel !== void 0 ? _options$timetravel : {},
	    max = _ref2.max;
	  var _options$hasAsyncActi = options.hasAsyncActions,
	    hasAsyncActions = _options$hasAsyncActi === void 0 ? true : _options$hasAsyncActi,
	    _options$instanceName = options.instanceName,
	    instanceName = _options$instanceName === void 0 ? 'global' : _options$instanceName,
	    _options$synchronize = options.synchronize,
	    synchronize = _options$synchronize === void 0 ? false : _options$synchronize,
	    _options$clone = options.clone,
	    clone = _options$clone === void 0 ? false : _options$clone,
	    requestStateRepresentation = options.requestStateRepresentation;
	  var _ref3 = synchronize !== null && synchronize !== void 0 ? synchronize : {},
	    _ref3$synchronizeInte = _ref3.synchronizeInterval,
	    synchronizeInterval = _ref3$synchronizeInte === void 0 ? 5 : _ref3$synchronizeInte; // SAM's internal model
	  var history;
	  var model = new Model(instanceName);
	  var mount = function mount() {
	    var arr = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
	    var elements = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
	    var operand = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : model;
	    return elements.map(function (el) {
	      return arr.push(el(operand));
	    });
	  };
	  var intents;
	  var acceptors = [function (_ref4) {
	    var __error = _ref4.__error;
	    if (__error) {
	      if (__error.name !== 'AssertionError') {
	        model.__error = __error;
	      } else {
	        console.log('--------------------------------------');
	        console.log(__error);
	      }
	    }
	  }];
	  var reactors = [function () {
	    model.hasNext(history ? history.hasNext() : false);
	  }];
	  var naps = [];

	  // ancillary
	  var renderView = function renderView(m) {
	    return m.flush();
	  };
	  var _render = function _render(m) {
	    return m.flush();
	  };
	  var storeRenderView = _render;

	  // State Representation
	  var state = function state() {
	    try {
	      // Compute state representation
	      reactors.forEach(react);

	      // render state representation (gated by nap)
	      if (!naps.map(react).reduce(or, false)) {
	        renderView(clone ? model.clone() : model);
	      }
	      model.renderNextTime();
	    } catch (err) {
	      if (err.name !== 'AssertionError') {
	        setTimeout(function () {
	          return present({
	            __error: err
	          });
	        }, 0);
	      } else {
	        throw err;
	      }
	    }
	  };
	  var storeBehavior = function storeBehavior(proposal) {
	    if (proposal.__name != null) {
	      var actionName = proposal.__name;
	      delete proposal.__name;
	      var behavior = model.__formatBehavior ? model.__formatBehavior(actionName, proposal, model) : "".concat(actionName, "(").concat(display(proposal), ") ==> ").concat(display(model));
	      model.__behavior.push(behavior);
	    }
	  };
	  var checkForOutOfOrder = function checkForOutOfOrder(proposal) {
	    if (proposal.__startTime) {
	      if (proposal.__startTime <= model.__lastProposalTimestamp) {
	        return false;
	      }
	      model.__lastProposalTimestamp = proposal.__startTime;
	    }
	    return true;
	  };
	  var queue = {
	    _queue: [],
	    _rendering: false,
	    add: function add(args) {
	      this._queue.push(args);
	    },
	    synchronize: function synchronize(present) {
	      var self = this;
	      this._interval = setInterval(/*#__PURE__*/asyncToGenerator(/*#__PURE__*/regenerator.mark(function _callee2() {
	        var _self$_queue$slice, _self$_queue$slice2, args, _args2, proposal;
	        return regenerator.wrap(function _callee2$(_context2) {
	          while (1) {
	            switch (_context2.prev = _context2.next) {
	              case 0:
	                if (!(!self._rendering && self._queue.length > 0)) {
	                  _context2.next = 9;
	                  break;
	                }
	                self._rendering = true;
	                _self$_queue$slice = self._queue.slice(0, 1), _self$_queue$slice2 = slicedToArray(_self$_queue$slice, 1), args = _self$_queue$slice2[0];
	                self._queue.shift();
	                _args2 = slicedToArray(args, 1), proposal = _args2[0];
	                proposal.__rendering = self._rendering;
	                _context2.next = 8;
	                return present.apply(void 0, toConsumableArray(args));
	              case 8:
	                self._rendering = false;
	              case 9:
	              case "end":
	                return _context2.stop();
	            }
	          }
	        }, _callee2);
	      })), synchronizeInterval);
	      return function () {
	        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
	          args[_key] = arguments[_key];
	        }
	        return queue.add(args);
	      };
	    },
	    clear: function clear() {
	      clearInterval(this._interval);
	    }
	  };
	  var present = synchronize ? (/*#__PURE__*/function () {
	    var _ref6 = asyncToGenerator(/*#__PURE__*/regenerator.mark(function _callee3(proposal, resolve) {
	      return regenerator.wrap(function _callee3$(_context3) {
	        while (1) {
	          switch (_context3.prev = _context3.next) {
	            case 0:
	              if (!checkForOutOfOrder(proposal)) {
	                _context3.next = 13;
	                break;
	              }
	              model.resetEventQueue();
	              // accept proposal
	              _context3.t0 = Promise;
	              _context3.t1 = acceptors;
	              _context3.next = 6;
	              return accept(proposal);
	            case 6:
	              _context3.t2 = _context3.sent;
	              _context3.t3 = _context3.t1.map.call(_context3.t1, _context3.t2);
	              _context3.next = 10;
	              return _context3.t0.all.call(_context3.t0, _context3.t3);
	            case 10:
	              storeBehavior(proposal);

	              // Continue to state representation
	              state();
	              resolve && resolve();
	            case 13:
	            case "end":
	              return _context3.stop();
	          }
	        }
	      }, _callee3);
	    }));
	    return function (_x2, _x3) {
	      return _ref6.apply(this, arguments);
	    };
	  }()) : function (proposal, resolve) {
	    if (checkForOutOfOrder(proposal)) {
	      // accept proposal
	      acceptors.forEach(accept(proposal));
	      storeBehavior(proposal);

	      // Continue to state representation
	      state();
	      resolve && resolve();
	    }
	  };
	  if (synchronize) {
	    present = queue.synchronize(present);
	  }

	  // SAM's internal acceptors
	  var addInitialState = function addInitialState() {
	    var initialState = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
	    model.update(initialState);
	    if (history) {
	      history.snap(model, 0);
	    }
	    model.resetBehavior();
	  };

	  // eslint-disable-next-line no-shadow
	  var rollback = function rollback() {
	    var conditions = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
	    return conditions.map(function (condition) {
	      return function (model) {
	        return function () {
	          var isNotSafe = condition.expression(model);
	          if (isNotSafe) {
	            model.log({
	              error: {
	                name: condition.name,
	                model: model
	              }
	            });
	            // rollback if history is present
	            if (history) {
	              model.update(history.last());
	              renderView(model);
	            }
	            return true;
	          }
	          return false;
	        };
	      };
	    });
	  };
	  var isAllowed = function isAllowed(action) {
	    return (!model.__blockUnexpectedActions && model.allowedActions().length === 0 || model.allowedActions().map(function (a) {
	      return typeof a === 'string' ? a === action.__actionName : a === action;
	    }).reduce(or, false)) && !model.disallowedActions().map(function (a) {
	      return typeof a === 'string' ? a === action.__actionName : a === action;
	    }).reduce(or, false);
	  };
	  var acceptLocalState = function acceptLocalState(component) {
	    if (component.name != null) {
	      model.setComponentState(component);
	    }
	  };

	  // add one component at a time, returns array of intents from actions
	  var addComponent = function addComponent() {
	    var _intents;
	    var component = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
	    var _ref7 = component.options || {},
	      _ref7$ignoreOutdatedP = _ref7.ignoreOutdatedProposals,
	      ignoreOutdatedProposals = _ref7$ignoreOutdatedP === void 0 ? false : _ref7$ignoreOutdatedP,
	      _ref7$debounce = _ref7.debounce,
	      debounce = _ref7$debounce === void 0 ? 0 : _ref7$debounce,
	      retry = _ref7.retry;
	    if (retry) {
	      retry.retryMax = NZ(retry.retryMax);
	      retry.retryDelay = N(retry.retryDelay);
	    }
	    var debounceDelay = debounce;

	    // Add component's private state
	    acceptLocalState(component);

	    // Clean up old intents to prevent memory leaks
	    if ((_intents = intents) !== null && _intents !== void 0 && _intents.length) {
	      intents.length = 0;
	    }

	    // Decorate actions to present proposal to the model
	    if (hasAsyncActions) {
	      var _component$actions;
	      intents = (_component$actions = component.actions) === null || _component$actions === void 0 ? void 0 : _component$actions.map(function (action) {
	        var needsDebounce = false;
	        var retryCount = 0;
	        if (_typeof_1(action) === 'object') {
	          var label = action.label || action[0];
	          var smId = E(action) && E(action[2]) ? action[2].id : undefined;
	          action = action.action || action[1];
	          action.__actionName = label;
	          action.__stateMachineId = smId;
	        }
	        var intent = /*#__PURE__*/function () {
	          var _ref8 = asyncToGenerator(/*#__PURE__*/regenerator.mark(function _callee4() {
	            var _len2,
	              args,
	              _key2,
	              startTime,
	              _args$,
	              proposal,
	              _args5 = arguments;
	            return regenerator.wrap(function _callee4$(_context4) {
	              while (1) {
	                switch (_context4.prev = _context4.next) {
	                  case 0:
	                    for (_len2 = _args5.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
	                      args[_key2] = _args5[_key2];
	                    }
	                    startTime = new Date().getTime();
	                    if (!isAllowed(action)) {
	                      _context4.next = 43;
	                      break;
	                    }
	                    if (!(debounceDelay > 0 && needsDebounce)) {
	                      _context4.next = 6;
	                      break;
	                    }
	                    needsDebounce = !((_args$ = args[0]) !== null && _args$ !== void 0 && _args$.__resetDebounce);
	                    return _context4.abrupt("return");
	                  case 6:
	                    proposal = {};
	                    _context4.prev = 7;
	                    _context4.next = 10;
	                    return action.apply(void 0, args);
	                  case 10:
	                    proposal = _context4.sent;
	                    proposal.__actionName = action.__actionName;
	                    proposal.__stateMachineId = action.__stateMachineId;
	                    _context4.next = 30;
	                    break;
	                  case 15:
	                    _context4.prev = 15;
	                    _context4.t0 = _context4["catch"](7);
	                    if (!retry) {
	                      _context4.next = 25;
	                      break;
	                    }
	                    retryCount += 1;
	                    if (!(retryCount < retry.retryMax)) {
	                      _context4.next = 22;
	                      break;
	                    }
	                    setTimeout(function () {
	                      return intent.apply(void 0, args);
	                    }, retry.retryDelay);
	                    return _context4.abrupt("return");
	                  case 22:
	                    present({
	                      __error: _context4.t0
	                    });
	                    retryCount = 0;
	                    return _context4.abrupt("return");
	                  case 25:
	                    if (!(_context4.t0.name !== 'AssertionError')) {
	                      _context4.next = 29;
	                      break;
	                    }
	                    proposal.__error = _context4.t0;
	                    _context4.next = 30;
	                    break;
	                  case 29:
	                    throw _context4.t0;
	                  case 30:
	                    if (ignoreOutdatedProposals) {
	                      proposal.__startTime = startTime;
	                    }
	                    _context4.prev = 31;
	                    if (isAllowed(action)) {
	                      present(proposal);
	                      retryCount = 0;
	                    }
	                    _context4.next = 42;
	                    break;
	                  case 35:
	                    _context4.prev = 35;
	                    _context4.t1 = _context4["catch"](31);
	                    if (!(_context4.t1.name !== 'AssertionError')) {
	                      _context4.next = 41;
	                      break;
	                    }
	                    present({
	                      __error: _context4.t1
	                    });
	                    _context4.next = 42;
	                    break;
	                  case 41:
	                    throw _context4.t1;
	                  case 42:
	                    if (debounceDelay > 0) {
	                      needsDebounce = true;
	                      setTimeout(function () {
	                        return intent({
	                          __resetDebounce: true
	                        });
	                      }, debounceDelay);
	                    }
	                  case 43:
	                  case "end":
	                    return _context4.stop();
	                }
	              }
	            }, _callee4, null, [[7, 15], [31, 35]]);
	          }));
	          return function intent() {
	            return _ref8.apply(this, arguments);
	          };
	        }();
	        intent.__actionName = action.__actionName;
	        intent.__stateMachineId = action.__stateMachineId;
	        return intent;
	      });
	    } else {
	      var _intents2, _component$actions2;
	      // Clean up old intents to prevent memory leaks
	      if ((_intents2 = intents) !== null && _intents2 !== void 0 && _intents2.length) {
	        intents.length = 0;
	      }
	      intents = (_component$actions2 = component.actions) === null || _component$actions2 === void 0 ? void 0 : _component$actions2.map(function (action) {
	        return function () {
	          try {
	            if (isAllowed(action)) {
	              var proposal = action.apply(void 0, arguments);
	              present(proposal);
	            } else {
	              present({
	                __error: "unexpected action ".concat(action.__actionName || '')
	              });
	            }
	          } catch (err) {
	            if (err.name !== 'AssertionError') {
	              present({
	                __error: err
	              });
	            } else {
	              throw err;
	            }
	          }
	        };
	      });
	    }

	    // Add component's acceptors,  reactors, naps and safety condition to SAM instance
	    mount(acceptors, component.acceptors, component.localState);
	    mount(reactors, component.reactors, component.localState);
	    mount(naps, rollback(component.safety), component.localState);
	    mount(naps, component.naps, component.localState);
	  };
	  var setRender = function setRender(render) {
	    var flushEventsAndRender = function flushEventsAndRender(m) {
	      m.flush && m.flush();
	      render && render(m);
	    };
	    renderView = history ? wrap(flushEventsAndRender, function (s) {
	      return history ? history.snap(s) : s;
	    }) : flushEventsAndRender;
	    _render = render;
	  };
	  var setLogger = function setLogger(l) {
	    model.setLogger(l);
	  };
	  var setHistory = function setHistory(h) {
	    history = new History(h, {
	      max: max
	    });
	    model.hasNext(history.hasNext());
	    model.resetBehavior();
	    renderView = wrap(_render, function (s) {
	      return history ? history.snap(s) : s;
	    });
	  };
	  var timetravel = function timetravel() {
	    var travel = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
	    var travelTo = {};
	    if (E(history)) {
	      if (travel.reset) {
	        travel.index = 0;
	        model.__behavior = [];
	      }
	      if (travel.next) {
	        travelTo = history.next();
	      } else if (travel.endOfTime) {
	        travelTo = history.last();
	      } else {
	        travelTo = history.travel(travel.index);
	      }
	    }
	    renderView(Object.assign({}, model, travelTo));
	  };
	  var setCheck = function setCheck(_ref9) {
	    var _ref9$begin = _ref9.begin,
	      begin = _ref9$begin === void 0 ? {} : _ref9$begin,
	      end = _ref9.end;
	    var render = begin.render;
	    if (E(render)) {
	      storeRenderView = renderView;
	      renderView = render;
	    }
	    if (E(end)) {
	      renderView = storeRenderView;
	    }
	  };
	  var allowedActions = function allowedActions(_ref0) {
	    var _ref0$actions = _ref0.actions,
	      actions = _ref0$actions === void 0 ? [] : _ref0$actions,
	      _ref0$clear = _ref0.clear,
	      clear = _ref0$clear === void 0 ? false : _ref0$clear;
	    if (clear) {
	      model.clearAllowedActions();
	    }
	    if (actions.length > 0) {
	      model.addAllowedActions(actions);
	    }
	    return model.__allowedActions;
	  };
	  var addEventHandler = function addEventHandler(_ref1) {
	    var _ref10 = slicedToArray(_ref1, 2),
	      event = _ref10[0],
	      handler = _ref10[1];
	    return events.on(event, handler);
	  };

	  // SAM's internal present function
	  return function (_ref11) {
	    var initialState = _ref11.initialState,
	      component = _ref11.component,
	      render = _ref11.render,
	      history = _ref11.history,
	      travel = _ref11.travel,
	      logger = _ref11.logger,
	      check = _ref11.check,
	      allowed = _ref11.allowed,
	      clearInterval = _ref11.clearInterval,
	      event = _ref11.event;
	    intents = [];
	    on(history, setHistory).on(initialState, addInitialState).on(component, addComponent).on(render, setRender).on(travel, timetravel).on(logger, setLogger).on(check, setCheck).on(allowed, allowedActions).on(clearInterval, function () {
	      return queue.clear();
	    }).on(event, addEventHandler);
	    return {
	      hasNext: model.hasNext(),
	      hasError: model.hasError(),
	      errorMessage: model.errorMessage(),
	      error: model.error(),
	      intents: intents,
	      state: function state(name) {
	        return model.state(name, clone);
	      },
	      dispose: function dispose() {
	        return synchronize && queue.clear();
	      }
	    };
	  };
	}

	// ISC License (ISC)
	var SAM = createInstance();

	// A set of methods to use the SAM pattern
	var api = (function () {
	  var SAM$1 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : SAM;
	  return {
	    // Core SAM API
	    addInitialState: function addInitialState(initialState) {
	      return SAM$1({
	        initialState: initialState
	      });
	    },
	    addComponent: function addComponent(component) {
	      return SAM$1({
	        component: component
	      });
	    },
	    setRender: function setRender(render) {
	      if (Array.isArray(render)) {
	        var _render = render,
	          _render2 = slicedToArray(_render, 2),
	          display = _render2[0],
	          representation = _render2[1];
	        render = function render(state) {
	          return display(typeof representation === 'function' ? representation(state) : state);
	        };
	      }
	      SAM$1({
	        render: render !== null && render !== void 0 ? render : function () {
	          return null;
	        }
	      });
	    },
	    addHandler: function addHandler(event, handler) {
	      return SAM$1({
	        event: [event, handler]
	      });
	    },
	    getIntents: function getIntents(actions) {
	      return SAM$1({
	        component: {
	          actions: actions
	        }
	      });
	    },
	    addAcceptors: function addAcceptors(acceptors, privateModel) {
	      return SAM$1({
	        component: {
	          acceptors: acceptors,
	          privateModel: privateModel
	        }
	      });
	    },
	    addReactors: function addReactors(reactors, privateModel) {
	      return SAM$1({
	        component: {
	          reactors: reactors,
	          privateModel: privateModel
	        }
	      });
	    },
	    addNAPs: function addNAPs(naps, privateModel) {
	      return SAM$1({
	        component: {
	          naps: naps,
	          privateModel: privateModel
	        }
	      });
	    },
	    addSafetyConditions: function addSafetyConditions(safety, privateModel) {
	      return SAM$1({
	        component: {
	          safety: safety,
	          privateModel: privateModel
	        }
	      });
	    },
	    hasError: function hasError() {
	      return SAM$1({}).hasError;
	    },
	    allow: function allow(actions) {
	      return SAM$1({
	        allowed: {
	          actions: actions
	        }
	      });
	    },
	    clearAllowedActions: function clearAllowedActions() {
	      return SAM$1({
	        allowed: {
	          clear: true
	        }
	      });
	    },
	    allowedActions: function allowedActions() {
	      return SAM$1({
	        allowed: {}
	      });
	    },
	    // Time Travel
	    addTimeTraveler: function addTimeTraveler() {
	      var history = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
	      return SAM$1({
	        history: history
	      });
	    },
	    travel: function travel() {
	      var index = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
	      return SAM$1({
	        travel: {
	          index: index
	        }
	      });
	    },
	    next: function next() {
	      return SAM$1({
	        travel: {
	          next: true
	        }
	      });
	    },
	    last: function last() {
	      return SAM$1({
	        travel: {
	          endOfTime: true
	        }
	      });
	    },
	    hasNext: function hasNext() {
	      return SAM$1({}).hasNext;
	    },
	    reset: function reset(initialState) {
	      return initialState ? SAM$1({
	        initialState: initialState
	      }) : SAM$1({
	        travel: {
	          reset: true
	        }
	      });
	    },
	    // Checker
	    beginCheck: function beginCheck(render) {
	      return SAM$1({
	        check: {
	          begin: {
	            render: render
	          }
	        }
	      });
	    },
	    endCheck: function endCheck() {
	      return SAM$1({
	        check: {
	          end: true
	        }
	      });
	    }
	  };
	});

	// Cache for memoization
	var permutationCache = new Map();
	var getCacheKey = function getCacheKey(arr, perms, currentDepth, depthMax, noDuplicateAction, doNotStartWith) {
	  return JSON.stringify({
	    arrLength: arr.length,
	    permsLength: perms.length,
	    currentDepth: currentDepth,
	    depthMax: depthMax,
	    noDuplicateAction: noDuplicateAction,
	    doNotStartWith: doNotStartWith.join(',')
	  });
	};
	var permutations = function permutations(arr, perms, currentDepth, depthMax, noDuplicateAction, doNotStartWith) {
	  // Early termination for common cases
	  if (arr.length === 0 || depthMax <= 0) {
	    return [];
	  }

	  // Check cache first
	  var cacheKey = getCacheKey(arr, perms, currentDepth, depthMax, noDuplicateAction, doNotStartWith);
	  if (permutationCache.has(cacheKey)) {
	    return permutationCache.get(cacheKey);
	  }
	  var nextLevel = [];

	  // Optimized first level handling
	  if (perms.length === 0) {
	    if (doNotStartWith.length > 0) {
	      // Use filter for better performance with large arrays
	      nextLevel.push.apply(nextLevel, toConsumableArray(arr.filter(function (i) {
	        return !doNotStartWith.includes(i.name);
	      }).map(function (i) {
	        return [i];
	      })));
	    } else {
	      // Simple case - just map to arrays
	      nextLevel.push.apply(nextLevel, toConsumableArray(arr.map(function (i) {
	        return [i];
	      })));
	    }

	    // Early termination if we've reached max depth
	    if (currentDepth + 1 >= depthMax) {
	      var _result = nextLevel.filter(function (run) {
	        return run.length === depthMax;
	      });
	      permutationCache.set(cacheKey, _result);
	      return _result;
	    }
	  } else {
	    // Optimized permutation building
	    perms.forEach(function (p) {
	      var lastInPerm = p[p.length - 1];
	      arr.forEach(function (i) {
	        if (noDuplicateAction && lastInPerm === i) {
	          return; // Skip duplicates
	        }
	        nextLevel.push(p.concat([i]));
	      });
	    });
	  }
	  currentDepth++;

	  // Recursive call with memoization
	  if (currentDepth < depthMax) {
	    var _result2 = permutations(arr, nextLevel, currentDepth, depthMax, noDuplicateAction, doNotStartWith);
	    permutationCache.set(cacheKey, _result2);
	    return _result2;
	  }
	  var result = nextLevel.filter(function (run) {
	    return run.length === depthMax;
	  });
	  permutationCache.set(cacheKey, result);
	  return result;
	};
	var prepareValuePermutations = function prepareValuePermutations(permutation) {
	  var indexMax = permutation.map(function (intent) {
	    var _intent$values$length, _intent$values;
	    return (_intent$values$length = intent === null || intent === void 0 || (_intent$values = intent.values) === null || _intent$values === void 0 ? void 0 : _intent$values.length) !== null && _intent$values$length !== void 0 ? _intent$values$length : 0;
	  });
	  var modMax = indexMax.map(function (val, index) {
	    var out = 1;
	    for (var j = index; j < indexMax.length; j++) {
	      out *= indexMax[j];
	    }
	    return out;
	  });
	  var increment = function increment(currentIndex) {
	    return modMax.map(function (m, index) {
	      if (index === modMax.length - 1) {
	        return currentIndex % indexMax[index];
	      }
	      return Math.floor(currentIndex / modMax[index + 1]) % indexMax[index];
	    });
	  };
	  var kmax = indexMax.reduce(function (acc, val) {
	    return acc * val;
	  }, 1);
	  if (kmax === 0) {
	    var _error$originalError;
	    var error = standardizeError(['Checker: invalid dataset, one of the intents values has no value.', 'If an intent has no parameter, add an empty array to its values'].join('\n'), 'CHECKER_VALIDATION', 'VALIDATION_ERROR');
	    throw (_error$originalError = error.originalError) !== null && _error$originalError !== void 0 ? _error$originalError : new Error(error.message);
	  }
	  return {
	    increment: increment,
	    kmax: kmax
	  };
	};
	var apply = function apply() {
	  var perms = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
	  var resetState = arguments.length > 1 ? arguments[1] : undefined;
	  var setBehavior = arguments.length > 2 ? arguments[2] : undefined;
	  perms.forEach(function (permutation) {
	    var k = 0;
	    var _prepareValuePermutat = prepareValuePermutations(permutation),
	      increment = _prepareValuePermutat.increment,
	      kmax = _prepareValuePermutat.kmax;
	    var _loop = function _loop() {
	      // Process a permutation for all possible values
	      var currentValueIndex = increment(k++);
	      var currentValues = permutation.map(function (i, forIntent) {
	        return i.values[currentValueIndex[forIntent]];
	      });
	      // return to initial state
	      resetState();
	      setBehavior([]);

	      // apply behavior (intent(...values))
	      permutation.forEach(function (i, forIntent) {
	        return i.intent.apply(i, toConsumableArray(currentValues[forIntent]));
	      });
	    };
	    do {
	      _loop();
	    } while (k < kmax);
	  });
	};
	var checker = function checker(_ref) {
	  var instance = _ref.instance,
	    _ref$initialState = _ref.initialState,
	    initialState = _ref$initialState === void 0 ? {} : _ref$initialState,
	    _ref$intents = _ref.intents,
	    intents = _ref$intents === void 0 ? [] : _ref$intents,
	    reset = _ref.reset,
	    liveness = _ref.liveness,
	    safety = _ref.safety,
	    options = _ref.options;
	  var success = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : function () {
	    return null;
	  };
	  var err = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : function () {
	    return null;
	  };
	  var _api = api(instance),
	    beginCheck = _api.beginCheck,
	    endCheck = _api.endCheck;
	  var _options$depthMax = options.depthMax,
	    depthMax = _options$depthMax === void 0 ? 5 : _options$depthMax,
	    _options$noDuplicateA = options.noDuplicateAction,
	    noDuplicateAction = _options$noDuplicateA === void 0 ? false : _options$noDuplicateA,
	    _options$doNotStartWi = options.doNotStartWith,
	    doNotStartWith = _options$doNotStartWi === void 0 ? [] : _options$doNotStartWi,
	    format = options.format;
	  var _instance$intents = slicedToArray(instance({
	      component: {
	        actions: [function (__behavior) {
	          return {
	            __behavior: __behavior
	          };
	        }, function (__setFormatBehavior) {
	          return {
	            __setFormatBehavior: __setFormatBehavior
	          };
	        }],
	        acceptors: [function (model) {
	          return function (_ref2) {
	            var __behavior = _ref2.__behavior;
	            if (__behavior != null) {
	              model.__behavior = __behavior;
	            }
	          };
	        }, function (model) {
	          return function (_ref3) {
	            var __setFormatBehavior = _ref3.__setFormatBehavior;
	            if (__setFormatBehavior != null) {
	              model.__formatBehavior = __setFormatBehavior;
	            }
	          };
	        }]
	      }
	    }).intents, 2),
	    behaviorIntent = _instance$intents[0],
	    formatIntent = _instance$intents[1];
	  formatIntent(format);
	  var behavior = [];
	  beginCheck(function (state) {
	    if (liveness && liveness(state)) {
	      // console.log('check check', state)
	      behavior.push({
	        liveness: state.__behavior
	      });
	      success(state.__behavior);
	    }
	    if (safety && safety(state)) {
	      behavior.push({
	        safety: state.__behavior
	      });
	      err(state.__behavior);
	    }
	  });
	  apply(permutations(intents, [], 0, depthMax, noDuplicateAction, doNotStartWith), function () {
	    return reset(initialState);
	  }, behaviorIntent);
	  endCheck();
	  return behavior;
	};

	// ISC License (ISC)
	var _api = api(),
	  addInitialState = _api.addInitialState,
	  addComponent = _api.addComponent,
	  setRender = _api.setRender,
	  addSafetyConditions = _api.addSafetyConditions,
	  getIntents = _api.getIntents,
	  addAcceptors = _api.addAcceptors,
	  addReactors = _api.addReactors,
	  addNAPs = _api.addNAPs,
	  addHandler = _api.addHandler;
	var index = {
	  // Constructors
	  SAM: SAM,
	  createInstance: createInstance,
	  api: api,
	  // SAM Core
	  addInitialState: addInitialState,
	  addComponent: addComponent,
	  addAcceptors: addAcceptors,
	  addReactors: addReactors,
	  addNAPs: addNAPs,
	  addSafetyConditions: addSafetyConditions,
	  getIntents: getIntents,
	  setRender: setRender,
	  addHandler: addHandler,
	  // Utils
	  step: step,
	  doNotRender: doNotRender,
	  first: first,
	  match: match,
	  on: on,
	  oneOf: oneOf,
	  utils: {
	    O: O,
	    A: A,
	    N: N,
	    NZ: NZ,
	    S: S,
	    F: F,
	    E: E,
	    or: or,
	    and: and,
	    log: log
	  },
	  events: {
	    on: events.on,
	    off: events.off,
	    emit: events.emit
	  },
	  checker: checker,
	  permutations: permutations,
	  apply: apply,
	  Model: Model
	};

	return index;

}));
