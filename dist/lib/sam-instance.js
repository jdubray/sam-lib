"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = _default;

var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));

var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));

var _samUtils = require("./sam-utils");

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
// This is an implementation of SAM using SAM's own principles
// - SAM's internal model
// - SAM's internal acceptors
// - SAM's present function 
function _default() {
  // SAM's internal model
  var intents;
  var acceptors = [];
  var reactors = [];
  var naps = []; // ancillary

  var renderView = function renderView() {
    return null;
  };

  var react = function react(r) {
    return r();
  };

  var accept = function accept(proposal) {
    return function (a) {
      return a(proposal);
    };
  };

  var mount = function mount() {
    var arr = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
    var elements = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
    var operand = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : model;
    return elements.map(function (e) {
      return arr.push(e(operand));
    });
  }; // Model


  var model = {};

  var present = function present(proposal) {
    // accept proposal
    acceptors.forEach(accept(proposal)); // Continue to state representation

    state();
  }; // State Representation


  var state = function state() {
    // Compute state representation
    reactors.forEach(react); // render state representation (gated by nap)

    !naps.map(react).reduce(_samUtils.or, false) && renderView(model);
  }; // SAM's internal acceptors


  var addInitialState = function addInitialState() {
    var initialState = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    return Object.assign(model, initialState);
  }; // add one component at a time, returns array of intents from actions


  var addComponent = function addComponent() {
    var component = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    // Decorate actions to present proposal to the model
    // intents = A(component.actions).map(action => async (...args) => present(await action(...args)))
    intents = (0, _samUtils.A)(component.actions).map(function (action) {
      return (
        /*#__PURE__*/
        (0, _asyncToGenerator2["default"])(
        /*#__PURE__*/
        _regenerator["default"].mark(function _callee() {
          var _args = arguments;
          return _regenerator["default"].wrap(function _callee$(_context) {
            while (1) {
              switch (_context.prev = _context.next) {
                case 0:
                  _context.t0 = present;
                  _context.next = 3;
                  return action.apply(void 0, _args);

                case 3:
                  _context.t1 = _context.sent;
                  return _context.abrupt("return", (0, _context.t0)(_context.t1));

                case 5:
                case "end":
                  return _context.stop();
              }
            }
          }, _callee);
        }))
      );
    }); // Add component's acceptors,  reactors and naps to SAM

    mount(acceptors, component.acceptors, component.privateModel);
    mount(reactors, component.reactors, component.privateModel);
    mount(naps, component.naps, component.privateModel);
  };

  var setRender = function setRender(render) {
    renderView = render;
  }; // SAM's internal present function


  return function (_ref2) {
    var initialState = _ref2.initialState,
        component = _ref2.component,
        render = _ref2.render;
    intents = [];
    (0, _samUtils.on)(initialState, addInitialState).on(component, addComponent).on(render, setRender);
    return {
      intents: intents
    };
  };
}
//# sourceMappingURL=sam-instance.js.map