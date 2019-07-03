"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.first = exports.step = exports.match = exports.and = exports.or = exports.oneOf = exports.on = exports.E = exports.F = exports.NZ = exports.N = exports.S = exports.A = exports.O = void 0;

var _typeof2 = _interopRequireDefault(require("@babel/runtime/helpers/typeof"));

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
// Optional chaining implementation
var O = function O(val) {
  var value = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  return val && (0, _typeof2["default"])(val) === 'object' ? val : value;
};

exports.O = O;

var A = function A(val) {
  var value = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
  return val && Array.isArray(val) ? val : value;
};

exports.A = A;

var S = function S(val) {
  var value = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
  return val && typeof val === 'string' ? val : value;
};

exports.S = S;

var N = function N(val) {
  var value = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
  return isNaN(val) ? value : val;
};

exports.N = N;

var NZ = function NZ(val) {
  var value = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1;
  return val === 0 || isNaN(val) ? value === 0 ? 1 : value : val;
};

exports.NZ = NZ;

var F = function F(f) {
  var f0 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : function () {
    return null;
  };
  return f ? f : f0;
}; // Util functions often used in SAM implementations


exports.F = F;

var e = function e(value) {
  return Array.isArray(value) ? value.map(e).reduce(and) : value === true || value !== null && value !== undefined;
};

var i = function i(value, element) {
  switch ((0, _typeof2["default"])(value)) {
    case 'string':
      return typeof element === 'string' && value.includes(element);

    case 'object':
      return Array.isArray(value) ? value.includes(element) : typeof element === 'string' && e(value[element]);
  }

  return value === element;
};

var E = function E(value, element) {
  return e(value) && e(element) ? i(value, element) : e(value);
};

exports.E = E;

var oneOf = function oneOf(value, f) {
  e(value) && f(value);
  return mon(e(value));
};

exports.oneOf = oneOf;

var on = function on(value, f) {
  e(value) && f(value);
  return {
    on: on
  };
};

exports.on = on;

var mon = function mon() {
  var triggered = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
  return {
    oneOf: triggered ? function (value, f) {
      return mon();
    } : oneOf
  };
};

var first = function first() {
  var arr = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
  return arr[0];
};

exports.first = first;

var or = function or(acc, current) {
  return acc || current;
};

exports.or = or;

var and = function and(acc, current) {
  return acc && current;
};

exports.and = and;

var match = function match(conditions, values) {
  return first(conditions.map(function (condition, index) {
    return condition ? values[index] : null;
  }).filter(e));
};

exports.match = match;

var step = function step() {
  return {};
};

exports.step = step;
//# sourceMappingURL=sam-utils.js.map