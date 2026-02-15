/**
 * Compile-time type tests. Run with: tsc --noEmit
 * Every @ts-expect-error MUST produce an error — if it doesn't, tsc fails.
 * Every other line MUST compile cleanly.
 */

import { createStoreState, createSelectorHook } from './index'

// ── Test store ──────────────────────────────────────────────────────────────
const store = createStoreState({
  count: 0,
  name: '',
  user: { firstName: '', lastName: '', age: 0 },
  tags: [] as string[],
  nested: { a: { b: 1 } },
})

// ── get ─────────────────────────────────────────────────────────────────────
const state = store.get()
state.count satisfies number
state.name satisfies string
state.user satisfies { firstName: string; lastName: string; age: number }

// ── getKey ──────────────────────────────────────────────────────────────────
store.getKey('count') satisfies number
store.getKey('name') satisfies string
store.getKey('user') satisfies { firstName: string; lastName: string; age: number }

// @ts-expect-error — 'nonexistent' is not a key
store.getKey('nonexistent')

// @ts-expect-error — getKey('count') returns number, not string
store.getKey('count') satisfies string

// ── setKey ──────────────────────────────────────────────────────────────────
store.setKey('count', 42)
store.setKey('name', 'hello')
store.setKey('user', { firstName: 'A', lastName: 'B', age: 1 })

// @ts-expect-error — wrong value type for 'count'
store.setKey('count', 'not a number')

// @ts-expect-error — wrong value type for 'name'
store.setKey('name', 123)

// @ts-expect-error — missing required property 'age'
store.setKey('user', { firstName: 'A', lastName: 'B' })

// ── set ─────────────────────────────────────────────────────────────────────
store.set({ count: 1 })
store.set({ count: 1, name: 'test' })

// @ts-expect-error — wrong type in partial
store.set({ count: 'oops' })

// ── merge (pure read) ──────────────────────────────────────────────────────
store.merge('user', { age: 31 }) satisfies { firstName: string; lastName: string; age: number }
store.merge('nested', { a: { b: 2 } }) satisfies { a: { b: number } }

// Verify partial — only some keys required
store.merge('user', { firstName: 'Alice' })
store.merge('user', {})

// @ts-expect-error — 'count' is a primitive, merge should reject
store.merge('count', 5)

// @ts-expect-error — 'name' is a primitive, merge should reject
store.merge('name', 'test')

// @ts-expect-error — wrong property type inside partial
store.merge('user', { age: 'not a number' })

// @ts-expect-error — property doesn't exist on user
store.merge('user', { nonexistent: true })

// ── mergeSet ────────────────────────────────────────────────────────────────
store.mergeSet('user', { age: 25 })
store.mergeSet('user', { firstName: 'Bob' })

// @ts-expect-error — primitive key
store.mergeSet('count', 5)

// @ts-expect-error — wrong property type
store.mergeSet('user', { age: 'wrong' })

// ── reset ───────────────────────────────────────────────────────────────────
store.reset()
store.reset(['count', 'name'])

// @ts-expect-error — invalid key
store.reset(['nonexistent'])

// ── batch ───────────────────────────────────────────────────────────────────
store.batch(() => {
  store.setKey('count', 10)
  store.mergeSet('user', { age: 5 })
})

// ── subscribe ───────────────────────────────────────────────────────────────
store.subscribe(['count', 'name'], () => {}) satisfies () => void

// @ts-expect-error — invalid key in subscribe
store.subscribe(['nonexistent'], () => {})

// ── select ──────────────────────────────────────────────────────────────────
const picked = store.select(['count', 'name'])
picked.count satisfies number
picked.name satisfies string

// @ts-expect-error — 'user' not in selection
picked.user

// ── onChange ────────────────────────────────────────────────────────────────
store.onChange(['count', 'user'], (values, prev) => {
  values.count satisfies number
  values.user satisfies { firstName: string; lastName: string; age: number }
  prev.count satisfies number
  prev.user satisfies { firstName: string; lastName: string; age: number }
})

// ── createSelectorHook ──────────────────────────────────────────────────────
const useStore = createSelectorHook(store)

function TestComponent() {
  const s1 = useStore(['count', 'name'])
  s1.count satisfies number
  s1.name satisfies string

  const s2 = useStore(['user'])
  s2.user satisfies { firstName: string; lastName: string; age: number }
}

// ── addMiddleware ───────────────────────────────────────────────────────────
store.addMiddleware((currentState, update, next) => {
  currentState.count satisfies number
  update satisfies Partial<typeof state>
  next()
})

store.addMiddleware((currentState, _update, next) => {
  next({ count: currentState.count + 1 })
})

// ── skipSetWhen / removeSkipSetWhen ─────────────────────────────────────────
store.skipSetWhen('user', (prev, next) => prev.firstName === next.firstName && prev.age === next.age)
store.skipSetWhen('count', (prev, next) => prev + 1 === next + 1)
store.skipSetWhen('tags', (prev, next) => prev.length === next.length && prev.every((t, i) => t === next[i]))

// @ts-expect-error — wrong prev/next type in callback
store.skipSetWhen('count', (prev: string, next: string) => prev === next)

// @ts-expect-error — invalid key
store.skipSetWhen('nonexistent', () => true)

store.removeSkipSetWhen('user')
store.removeSkipSetWhen('count')

// @ts-expect-error — invalid key
store.removeSkipSetWhen('nonexistent')

void TestComponent
