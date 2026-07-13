/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const { expect } = require('chai')

const { default: createInstance } = require('../../lib/sam-instance')

/**
 * Captures console.warn output for the duration of a test.
 * @returns {{ messages: string[], restore: function(): void }}
 */
const stubWarn = () => {
  const messages = []
  const original = console.warn
  console.warn = (...args) => messages.push(args.join(' '))
  return { messages, restore: () => { console.warn = original } }
}

/**
 * A clock in the v1 rejection idiom: invalid transitions record model.__error
 * (the sam-fsm default path) instead of calling reject(). Issue #31 unifies
 * this with v2 rejections in the step classifier.
 */
const v1StyleClock = (name) => {
  const instance = createInstance({ strict: true, instanceName: name })
  const control = instance({
    initialState: { pc: 'TICKED' },
    component: {
      modelShape: { pc: { type: 'string' } },
      actions: {
        TICK: () => ({ tick: true }),
        TOCK: () => ({ tock: true })
      },
      acceptors: [
        model => ({ tick, tock }) => {
          if (tick) {
            if (model.pc === 'TICKED') {
              model.__error = 'unexpected action TICK for state: TICKED'
              return
            }
            model.pc = 'TICKED'
          }
          if (tock) {
            if (model.pc === 'TOCKED') {
              model.__error = 'unexpected action TOCK for state: TOCKED'
              return
            }
            model.pc = 'TOCKED'
          }
        }
      ]
    }
  })
  return { instance, control }
}

describe('v2 — error-slot writes classify as rejected (#31)', () => {
  it('should classify a v1-style __error write as rejected with the error text as reason', async () => {
    const { instance, control } = v1StyleClock('v2errRejected')
    const warn = stubWarn()
    try {
      await control.intents.TICK() // invalid from TICKED
    } finally {
      warn.restore()
    }
    const step = instance({}).lastStep()
    expect(step.classification).to.equal('rejected')
    expect(step.rejections).to.deep.equal([
      { intent: 'TICK', reason: 'unexpected action TICK for state: TICKED' }
    ])
    expect(warn.messages.join(' ')).to.not.include('unhandled proposal')
    expect(instance({}).state('pc')).to.equal('TICKED')
  })

  it('should classify mutated when a step writes __error AND mutates observable state', async () => {
    const instance = createInstance({ strict: true, instanceName: 'v2errMutated' })
    const control = instance({
      initialState: { count: 0 },
      component: {
        modelShape: { count: { type: 'number' } },
        actions: { Increment: () => ({ increment: 1 }) },
        acceptors: [
          model => ({ increment }) => {
            if (increment != null) {
              model.count += increment
              model.__error = 'partial acceptance note'
            }
          }
        ]
      }
    })
    await control.intents.Increment()
    const step = instance({}).lastStep()
    expect(step.classification).to.equal('mutated')
    expect(step.rejections).to.deep.equal([])
    // the error remains readable in the slot
    expect(instance({}).hasError).to.equal(true)
  })

  it('should use the message of Error objects as the rejection reason', async () => {
    const instance = createInstance({ strict: true, instanceName: 'v2errObject' })
    const control = instance({
      initialState: { pc: 'TICKED' },
      component: {
        modelShape: { pc: { type: 'string' } },
        actions: { TICK: () => ({ tick: true }) },
        acceptors: [
          model => ({ tick }) => {
            if (tick) {
              model.__error = new Error('guard refused the proposal')
            }
          }
        ]
      }
    })
    await control.intents.TICK()
    const step = instance({}).lastStep()
    expect(step.classification).to.equal('rejected')
    expect(step.rejections[0].reason).to.equal('guard refused the proposal')
  })

  it('should still classify a true no-op (no write, no reject, no error) as unhandled', async () => {
    const instance = createInstance({ strict: true, instanceName: 'v2errNoop' })
    const control = instance({
      initialState: { count: 0 },
      component: {
        modelShape: { count: { type: 'number' } },
        actions: { Noop: () => ({ noop: true }) },
        acceptors: [() => () => null]
      }
    })
    const warn = stubWarn()
    try {
      await control.intents.Noop()
    } finally {
      warn.restore()
    }
    expect(instance({}).lastStep().classification).to.equal('unhandled')
    expect(warn.messages.join(' ')).to.include('unhandled proposal')
  })

  it('should not re-classify later steps from a stale error left in the slot', async () => {
    const { instance, control } = v1StyleClock('v2errStale')
    await control.intents.TICK() // rejected, __error set and left in the slot
    await control.intents.TOCK() // valid transition, does not clear __error
    const step = instance({}).lastStep()
    expect(step.classification).to.equal('mutated')
    expect(step.rejections).to.deep.equal([])
  })
})
