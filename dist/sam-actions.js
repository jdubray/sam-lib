"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _SAM = _interopRequireDefault(require("./SAM"));

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
// A set of methods to use the SAM pattern
var _default = function _default() {
  var SAM = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : _SAM["default"];
  return {
    addInitialState: function addInitialState(initialState) {
      return SAM({
        initialState: initialState
      });
    },
    addComponent: function addComponent(component) {
      return SAM({
        component: component
      });
    },
    setRender: function setRender(render) {
      return SAM({
        render: render
      });
    },
    getIntents: function getIntents(actions) {
      return SAM({
        component: {
          actions: actions
        }
      });
    },
    addAcceptors: function addAcceptors(acceptors, privateModel) {
      return SAM({
        component: {
          acceptors: acceptors,
          privateModel: privateModel
        }
      });
    },
    addReactors: function addReactors(reactors, privateModel) {
      return SAM({
        component: {
          reactors: reactors,
          privateModel: privateModel
        }
      });
    },
    addNAPs: function addNAPs(naps, privateModel) {
      return SAM({
        component: {
          naps: naps,
          privateModel: privateModel
        }
      });
    }
  };
};

exports["default"] = _default;
//# sourceMappingURL=sam-actions.js.map