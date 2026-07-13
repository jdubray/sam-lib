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
 * The Polygraph repro: a turnstile whose primary control-state key is named
 * `state` — the most common field name in real state machines. Data keys must
 * never shadow the framework's own Model methods (issue #29).
 */
const turnstile = (name, options = {}) => {
  const instance = createInstance({ strict: true, instanceName: name, ...options })
  const control = instance({
    initialState: { state: 'LOCKED', coins: 0 },
    component: {
      modelShape: {
        state: { type: 'string' },
        coins: { type: 'number' }
      },
      actions: {
        Coin: () => ({ coin: true }),
        Push: () => ({ push: true })
      },
      acceptors: {
        Coin: model => (p, { reject }) => {
          if (model.state === 'UNLOCKED') return reject('already unlocked')
          model.state = 'UNLOCKED'
          model.coins += 1
          return undefined
        },
        Push: model => (p, { reject }) => {
          if (model.state === 'LOCKED') return reject('locked')
          model.state = 'LOCKED'
          return undefined
        }
      }
    }
  })
  return { instance, control }
}

describe('v2 — model data keys must not shadow Model methods (#29)', () => {
  it('should keep the state(name) accessor working with a data key named `state`', async () => {
    const { instance, control } = turnstile('v2shadowState')
    expect(control.state('state')).to.equal('LOCKED')
    await control.intents.Coin()
    expect(instance({}).state('state')).to.equal('UNLOCKED')
    expect(instance({}).state('coins')).to.equal(1)
  })

  it('should keep the no-argument state() accessor (error-slot idiom) working', async () => {
    const { instance, control } = turnstile('v2shadowAccessor')
    const modelView = instance({}).state()
    expect(modelView.state).to.equal('LOCKED')
    await control.intents.Push() // rejected: locked
    expect(instance({}).lastStep().classification).to.equal('rejected')
    expect(instance({}).hasError).to.equal(false)
  })

  it('should render and getState correctly despite the shadowing key', async () => {
    let rendered
    const instance = createInstance({ strict: true, instanceName: 'v2shadowRender' })
    const control = instance({
      initialState: { state: 'LOCKED', coins: 0 },
      component: {
        modelShape: { state: { type: 'string' }, coins: { type: 'number' } },
        actions: { Coin: () => ({ coin: true }) },
        acceptors: {
          Coin: model => () => {
            model.state = 'UNLOCKED'
            model.coins += 1
          }
        }
      },
      render: s => { rendered = s.coins }
    })
    await control.intents.Coin()
    expect(rendered).to.equal(1)
    expect(control.getState()).to.deep.equal({ state: 'UNLOCKED', coins: 1 })
    control.setState({ state: 'LOCKED', coins: 0 })
    expect(control.getState()).to.deep.equal({ state: 'LOCKED', coins: 0 })
  })

  it('should survive shadowing of other Model methods (clone, flush, continue) in cloned renders', async () => {
    let rendered
    const instance = createInstance({ strict: true, clone: true, instanceName: 'v2shadowClone' })
    const control = instance({
      initialState: {
        state: 'LOCKED', clone: 'data', flush: 'data', continue: 'data'
      },
      component: {
        modelShape: {
          state: { type: 'string' },
          clone: { type: 'string' },
          flush: { type: 'string' },
          continue: { type: 'string' }
        },
        actions: { Coin: () => ({ coin: true }) },
        acceptors: { Coin: model => () => { model.state = 'UNLOCKED' } }
      },
      render: s => { rendered = s.state }
    })
    await control.intents.Coin()
    expect(rendered).to.equal('UNLOCKED')
    expect(control.getState().clone).to.equal('data')
  })

  it('should warn at shape registration about method-name collisions in strict mode', () => {
    const warn = stubWarn()
    try {
      turnstile('v2shadowWarn')
    } finally {
      warn.restore()
    }
    const output = warn.messages.join(' ')
    expect(output).to.include("'state'")
    expect(output).to.include('getState')
  })
})
