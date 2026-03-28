/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const { expect } = require('chai')

const { default: Model } = require('../lib/sam-model')

describe('Model', () => {
  describe('constructor', () => {
    it('should initialise with empty allowed/disallowed action lists', () => {
      const model = new Model('init-test')
      expect(model.allowedActions().length).to.equal(0)
      expect(model.disallowedActions().length).to.equal(0)
    })

    it('should initialise with an empty event queue', () => {
      const model = new Model('init-events')
      expect(model.__eventQueue).to.deep.equal([])
    })

    it('should initialise with an empty behavior array', () => {
      const model = new Model('init-behavior')
      expect(model.__behavior).to.deep.equal([])
    })
  })

  describe('error handling', () => {
    it('should report no error initially', () => {
      const model = new Model('error-none')
      expect(model.hasError()).to.be.false
      expect(model.error()).to.be.undefined
      expect(model.errorMessage()).to.be.undefined
    })

    it('should detect an error when __error is set', () => {
      const model = new Model('error-detect')
      model.__error = new Error('something went wrong')
      expect(model.hasError()).to.be.true
      expect(model.error()).to.be.instanceOf(Error)
      expect(model.errorMessage()).to.equal('something went wrong')
    })

    it('should clear an error with clearError()', () => {
      const model = new Model('error-clear')
      model.__error = new Error('oops')
      expect(model.hasError()).to.be.true
      model.clearError()
      expect(model.hasError()).to.be.false
      expect(model.error()).to.be.undefined
    })
  })

  describe('doNotRender / continue / renderNextTime', () => {
    it('should return false for continue() by default', () => {
      const model = new Model('continue-default')
      expect(model.continue()).to.be.false
    })

    it('should return true for continue() after doNotRender()', () => {
      const model = new Model('continue-set')
      model.doNotRender()
      expect(model.continue()).to.be.true
    })

    it('should return false for continue() after renderNextTime()', () => {
      const model = new Model('continue-reset')
      model.doNotRender()
      expect(model.continue()).to.be.true
      model.renderNextTime()
      expect(model.continue()).to.be.false
    })
  })

  describe('update()', () => {
    it('should merge properties into the model', () => {
      const model = new Model('update-merge')
      model.update({ a: 1, b: 2 })
      expect(model.a).to.equal(1)
      expect(model.b).to.equal(2)
    })

    it('should overwrite existing properties', () => {
      const model = new Model('update-overwrite')
      model.update({ x: 10 })
      model.update({ x: 99, y: 5 })
      expect(model.x).to.equal(99)
      expect(model.y).to.equal(5)
    })

    it('should handle an empty snapshot without error', () => {
      const model = new Model('update-empty')
      expect(() => model.update()).to.not.throw()
    })
  })

  describe('setComponentState() / localState()', () => {
    it('should store a component local state by name', () => {
      const model = new Model('comp-state')
      model.setComponentState({ name: 'myComp', localState: { counter: 5 } })
      expect(model.localState('myComp').counter).to.equal(5)
    })

    it('should attach a parent reference to the component local state', () => {
      const model = new Model('comp-parent')
      model.setComponentState({ name: 'child', localState: { val: 1 } })
      expect(model.localState('child').parent).to.equal(model)
    })

    it('should return an empty object for an unknown component name', () => {
      const model = new Model('comp-unknown')
      expect(model.localState('nonexistent')).to.deep.equal({})
    })

    it('should handle a component with no localState (undefined)', () => {
      const model = new Model('comp-no-state')
      model.setComponentState({ name: 'empty' })
      expect(model.localState('empty')).to.exist
    })
  })

  describe('allowedActions / disallowedActions', () => {
    it('should add and clear allowed actions', () => {
      const model = new Model('allowed')
      model.addAllowedActions('actionA')
      expect(model.allowedActions().length).to.equal(1)
      model.clearAllowedActions()
      expect(model.allowedActions().length).to.equal(0)
    })

    it('should add and clear disallowed actions', () => {
      const model = new Model('disallowed')
      model.addDisallowedActions('actionB')
      expect(model.disallowedActions().length).to.equal(1)
      model.clearDisallowedActions()
      expect(model.disallowedActions().length).to.equal(0)
    })

    it('should concatenate actions via allow()', () => {
      const model = new Model('allow-concat')
      const fn1 = () => {}
      const fn2 = () => {}
      model.allow([fn1])
      model.allow([fn2])
      expect(model.allowedActions().length).to.equal(2)
    })

    it('should support multiple calls to addAllowedActions', () => {
      const model = new Model('multi-allowed')
      model.addAllowedActions('A')
      model.addAllowedActions('B')
      expect(model.allowedActions()).to.include('A')
      expect(model.allowedActions()).to.include('B')
    })
  })

  describe('hasNext()', () => {
    it('should return undefined initially', () => {
      const model = new Model('hasnext-init')
      expect(model.hasNext()).to.be.undefined
    })

    it('should set and retrieve the hasNext flag', () => {
      const model = new Model('hasnext-set')
      model.hasNext(true)
      expect(model.hasNext()).to.be.true
      model.hasNext(false)
      expect(model.hasNext()).to.be.false
    })

    it('should not update hasNext when called with a falsy non-boolean arg', () => {
      const model = new Model('hasnext-falsy')
      model.hasNext(true)
      // calling hasNext with undefined/null should just return current value
      model.hasNext(undefined)
      expect(model.hasNext()).to.be.true
    })
  })

  describe('resetBehavior()', () => {
    it('should clear the behavior array', () => {
      const model = new Model('reset-behavior')
      model.__behavior.push('step1')
      model.__behavior.push('step2')
      model.resetBehavior()
      expect(model.__behavior).to.deep.equal([])
    })
  })

  describe('logger', () => {
    it('should invoke the error callback when logging an error', () => {
      const model = new Model('logger-error')
      let received = null
      model.setLogger({ error: v => { received = v } })
      model.log({ error: { name: 'TestError' } })
      expect(received).to.deep.equal({ name: 'TestError' })
    })

    it('should not throw when no logger is set', () => {
      const model = new Model('logger-none')
      expect(() => model.log({ error: { name: 'test' } })).to.not.throw()
    })

    it('should invoke the info callback', () => {
      const model = new Model('logger-info')
      let received = null
      model.setLogger({ info: v => { received = v } })
      model.log({ info: 'some info' })
      expect(received).to.equal('some info')
    })
  })

  describe('event queue', () => {
    it('should queue an event with prepareEvent()', () => {
      const model = new Model('event-queue')
      model.prepareEvent('myEvent', { data: 42 })
      expect(model.__eventQueue.length).to.equal(1)
      expect(model.__eventQueue[0]).to.deep.equal(['myEvent', { data: 42 }])
    })

    it('should clear the event queue with resetEventQueue()', () => {
      const model = new Model('event-reset')
      model.prepareEvent('e1', {})
      model.prepareEvent('e2', {})
      model.resetEventQueue()
      expect(model.__eventQueue.length).to.equal(0)
    })

    it('should not flush events when continue() is true (doNotRender was called)', () => {
      const model = new Model('event-flush-skip')
      model.prepareEvent('ev', { val: 1 })
      model.doNotRender()
      model.flush()
      // queue should remain because continue() === true skips flush
      expect(model.__eventQueue.length).to.equal(1)
    })

    it('should flush events when continue() is false', () => {
      const model = new Model('event-flush-ok')
      let flushed = false
      model.prepareEvent('ev', { val: 1 })
      // continue() defaults to false, so flush should emit
      // We only verify the queue is cleared after flush
      model.flush()
      expect(model.__eventQueue.length).to.equal(0)
    })
  })

  describe('state()', () => {
    it('should return a top-level property when it exists on the model', () => {
      const model = new Model('state-prop')
      model.update({ counter: 7 })
      expect(model.state('counter')).to.equal(7)
    })

    it('should return a component local state by name', () => {
      const model = new Model('state-comp')
      model.setComponentState({ name: 'widget', localState: { active: true } })
      expect(model.state('widget').active).to.be.true
    })

    it('should return the model itself when name does not match any property or component', () => {
      const model = new Model('state-fallback')
      model.update({ counter: 3 })
      expect(model.state('unknownKey')).to.equal(model)
    })

    it('should support an array of names and return corresponding values', () => {
      const model = new Model('state-array')
      model.update({ a: 1, b: 2 })
      const result = model.state(['a', 'b'])
      expect(result[0]).to.equal(1)
      expect(result[1]).to.equal(2)
    })
  })

  describe('clone()', () => {
    it('should produce a structurally equal but distinct copy', () => {
      const model = new Model('clone-basic')
      model.update({ counter: 5, nested: { value: 10 } })
      const copy = model.clone()
      expect(copy).to.not.equal(model)
      expect(copy.counter).to.equal(5)
      expect(copy.nested.value).to.equal(10)
    })

    it('should not share object references with the original', () => {
      const model = new Model('clone-refs')
      model.update({ obj: { x: 1 } })
      const copy = model.clone()
      copy.obj.x = 99
      expect(model.obj.x).to.equal(1)
    })

    it('should deep clone components and attach parent to the clone', () => {
      const model = new Model('clone-comp')
      model.setComponentState({ name: 'local', localState: { value: 7 } })
      const copy = model.clone()
      expect(copy.__components.local.value).to.equal(7)
      expect(copy.__components.local.parent).to.equal(copy)
    })

    it('should clone without circular reference issues', () => {
      const model = new Model('clone-circular')
      model.setComponentState({ name: 'c', localState: { n: 1 } })
      expect(() => model.clone()).to.not.throw()
    })
  })
})
