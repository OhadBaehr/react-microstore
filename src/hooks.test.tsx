import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  createStoreState,
  useStoreSelector,
  createSelectorHook,
} from './index'

// ---------------------------------------------------------------------------
// useStoreSelector
// ---------------------------------------------------------------------------
describe('useStoreSelector', () => {
  it('returns selected keys from the store', () => {
    const store = createStoreState({ a: 1, b: 2, c: 3 })
    const { result } = renderHook(() => useStoreSelector(store, ['a', 'c']))

    expect(result.current).toEqual({ a: 1, c: 3 })
  })

  it('re-renders when a subscribed key changes', () => {
    const store = createStoreState({ count: 0 })
    const { result } = renderHook(() => useStoreSelector(store, ['count']))

    expect(result.current.count).toBe(0)

    act(() => store.set({ count: 5 }))

    expect(result.current.count).toBe(5)
  })

  it('does not re-render when an unrelated key changes', () => {
    const store = createStoreState({ a: 1, b: 2 })
    const renderCount = vi.fn()

    renderHook(() => {
      renderCount()
      return useStoreSelector(store, ['a'])
    })

    const callsAfterMount = renderCount.mock.calls.length

    act(() => store.set({ b: 99 }))

    expect(renderCount.mock.calls.length).toBe(callsAfterMount)
  })

  it('does not re-render when set to the same value', () => {
    const store = createStoreState({ count: 0 })
    const renderCount = vi.fn()

    renderHook(() => {
      renderCount()
      return useStoreSelector(store, ['count'])
    })

    const callsAfterMount = renderCount.mock.calls.length

    act(() => store.set({ count: 0 }))

    expect(renderCount.mock.calls.length).toBe(callsAfterMount)
  })

  it('handles multiple keys and only re-renders for actual changes', () => {
    const store = createStoreState({ x: 1, y: 2, z: 3 })
    const { result } = renderHook(() => useStoreSelector(store, ['x', 'y']))

    act(() => store.set({ x: 10 }))
    expect(result.current).toEqual({ x: 10, y: 2 })

    act(() => store.set({ y: 20 }))
    expect(result.current).toEqual({ x: 10, y: 20 })
  })

  it('works with custom comparison functions', () => {
    const store = createStoreState({
      items: [1, 2, 3],
    })
    const renderCount = vi.fn()

    const { result } = renderHook(() => {
      renderCount()
      return useStoreSelector(store, [
        { items: (prev: number[], next: number[]) => prev.length === next.length },
      ])
    })

    const callsAfterMount = renderCount.mock.calls.length

    // Same length array — custom compare returns true (equal), so no re-render
    act(() => store.set({ items: [4, 5, 6] }))
    expect(renderCount.mock.calls.length).toBe(callsAfterMount)

    // Different length — custom compare returns false (not equal), triggers re-render
    act(() => store.set({ items: [1, 2, 3, 4] }))
    expect(result.current.items).toEqual([1, 2, 3, 4])
  })

  it('returns referentially stable result when nothing changed', () => {
    const store = createStoreState({ a: 1, b: 2 })
    const { result, rerender } = renderHook(() => useStoreSelector(store, ['a']))

    const first = result.current
    rerender()
    const second = result.current

    expect(first).toBe(second)
  })

  it('handles rapid sequential updates correctly', () => {
    const store = createStoreState({ v: 0 })
    const { result } = renderHook(() => useStoreSelector(store, ['v']))

    act(() => {
      store.set({ v: 1 })
      store.set({ v: 2 })
      store.set({ v: 3 })
    })

    expect(result.current.v).toBe(3)
  })

  it('works with object values', () => {
    const store = createStoreState({ user: { name: 'Alice', age: 30 } })
    const { result } = renderHook(() => useStoreSelector(store, ['user']))

    expect(result.current.user).toEqual({ name: 'Alice', age: 30 })

    const newUser = { name: 'Bob', age: 25 }
    act(() => store.set({ user: newUser }))
    expect(result.current.user).toBe(newUser)
  })

  it('works with null and undefined values', () => {
    const store = createStoreState<{ v: string | null }>({ v: null })
    const { result } = renderHook(() => useStoreSelector(store, ['v']))

    expect(result.current.v).toBeNull()

    act(() => store.set({ v: 'hello' }))
    expect(result.current.v).toBe('hello')

    act(() => store.set({ v: null }))
    expect(result.current.v).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// createSelectorHook
// ---------------------------------------------------------------------------
describe('createSelectorHook', () => {
  it('returns a hook that works like useStoreSelector', () => {
    const store = createStoreState({ count: 0, name: 'Alice' })
    const useStore = createSelectorHook(store)

    const { result } = renderHook(() => useStore(['count', 'name']))
    expect(result.current).toEqual({ count: 0, name: 'Alice' })
  })

  it('re-renders on subscribed key change', () => {
    const store = createStoreState({ count: 0 })
    const useStore = createSelectorHook(store)

    const { result } = renderHook(() => useStore(['count']))

    act(() => store.set({ count: 42 }))
    expect(result.current.count).toBe(42)
  })

  it('does not re-render on unrelated key change', () => {
    const store = createStoreState({ a: 1, b: 2 })
    const useStore = createSelectorHook(store)
    const renderCount = vi.fn()

    renderHook(() => {
      renderCount()
      return useStore(['a'])
    })

    const callsAfterMount = renderCount.mock.calls.length

    act(() => store.set({ b: 99 }))

    expect(renderCount.mock.calls.length).toBe(callsAfterMount)
  })

  it('supports custom comparison functions', () => {
    const store = createStoreState({ data: [1, 2] })
    const useStore = createSelectorHook(store)
    const renderCount = vi.fn()

    renderHook(() => {
      renderCount()
      return useStore([
        { data: (prev: number[], next: number[]) => prev.length === next.length },
      ])
    })

    const callsAfterMount = renderCount.mock.calls.length

    act(() => store.set({ data: [3, 4] })) // same length
    expect(renderCount.mock.calls.length).toBe(callsAfterMount)

    act(() => store.set({ data: [1] })) // different length
    expect(renderCount.mock.calls.length).toBeGreaterThan(callsAfterMount)
  })

  it('multiple hooks on the same store work independently', () => {
    const store = createStoreState({ a: 1, b: 2 })
    const useStore = createSelectorHook(store)

    const { result: r1 } = renderHook(() => useStore(['a']))
    const { result: r2 } = renderHook(() => useStore(['b']))

    act(() => store.set({ a: 10 }))

    expect(r1.current.a).toBe(10)
    expect(r2.current.b).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe('edge cases', () => {
  it('useStoreSelector with middleware that blocks — hook reflects blocked state', () => {
    const store = createStoreState({ count: 0 })
    store.addMiddleware((_state, update, next) => {
      if (update.count !== undefined && update.count < 0) return // block negatives
      next()
    })

    const { result } = renderHook(() => useStoreSelector(store, ['count']))

    act(() => store.set({ count: 5 }))
    expect(result.current.count).toBe(5)

    act(() => store.set({ count: -1 })) // blocked
    expect(result.current.count).toBe(5)
  })

  it('useStoreSelector with middleware that transforms', () => {
    const store = createStoreState({ name: '' })
    store.addMiddleware((_state, update, next) => {
      if (update.name) next({ name: update.name.trim() })
      else next()
    })

    const { result } = renderHook(() => useStoreSelector(store, ['name']))

    act(() => store.set({ name: '  hello  ' }))
    expect(result.current.name).toBe('hello')
  })

  it('store works correctly after many subscribe/unsubscribe cycles', () => {
    const store = createStoreState({ v: 0 })
    const unsubs: (() => void)[] = []

    for (let i = 0; i < 100; i++) {
      unsubs.push(store.subscribe(['v'], () => {}))
    }
    for (const unsub of unsubs) {
      unsub()
    }

    const listener = vi.fn()
    store.subscribe(['v'], listener)
    store.set({ v: 1 })
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
