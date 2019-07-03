(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = global || self, global.tp = factory());
}(this, function () { 'use strict';

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
    const O = (val, value = {}) => val && (typeof val === 'object') ? val : value;
    const A = (val, value = []) => val && Array.isArray(val) ? val : value;
    const S = (val, value = '') => val && (typeof val === 'string') ? val : value;
    const N = (val, value = 0) => isNaN(val) ? value : val;
    const NZ = (val, value = 1) => val === 0 || isNaN(val) ? value === 0 ? 1 : value : val;
    const F = (f, f0 = () => null) => f ? f : f0;

    // Util functions often used in SAM implementations
    const e = value => Array.isArray(value) 
        ? value.map(e).reduce(and)
        : value === true || (value !== null && value !== undefined);

    const i = (value, element) => {
        switch(typeof value) {
            case 'string': return typeof element === 'string' && value.includes(element)
            case 'object': return Array.isArray(value) 
                ? value.includes(element)
                : typeof element === 'string' && e(value[element])
        }
        return value === element
    };

    const E = (value, element) => 
        e(value) && e(element) 
        ? i(value,element)
        : e(value);

    const oneOf = (value, f) => { 
        e(value) && f(value); 
        return mon(e(value)) 
    };

    const on = (value, f) => { 
        e(value) && f(value); 
        return { on }
    };

    const mon = (triggered = true) => ({
        oneOf: triggered ? (value, f) => mon() : oneOf
    });

    const first = (arr = []) => arr[0];
    const or = (acc, current) => acc || current;
    const and = (acc, current) => acc && current;
    const match = (conditions, values) => first(conditions.map((condition, index) => condition ? values[index] : null).filter(e));
    const step = () => ({});

    // ISC License (ISC)

    // This is an implementation of SAM using SAM's own principles
    // - SAM's internal model
    // - SAM's internal acceptors
    // - SAM's present function 

    function createInstance() {
        // SAM's internal model
        let intents;
        const acceptors = [];
        const reactors = [];
        const naps = [];
        
        // ancillary
        let renderView = () => null;
        const react = r => r();
        const accept = proposal => a => a(proposal);
        const mount = (arr = [], elements = [], operand = model) => elements.map(e => arr.push(e(operand)));

        // Model
        const model = {};

        const present = (proposal) => {
            // accept proposal
            acceptors.forEach(accept(proposal));

            // Continue to state representation
            state();
        };

        // State Representation
        const state = () => {
            // Compute state representation
            reactors.forEach(react);

            // render state representation (gated by nap)
            !naps.map(react).reduce(or, false) && renderView(model);
        };

        // SAM's internal acceptors
        const addInitialState = (initialState = {}) => Object.assign(model, initialState);

        // add one component at a time, returns array of intents from actions
        const addComponent = (component = {}) => {
            // Decorate actions to present proposal to the model
            // intents = A(component.actions).map(action => async (...args) => present(await action(...args)))
            intents = A(component.actions).map(action => async (...args) => present(await action(...args)));
            // Add component's acceptors,  reactors and naps to SAM
            mount(acceptors, component.acceptors, component.privateModel);
            mount(reactors, component.reactors, component.privateModel);
            mount(naps, component.naps, component.privateModel);
        };

        const setRender = render => {
            renderView = render;
        };

        // SAM's internal present function
        return ({ initialState, component, render }) => {
            intents = [];

             on(initialState,   addInitialState)
            .on(component,      addComponent)
            .on(render,         setRender);

            return {
                intents
            }
        }
    }

    // ISC License (ISC)

    const SAM = createInstance();

    // ISC License (ISC)

    // A set of methods to use the SAM pattern
    var api = (SAM$1 = SAM) => ({
        addInitialState: (initialState) => SAM$1({ initialState }),
        addComponent: (component) => SAM$1({ component }),
        setRender: render => SAM$1({ render }),
        getIntents: (actions) => SAM$1({ component: { actions }}),
        addAcceptors: (acceptors, privateModel) => SAM$1({ component: { acceptors, privateModel }}),
        addReactors: (reactors, privateModel) => SAM$1({ component: { reactors, privateModel }}),
        addNAPs: (naps, privateModel) => SAM$1({ component: { naps, privateModel }})
    });

    // ISC License (ISC)

    const { addInitialState, addComponent, setRender, 
        getIntents, addAcceptors, addReactors, addNAPs} = api;

    var index = {
        SAM,
        createInstance,
        api,
        addInitialState,
        addComponent,
        addAcceptors,
        addReactors,
        addNAPs,
        getIntents,
        setRender,
        step,
        first,
        match,
        on, 
        oneOf,
        utils: {
            O, A, N, NZ, S, F, E, or, and
        }
    };

    return index;

}));
