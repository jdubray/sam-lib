"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _samInstance = _interopRequireDefault(require("./lib/sam-instance"));

var _SAM = _interopRequireDefault(require("./lib/SAM"));

var _samActions = _interopRequireDefault(require("./lib/sam-actions"));

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
var addInitialState = _samActions["default"].addInitialState,
    addComponent = _samActions["default"].addComponent,
    setRender = _samActions["default"].setRender,
    getIntents = _samActions["default"].getIntents,
    addAcceptors = _samActions["default"].addAcceptors,
    addReactors = _samActions["default"].addReactors,
    addNAPs = _samActions["default"].addNAPs;
var _default = {
  SAM: _SAM["default"],
  createInstance: _samInstance["default"],
  api: _samActions["default"],
  addInitialState: addInitialState,
  addComponent: addComponent,
  addAcceptors: addAcceptors,
  addReactors: addReactors,
  addNAPs: addNAPs,
  getIntents: getIntents,
  setRender: setRender,
  step: _samUtils.step,
  first: _samUtils.first,
  match: _samUtils.match,
  on: _samUtils.on,
  oneOf: _samUtils.oneOf,
  utils: {
    O: _samUtils.O,
    A: _samUtils.A,
    N: _samUtils.N,
    NZ: _samUtils.NZ,
    S: _samUtils.S,
    F: _samUtils.F,
    E: _samUtils.E,
    or: _samUtils.or,
    and: _samUtils.and
  }
};
exports["default"] = _default;
//# sourceMappingURL=index.js.map