const { expect } = require('chai')
const { events } = require('../dist/SAM')

describe('Event Handler Race Condition Fix', () => {
  it('should correctly remove multiple handlers without race conditions', () => {
    const results = []
    const handler1 = () => results.push(1)
    const handler2 = () => results.push(2)
    const handler3 = () => results.push(3)
    
    // Add multiple handlers
    events.on('test', handler1)
    events.on('test', handler2)
    events.on('test', handler3)
    
    // Emit to verify all handlers are called
    events.emit('test', 'data')
    expect(results).to.deep.equal([1, 2, 3])
    
    // Clear results and remove middle handler
    results.length = 0
    events.off('test', handler2)
    
    // Emit again - should only call handler1 and handler3
    events.emit('test', 'data')
    expect(results).to.deep.equal([1, 3])
    
    // Remove first handler
    results.length = 0
    events.off('test', handler1)
    
    // Should only call handler3
    events.emit('test', 'data')
    expect(results).to.deep.equal([3])
    
    // Remove last handler
    results.length = 0
    events.off('test', handler3)
    
    // Should call no handlers
    events.emit('test', 'data')
    expect(results).to.deep.equal([])
  })

  it('should handle removing non-existent handler gracefully', () => {
    const handler = () => {}
    
    // Try to remove handler that was never added - should not throw
    expect(() => events.off('test', handler)).to.not.throw()
    
    // Should still be able to add and emit
    const results = []
    events.on('test', () => results.push('called'))
    events.emit('test', 'data')
    expect(results).to.deep.equal(['called'])
  })

  it('should handle removing from non-existent event gracefully', () => {
    const handler = () => {}
    
    // Try to remove from event that has no handlers - should not throw
    expect(() => events.off('non-existent', handler)).to.not.throw()
  })

  it('should maintain handler order when removing', () => {
    const results = []
    const handler1 = () => results.push(1)
    const handler2 = () => results.push(2)
    const handler3 = () => results.push(3)
    
    // Add handlers in order
    events.on('test', handler1)
    events.on('test', handler2)
    events.on('test', handler3)
    
    // Remove handler2
    events.off('test', handler2)
    
    // Emit event
    events.emit('test', 'data')
    
    // Should call remaining handlers in original order
    expect(results).to.deep.equal([1, 3])
  })

  it('should handle multiple removals correctly', () => {
    const results = []
    const handler1 = () => results.push(1)
    const handler2 = () => results.push(2)
    const handler3 = () => results.push(3)
    const handler4 = () => results.push(4)
    
    // Add multiple handlers
    events.on('test', handler1)
    events.on('test', handler2)
    events.on('test', handler3)
    events.on('test', handler4)
    
    // Remove handlers in different order
    events.off('test', handler2)  // Remove middle
    events.off('test', handler1)  // Remove first
    events.off('test', handler4)  // Remove last
    
    // Only handler3 should remain
    results.length = 0
    events.emit('test', 'data')
    expect(results).to.deep.equal([3])
  })
})