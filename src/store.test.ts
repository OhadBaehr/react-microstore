import { describe, it, expect, vi } from 'vitest'
import {
  createStoreState,
  createPersistenceMiddleware,
  loadPersistedState,
} from './index'

// ---------------------------------------------------------------------------
// createStoreState — core
// ---------------------------------------------------------------------------
describe('createStoreState', () => {
  // -- get ------------------------------------------------------------------
  describe('get', () => {
    it('returns the initial state', () => {
      const store = createStoreState({ count: 0, name: 'Alice' })
      expect(store.get()).toEqual({ count: 0, name: 'Alice' })
    })

    it('returns a reference to the live state object', () => {
      const store = createStoreState({ x: 1 })
      const a = store.get()
      store.set({ x: 2 })
      const b = store.get()
      expect(a).toBe(b) // same object, mutated in place
      expect(b.x).toBe(2)
    })
  })

  // -- set ------------------------------------------------------------------
  describe('set', () => {
    it('updates a single key', () => {
      const store = createStoreState({ a: 1, b: 2 })
      store.set({ a: 10 })
      expect(store.get().a).toBe(10)
      expect(store.get().b).toBe(2)
    })

    it('updates multiple keys at once', () => {
      const store = createStoreState({ a: 1, b: 2, c: 3 })
      store.set({ a: 10, c: 30 })
      expect(store.get()).toEqual({ a: 10, b: 2, c: 30 })
    })

    it('skips update when value is identical (Object.is)', () => {
      const listener = vi.fn()
      const store = createStoreState({ count: 0 })
      store.subscribe(['count'], listener)

      store.set({ count: 0 })
      expect(listener).not.toHaveBeenCalled()
    })

    it('detects NaN === NaN as no change', () => {
      const listener = vi.fn()
      const store = createStoreState({ value: NaN })
      store.subscribe(['value'], listener)

      store.set({ value: NaN })
      expect(listener).not.toHaveBeenCalled()
      expect(store.get().value).toBeNaN()
    })

    it('is a no-op when called with null-ish update', () => {
      const store = createStoreState({ a: 1 })
      store.set(null as any)
      store.set(undefined as any)
      expect(store.get().a).toBe(1)
    })
  })

  // -- getKey ---------------------------------------------------------------
  describe('getKey', () => {
    it('returns the value of a single key', () => {
      const store = createStoreState({ a: 1, b: 'hello' })
      expect(store.getKey('a')).toBe(1)
      expect(store.getKey('b')).toBe('hello')
    })

    it('reflects updates made via set()', () => {
      const store = createStoreState({ x: 0 })
      store.set({ x: 42 })
      expect(store.getKey('x')).toBe(42)
    })
  })

  // -- setKey ---------------------------------------------------------------
  describe('setKey', () => {
    it('updates a single key', () => {
      const store = createStoreState({ a: 1, b: 2 })
      store.setKey('a', 10)
      expect(store.get()).toEqual({ a: 10, b: 2 })
    })

    it('fires listeners for the changed key', () => {
      const store = createStoreState({ v: 0 })
      const listener = vi.fn()
      store.subscribe(['v'], listener)

      store.setKey('v', 5)
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('does not fire listeners when value is identical', () => {
      const store = createStoreState({ v: 0 })
      const listener = vi.fn()
      store.subscribe(['v'], listener)

      store.setKey('v', 0)
      expect(listener).not.toHaveBeenCalled()
    })

    it('passes through middleware', () => {
      const store = createStoreState({ name: '' })
      store.addMiddleware((_state, update, next) => {
        if (update.name) next({ name: update.name.toUpperCase() })
        else next()
      })

      store.setKey('name', 'alice')
      expect(store.getKey('name')).toBe('ALICE')
    })

  })

  // -- merge (pure read) ----------------------------------------------------
  describe('merge', () => {
    it('returns a merged object without modifying the store', () => {
      const store = createStoreState({ user: { name: 'Alice', age: 30 } })
      const result = store.merge('user', { age: 31 })
      expect(result).toEqual({ name: 'Alice', age: 31 })
      expect(store.get().user).toEqual({ name: 'Alice', age: 30 }) // untouched
    })

    it('preserves existing properties not included in partial', () => {
      const store = createStoreState({ config: { theme: 'dark', lang: 'en', debug: false } })
      const result = store.merge('config', { lang: 'fr' })
      expect(result).toEqual({ theme: 'dark', lang: 'fr', debug: false })
      expect(store.getKey('config').lang).toBe('en') // untouched
    })

    it('does not fire listeners', () => {
      const store = createStoreState({ obj: { a: 1 } })
      const listener = vi.fn()
      store.subscribe(['obj'], listener)

      store.merge('obj', { a: 10 })
      expect(listener).not.toHaveBeenCalled()
    })
  })

  // -- mergeSet -------------------------------------------------------------
  describe('mergeSet', () => {
    it('shallow-merges and writes to the store', () => {
      const store = createStoreState({ user: { name: 'Alice', age: 30 }, count: 0 })
      store.mergeSet('user', { age: 31 })
      expect(store.get().user).toEqual({ name: 'Alice', age: 31 })
    })

    it('fires listeners for the merged key', () => {
      const store = createStoreState({ obj: { a: 1, b: 2 } })
      const listener = vi.fn()
      store.subscribe(['obj'], listener)

      store.mergeSet('obj', { a: 10 })
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('goes through middleware', () => {
      const spy = vi.fn()
      const store = createStoreState({ data: { x: 1 } })
      store.addMiddleware((_s, _u, next) => { spy(); next() })

      store.mergeSet('data', { x: 2 })
      expect(spy).toHaveBeenCalledTimes(1)
      expect(store.get().data).toEqual({ x: 2 })
    })

  })

  // -- reset ----------------------------------------------------------------
  describe('reset', () => {
    it('resets all keys to initial state', () => {
      const store = createStoreState({ a: 1, b: 'hello', c: true })
      store.set({ a: 99, b: 'world', c: false })
      store.reset()
      expect(store.get()).toEqual({ a: 1, b: 'hello', c: true })
    })

    it('resets specific keys to initial state', () => {
      const store = createStoreState({ a: 1, b: 2, c: 3 })
      store.set({ a: 10, b: 20, c: 30 })
      store.reset(['a', 'c'])
      expect(store.get()).toEqual({ a: 1, b: 20, c: 3 })
    })

    it('fires listeners for reset keys', () => {
      const store = createStoreState({ x: 0, y: 0 })
      const lx = vi.fn()
      const ly = vi.fn()
      store.subscribe(['x'], lx)
      store.subscribe(['y'], ly)

      store.set({ x: 5, y: 5 })
      lx.mockClear()
      ly.mockClear()

      store.reset(['x'])
      expect(lx).toHaveBeenCalledTimes(1)
      expect(ly).not.toHaveBeenCalled()
    })

    it('does not fire listeners when value is already at initial', () => {
      const store = createStoreState({ v: 0 })
      const listener = vi.fn()
      store.subscribe(['v'], listener)

      store.reset(['v']) // already at initial
      expect(listener).not.toHaveBeenCalled()
    })

    it('goes through middleware', () => {
      const spy = vi.fn()
      const store = createStoreState({ v: 0 })
      store.addMiddleware((_s, _u, next) => { spy(); next() })

      store.set({ v: 5 })
      spy.mockClear()

      store.reset()
      expect(spy).toHaveBeenCalledTimes(1)
      expect(store.get().v).toBe(0)
    })
  })

  // -- batch ----------------------------------------------------------------
  describe('batch', () => {
    it('defers all notifications until callback completes', () => {
      const store = createStoreState({ a: 0, b: 0 })
      const la = vi.fn()
      const lb = vi.fn()
      store.subscribe(['a'], la)
      store.subscribe(['b'], lb)

      store.batch(() => {
        store.set({ a: 1 })
        expect(la).not.toHaveBeenCalled() // not yet
        store.set({ b: 2 })
        expect(lb).not.toHaveBeenCalled() // not yet
      })

      expect(la).toHaveBeenCalledTimes(1)
      expect(lb).toHaveBeenCalledTimes(1)
    })

    it('state is updated during the batch (only notifications deferred)', () => {
      const store = createStoreState({ v: 0 })

      store.batch(() => {
        store.set({ v: 5 })
        expect(store.get().v).toBe(5) // state is live
      })
    })

    it('deduplicates notifications for the same key', () => {
      const store = createStoreState({ v: 0 })
      const listener = vi.fn()
      store.subscribe(['v'], listener)

      store.batch(() => {
        store.set({ v: 1 })
        store.set({ v: 2 })
        store.set({ v: 3 })
      })

      expect(listener).toHaveBeenCalledTimes(1) // one notification, not three
      expect(store.get().v).toBe(3)
    })

    it('nested batch calls are transparent (inner batch runs inline)', () => {
      const store = createStoreState({ a: 0, b: 0 })
      const listener = vi.fn()
      store.subscribe(['a'], listener)

      store.batch(() => {
        store.set({ a: 1 })
        store.batch(() => {
          store.set({ b: 2 })
        })
        expect(listener).not.toHaveBeenCalled() // still deferred
      })

      expect(listener).toHaveBeenCalledTimes(1) // outer batch fires it
    })

    it('fires notifications even if callback throws', () => {
      const store = createStoreState({ v: 0 })
      const listener = vi.fn()
      store.subscribe(['v'], listener)

      expect(() => {
        store.batch(() => {
          store.set({ v: 1 })
          throw new Error('oops')
        })
      }).toThrow('oops')

      expect(store.get().v).toBe(1)
      expect(listener).toHaveBeenCalledTimes(1) // finally block fired
    })

    it('works with mergeSet and setKey inside batch', () => {
      const store = createStoreState({ obj: { a: 1, b: 2 }, count: 0 })
      const lo = vi.fn()
      const lc = vi.fn()
      store.subscribe(['obj'], lo)
      store.subscribe(['count'], lc)

      store.batch(() => {
        store.mergeSet('obj', { a: 10 })
        store.setKey('count', 5)
      })

      expect(lo).toHaveBeenCalledTimes(1)
      expect(lc).toHaveBeenCalledTimes(1)
      expect(store.get().obj).toEqual({ a: 10, b: 2 })
      expect(store.get().count).toBe(5)
    })
  })

  // -- equality registry ----------------------------------------------------
  describe('equality registry', () => {
    it('skips update when registered equality returns true', () => {
      const store = createStoreState({ user: { id: 1, name: 'Alice' } })
      store.skipSetWhen('user', (prev, next) => prev.id === next.id && prev.name === next.name)

      const listener = vi.fn()
      store.subscribe(['user'], listener)

      store.set({ user: { id: 1, name: 'Alice' } }) // same content, new reference
      expect(listener).not.toHaveBeenCalled()
      expect(store.get().user).toEqual({ id: 1, name: 'Alice' })
    })

    it('applies update when registered equality returns false', () => {
      const store = createStoreState({ user: { id: 1, name: 'Alice' } })
      store.skipSetWhen('user', (prev, next) => prev.id === next.id && prev.name === next.name)

      const listener = vi.fn()
      store.subscribe(['user'], listener)

      store.set({ user: { id: 1, name: 'Bob' } })
      expect(listener).toHaveBeenCalledTimes(1)
      expect(store.get().user).toEqual({ id: 1, name: 'Bob' })
    })

    it('Object.is still catches identical references before equality fn runs', () => {
      const store = createStoreState({ count: 0 })
      const eqFn = vi.fn(() => true)
      store.skipSetWhen('count', eqFn)

      store.set({ count: 0 }) // same primitive — Object.is catches it
      expect(eqFn).not.toHaveBeenCalled()
    })

    it('mergeSet skips when equality says unchanged', () => {
      const store = createStoreState({ config: { theme: 'dark', lang: 'en' } })
      store.skipSetWhen('config', (prev, next) => prev.theme === next.theme && prev.lang === next.lang)

      const listener = vi.fn()
      store.subscribe(['config'], listener)

      store.mergeSet('config', { theme: 'dark' }) // same content
      expect(listener).not.toHaveBeenCalled()
    })

    it('mergeSet applies when equality detects change', () => {
      const store = createStoreState({ config: { theme: 'dark', lang: 'en' } })
      store.skipSetWhen('config', (prev, next) => prev.theme === next.theme && prev.lang === next.lang)

      const listener = vi.fn()
      store.subscribe(['config'], listener)

      store.mergeSet('config', { theme: 'light' })
      expect(listener).toHaveBeenCalledTimes(1)
      expect(store.get().config).toEqual({ theme: 'light', lang: 'en' })
    })

    it('removeSkipSetWhen restores default Object.is behavior', () => {
      const store = createStoreState({ user: { id: 1, name: 'Alice' } })
      store.skipSetWhen('user', (prev, next) => prev.id === next.id && prev.name === next.name)

      const listener = vi.fn()
      store.subscribe(['user'], listener)

      // With equality — skipped
      store.set({ user: { id: 1, name: 'Alice' } })
      expect(listener).not.toHaveBeenCalled()

      // Remove equality — new reference always applies
      store.removeSkipSetWhen('user')
      store.set({ user: { id: 1, name: 'Alice' } })
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('only affects the registered key, not others', () => {
      const store = createStoreState({ a: { x: 1 }, b: { x: 1 } })
      store.skipSetWhen('a', (prev, next) => prev.x === next.x)

      const la = vi.fn()
      const lb = vi.fn()
      store.subscribe(['a'], la)
      store.subscribe(['b'], lb)

      store.set({ a: { x: 1 }, b: { x: 1 } })
      expect(la).not.toHaveBeenCalled() // equality catches it
      expect(lb).toHaveBeenCalledTimes(1) // no equality — new reference triggers
    })

    it('equality fn receives prev and next values', () => {
      const store = createStoreState({ items: [1, 2, 3] })
      const eqFn = vi.fn((prev: number[], next: number[]) => prev.length === next.length)
      store.skipSetWhen('items', eqFn)

      store.set({ items: [4, 5, 6] })
      expect(eqFn).toHaveBeenCalledWith([1, 2, 3], [4, 5, 6])
      expect(store.get().items).toEqual([1, 2, 3]) // same length, equality returned true
    })
  })

  // -- subscribe ------------------------------------------------------------
  describe('subscribe', () => {
    it('fires listener when subscribed key changes', () => {
      const store = createStoreState({ a: 1, b: 2 })
      const listener = vi.fn()
      store.subscribe(['a'], listener)

      store.set({ a: 10 })
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('does not fire listener for unrelated key changes', () => {
      const store = createStoreState({ a: 1, b: 2 })
      const listener = vi.fn()
      store.subscribe(['a'], listener)

      store.set({ b: 20 })
      expect(listener).not.toHaveBeenCalled()
    })

    it('deduplicates listener when multiple subscribed keys change', () => {
      const store = createStoreState({ a: 1, b: 2 })
      const listener = vi.fn()
      store.subscribe(['a', 'b'], listener)

      store.set({ a: 10, b: 20 })
      // listener subscribed to both keys but deduped — fires once
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('returns an unsubscribe function', () => {
      const store = createStoreState({ a: 1 })
      const listener = vi.fn()
      const unsub = store.subscribe(['a'], listener)

      store.set({ a: 2 })
      expect(listener).toHaveBeenCalledTimes(1)

      unsub()
      store.set({ a: 3 })
      expect(listener).toHaveBeenCalledTimes(1) // no additional calls
    })

    it('supports multiple listeners on the same key', () => {
      const store = createStoreState({ x: 0 })
      const l1 = vi.fn()
      const l2 = vi.fn()
      store.subscribe(['x'], l1)
      store.subscribe(['x'], l2)

      store.set({ x: 1 })
      expect(l1).toHaveBeenCalledTimes(1)
      expect(l2).toHaveBeenCalledTimes(1)
    })

    it('unsubscribing one listener does not affect others', () => {
      const store = createStoreState({ x: 0 })
      const l1 = vi.fn()
      const l2 = vi.fn()
      const unsub1 = store.subscribe(['x'], l1)
      store.subscribe(['x'], l2)

      unsub1()
      store.set({ x: 1 })
      expect(l1).not.toHaveBeenCalled()
      expect(l2).toHaveBeenCalledTimes(1)
    })
  })

  // -- select ---------------------------------------------------------------
  describe('select', () => {
    it('picks requested keys from state', () => {
      const store = createStoreState({ a: 1, b: 2, c: 3 })
      expect(store.select(['a', 'c'])).toEqual({ a: 1, c: 3 })
    })

    it('returns a new object each time', () => {
      const store = createStoreState({ a: 1 })
      const s1 = store.select(['a'])
      const s2 = store.select(['a'])
      expect(s1).not.toBe(s2)
      expect(s1).toEqual(s2)
    })
  })
})

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
describe('middleware', () => {
  it('allows updates through when next() is called', () => {
    const store = createStoreState({ count: 0 })
    store.addMiddleware((_state, _update, next) => next())

    store.set({ count: 5 })
    expect(store.get().count).toBe(5)
  })

  it('blocks updates when next() is not called', () => {
    const store = createStoreState({ count: 0 })
    store.addMiddleware(() => {
      // intentionally not calling next()
    })

    store.set({ count: 5 })
    expect(store.get().count).toBe(0)
  })

  it('can transform updates via next(modified)', () => {
    const store = createStoreState({ name: '' })
    store.addMiddleware((_state, update, next) => {
      if (update.name) {
        next({ name: update.name.toUpperCase() })
      } else {
        next()
      }
    })

    store.set({ name: 'alice' })
    expect(store.get().name).toBe('ALICE')
  })

  it('only runs for matching keys when key filter is set', () => {
    const spy = vi.fn()
    const store = createStoreState({ a: 1, b: 2 })
    store.addMiddleware((_state, _update, next) => {
      spy()
      next()
    }, ['a'])

    store.set({ b: 20 }) // should skip middleware
    expect(spy).not.toHaveBeenCalled()

    store.set({ a: 10 }) // should run middleware
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('supports tuple syntax [fn, keys]', () => {
    const spy = vi.fn()
    const store = createStoreState({ x: 0, y: 0 })
    store.addMiddleware([(_state, _update, next) => { spy(); next() }, ['x']])

    store.set({ y: 1 })
    expect(spy).not.toHaveBeenCalled()

    store.set({ x: 1 })
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('runs multiple middleware in insertion order', () => {
    const order: number[] = []
    const store = createStoreState({ v: 0 })

    store.addMiddleware((_s, _u, next) => { order.push(1); next() })
    store.addMiddleware((_s, _u, next) => { order.push(2); next() })
    store.addMiddleware((_s, _u, next) => { order.push(3); next() })

    store.set({ v: 1 })
    expect(order).toEqual([1, 2, 3])
  })

  it('blocks remaining middleware once one blocks', () => {
    const spy = vi.fn()
    const store = createStoreState({ v: 0 })

    store.addMiddleware(() => { /* block */ })
    store.addMiddleware((_s, _u, next) => { spy(); next() })

    store.set({ v: 1 })
    expect(spy).not.toHaveBeenCalled()
    expect(store.get().v).toBe(0)
  })

  it('catches middleware errors and blocks the update', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const store = createStoreState({ v: 0 })

    store.addMiddleware(() => { throw new Error('boom') })

    store.set({ v: 1 })
    expect(store.get().v).toBe(0)
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('prevents double-calling next()', () => {
    const store = createStoreState({ v: 0 })
    const listener = vi.fn()
    store.subscribe(['v'], listener)

    store.addMiddleware((_s, _u, next) => {
      next()
      next() // second call should be ignored
    })

    store.set({ v: 1 })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('can be removed via returned cleanup function', () => {
    const spy = vi.fn()
    const store = createStoreState({ v: 0 })
    const remove = store.addMiddleware((_s, _u, next) => { spy(); next() })

    store.set({ v: 1 })
    expect(spy).toHaveBeenCalledTimes(1)

    remove()
    store.set({ v: 2 })
    expect(spy).toHaveBeenCalledTimes(1) // not called again
    expect(store.get().v).toBe(2) // update still applied
  })

  it('receives current state and the update object', () => {
    const store = createStoreState({ a: 1, b: 2 })
    let capturedState: any
    let capturedUpdate: any

    store.addMiddleware((state, update, next) => {
      capturedState = { ...state }
      capturedUpdate = { ...update }
      next()
    })

    store.set({ a: 10 })
    expect(capturedState).toEqual({ a: 1, b: 2 }) // state before update
    expect(capturedUpdate).toEqual({ a: 10 })
  })
})

// ---------------------------------------------------------------------------
// onChange
// ---------------------------------------------------------------------------
describe('onChange', () => {
  it('fires callback with new and previous values', async () => {
    const store = createStoreState({ count: 0, name: 'a' })
    const cb = vi.fn()

    store.onChange(['count'], cb)
    store.set({ count: 5 })

    // onChange uses queueMicrotask, await a tick
    await Promise.resolve()

    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenCalledWith({ count: 5 }, { count: 0 })
  })

  it('batches multiple key changes from a single set()', async () => {
    const store = createStoreState({ a: 1, b: 2 })
    const cb = vi.fn()

    store.onChange(['a', 'b'], cb)
    store.set({ a: 10, b: 20 })

    await Promise.resolve()

    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenCalledWith({ a: 10, b: 20 }, { a: 1, b: 2 })
  })

  it('batches rapid sequential set() calls into one callback', async () => {
    const store = createStoreState({ x: 0 })
    const cb = vi.fn()

    store.onChange(['x'], cb)
    store.set({ x: 1 })
    store.set({ x: 2 })
    store.set({ x: 3 })

    await Promise.resolve()

    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenCalledWith({ x: 3 }, { x: 0 })
  })

  it('does not fire when values do not actually change', async () => {
    const store = createStoreState({ a: 1 })
    const cb = vi.fn()

    store.onChange(['a'], cb)
    store.set({ a: 1 }) // same value

    await Promise.resolve()

    expect(cb).not.toHaveBeenCalled()
  })

  it('does not fire for unrelated key changes', async () => {
    const store = createStoreState({ a: 1, b: 2 })
    const cb = vi.fn()

    store.onChange(['a'], cb)
    store.set({ b: 20 })

    await Promise.resolve()

    expect(cb).not.toHaveBeenCalled()
  })

  it('returns an unsubscribe function', async () => {
    const store = createStoreState({ v: 0 })
    const cb = vi.fn()

    const unsub = store.onChange(['v'], cb)
    store.set({ v: 1 })
    await Promise.resolve()
    expect(cb).toHaveBeenCalledTimes(1)

    unsub()
    store.set({ v: 2 })
    await Promise.resolve()
    expect(cb).toHaveBeenCalledTimes(1) // no additional calls
  })

  it('tracks prev correctly across multiple change cycles', async () => {
    const store = createStoreState({ v: 0 })
    const cb = vi.fn()

    store.onChange(['v'], cb)

    store.set({ v: 1 })
    await Promise.resolve()
    expect(cb).toHaveBeenLastCalledWith({ v: 1 }, { v: 0 })

    store.set({ v: 2 })
    await Promise.resolve()
    expect(cb).toHaveBeenLastCalledWith({ v: 2 }, { v: 1 })

    store.set({ v: 3 })
    await Promise.resolve()
    expect(cb).toHaveBeenLastCalledWith({ v: 3 }, { v: 2 })
  })
})

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------
describe('persistence', () => {
  function createMockStorage() {
    const data = new Map<string, string>()
    return {
      getItem: vi.fn((key: string) => data.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => { data.set(key, value) }),
      data,
    }
  }

  describe('createPersistenceMiddleware', () => {
    it('saves changed keys to storage on update', () => {
      const storage = createMockStorage()
      const store = createStoreState({ theme: 'light', count: 0 })
      store.addMiddleware(
        createPersistenceMiddleware<{ theme: string; count: number }>(
          storage, 'app', ['theme']
        )
      )

      store.set({ theme: 'dark' })
      expect(storage.setItem).toHaveBeenCalledWith('app:theme', '"dark"')
      expect(store.get().theme).toBe('dark')
    })

    it('does not write untracked keys', () => {
      const storage = createMockStorage()
      const store = createStoreState({ theme: 'light', count: 0 })
      store.addMiddleware(
        createPersistenceMiddleware<{ theme: string; count: number }>(
          storage, 'app', ['theme']
        )
      )

      store.set({ count: 5 })
      expect(storage.setItem).not.toHaveBeenCalled()
      expect(store.get().count).toBe(5)
    })

    it('uses per-key storage format', () => {
      const storage = createMockStorage()
      const store = createStoreState({ a: 1, b: 'x' })
      store.addMiddleware(
        createPersistenceMiddleware<{ a: number; b: string }>(
          storage, 'prefix', ['a', 'b']
        )
      )

      store.set({ a: 2, b: 'y' })
      expect(storage.setItem).toHaveBeenCalledWith('prefix:a', '2')
      expect(storage.setItem).toHaveBeenCalledWith('prefix:b', '"y"')
    })

    it('handles storage errors gracefully', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const storage = {
        getItem: () => null,
        setItem: () => { throw new Error('quota exceeded') },
      }
      const store = createStoreState({ v: 0 })
      store.addMiddleware(
        createPersistenceMiddleware<{ v: number }>(storage, 'k', ['v'])
      )

      store.set({ v: 1 })
      expect(store.get().v).toBe(1) // update still applied
      expect(warnSpy).toHaveBeenCalled()
      warnSpy.mockRestore()
    })
  })

  describe('loadPersistedState', () => {
    it('loads saved keys from storage', () => {
      const storage = createMockStorage()
      storage.data.set('app:theme', '"dark"')
      storage.data.set('app:count', '42')

      const result = loadPersistedState<{ theme: string; count: number }>(
        storage, 'app', ['theme', 'count']
      )
      expect(result).toEqual({ theme: 'dark', count: 42 })
    })

    it('returns empty object when no keys are persisted', () => {
      const storage = createMockStorage()
      const result = loadPersistedState<{ theme: string }>(
        storage, 'app', ['theme']
      )
      expect(result).toEqual({})
    })

    it('skips keys that fail to parse', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const storage = createMockStorage()
      storage.data.set('app:a', 'not-json{{')
      storage.data.set('app:b', '"valid"')

      const result = loadPersistedState<{ a: string; b: string }>(
        storage, 'app', ['a', 'b']
      )
      expect(result).toEqual({ b: 'valid' })
      expect(warnSpy).toHaveBeenCalled()
      warnSpy.mockRestore()
    })

    it('integrates with createPersistenceMiddleware round-trip', () => {
      const storage = createMockStorage()

      // Write
      const store1 = createStoreState({ theme: 'light', lang: 'en' })
      store1.addMiddleware(
        createPersistenceMiddleware<{ theme: string; lang: string }>(
          storage, 'rt', ['theme', 'lang']
        )
      )
      store1.set({ theme: 'dark', lang: 'fr' })

      // Read
      const persisted = loadPersistedState<{ theme: string; lang: string }>(
        storage, 'rt', ['theme', 'lang']
      )
      expect(persisted).toEqual({ theme: 'dark', lang: 'fr' })
    })
  })

  // -- async storage --------------------------------------------------------
  function createMockAsyncStorage() {
    const data = new Map<string, string>()
    return {
      getItem: vi.fn((key: string) => Promise.resolve(data.get(key) ?? null)),
      setItem: vi.fn((key: string, value: string) => {
        data.set(key, value)
        return Promise.resolve()
      }),
      data,
    }
  }

  describe('createPersistenceMiddleware (async)', () => {
    it('writes to async storage and still applies update synchronously', async () => {
      const storage = createMockAsyncStorage()
      const store = createStoreState({ theme: 'light' })
      store.addMiddleware(
        createPersistenceMiddleware<{ theme: string }>(storage, 'app', ['theme'])
      )

      store.set({ theme: 'dark' })
      expect(store.get().theme).toBe('dark') // state updated synchronously
      await Promise.resolve() // let async setItem resolve
      expect(storage.setItem).toHaveBeenCalledWith('app:theme', '"dark"')
    })

    it('handles async storage write errors gracefully', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const storage = {
        getItem: () => Promise.resolve(null),
        setItem: () => Promise.reject(new Error('write failed')),
      }
      const store = createStoreState({ v: 0 })
      store.addMiddleware(
        createPersistenceMiddleware<{ v: number }>(storage, 'k', ['v'])
      )

      store.set({ v: 1 })
      expect(store.get().v).toBe(1)
      await Promise.resolve() // let rejection handler run
      await Promise.resolve() // microtask for .catch
      expect(warnSpy).toHaveBeenCalled()
      warnSpy.mockRestore()
    })
  })

  describe('loadPersistedState (async)', () => {
    it('returns a Promise that resolves to persisted state', async () => {
      const storage = createMockAsyncStorage()
      storage.data.set('app:theme', '"dark"')
      storage.data.set('app:count', '42')

      const result = loadPersistedState<{ theme: string; count: number }>(
        storage, 'app', ['theme', 'count']
      )
      expect(result).toBeInstanceOf(Promise)
      expect(await result).toEqual({ theme: 'dark', count: 42 })
    })

    it('returns empty object when async storage has no keys', async () => {
      const storage = createMockAsyncStorage()
      const result = await loadPersistedState<{ theme: string }>(
        storage, 'app', ['theme']
      )
      expect(result).toEqual({})
    })

    it('handles async getItem rejection gracefully', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const storage = {
        getItem: vi.fn((key: string) =>
          key === 'app:a' ? Promise.reject(new Error('read fail')) : Promise.resolve('"ok"')
        ),
        setItem: vi.fn(() => Promise.resolve()),
      }

      const result = await loadPersistedState<{ a: string; b: string }>(
        storage, 'app', ['a', 'b']
      )
      expect(result).toEqual({ b: 'ok' })
      expect(warnSpy).toHaveBeenCalled()
      warnSpy.mockRestore()
    })

    it('integrates with async createPersistenceMiddleware round-trip', async () => {
      const storage = createMockAsyncStorage()

      const store = createStoreState({ theme: 'light', lang: 'en' })
      store.addMiddleware(
        createPersistenceMiddleware<{ theme: string; lang: string }>(
          storage, 'rt', ['theme', 'lang']
        )
      )
      store.set({ theme: 'dark', lang: 'fr' })

      await Promise.resolve() // let async writes complete

      const persisted = await loadPersistedState<{ theme: string; lang: string }>(
        storage, 'rt', ['theme', 'lang']
      )
      expect(persisted).toEqual({ theme: 'dark', lang: 'fr' })
    })
  })
})
