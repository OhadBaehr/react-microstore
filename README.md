# dev-react-microstore

Probably the fastest store library ever created for React.

A minimal, zero-dependency global state manager with fine-grained subscriptions, full TypeScript inference, and a tiny footprint (< 5KB minified).

## Installation

```bash
npm install dev-react-microstore
```

## Quick Start

```tsx
import { createStoreState, createSelectorHook } from 'dev-react-microstore';

const store = createStoreState({
  count: 0,
  user: { name: 'Alice', age: 30 },
});

export const useStore = createSelectorHook(store);

function Counter() {
  const { count } = useStore(['count']);
  return <button onClick={() => store.setKey('count', count + 1)}>{count}</button>;
}
```

One line to create the hook, all types inferred from the store instance — no manual generics.

## API

### `createStoreState(initialState)`

Creates a reactive store. Returns:

| Method | Description |
|--------|-------------|
| `get()` | Returns the full state object |
| `getKey(key)` | Returns the value of a single key |
| `set(partial)` | Partially updates state |
| `setKey(key, value)` | Sets a single key |
| `merge(key, partial)` | Returns `{ ...state[key], ...partial }` without writing |
| `mergeSet(key, partial)` | Shallow-merges and writes to the store |
| `reset(keys?)` | Resets to initial values. No args = full reset |
| `batch(fn)` | Groups updates — listeners fire once at the end |
| `subscribe(keys, listener)` | Subscribe to specific keys. Returns unsubscribe function |
| `select(keys)` | Returns a snapshot of specific keys |
| `onChange(keys, callback)` | Non-React listener with `(newValues, prevValues)` |
| `addMiddleware(fn, keys?)` | Intercept, block, or transform updates |
| `skipSetWhen(key, fn)` | Custom equality — skip update when `fn(prev, next)` returns `true` |
| `removeSkipSetWhen(key)` | Remove custom equality for a key |

### `createSelectorHook(store)`

Returns a pre-bound React hook with full type inference:

```tsx
const useStore = createSelectorHook(store);

const { user } = useStore(['user']);
// user is { name: string; age: number }
```

### `useStoreSelector(store, selector)`

Low-level React hook. Prefer `createSelectorHook` for cleaner usage.

## merge vs mergeSet

`merge` returns the merged object without touching the store:

```tsx
const updated = store.merge('user', { age: 31 });
// updated = { name: 'Alice', age: 31 }
// store is unchanged
```

`mergeSet` writes it:

```tsx
store.mergeSet('user', { age: 31 });
// store.user is now { name: 'Alice', age: 31 }
```

Both are type-safe — calling on a primitive key is a compile error.

## Batching

Group multiple updates so listeners fire once:

```tsx
store.batch(() => {
  store.setKey('count', 10);
  store.mergeSet('user', { age: 25 });
  store.setKey('name', 'Bob');
});
```

## reset

```tsx
store.reset();              // Full reset to initial state
store.reset(['count']);      // Reset specific keys
```

## Middleware

Intercept, block, or transform updates:

```tsx
// Validation — block negative counts
store.addMiddleware(
  (state, update, next) => {
    if (update.count !== undefined && update.count < 0) return;
    next();
  },
  ['count']
);

// Transform
store.addMiddleware((state, update, next) => {
  if (update.user?.name) {
    next({ ...update, user: { ...update.user, name: update.user.name.trim() } });
  } else {
    next();
  }
});

// Logging
store.addMiddleware((state, update, next) => {
  console.log('Update:', update);
  next();
});
```

## Persistence

Built-in middleware for automatic state persistence. Supports both sync and async storage:

```tsx
import { createStoreState, createPersistenceMiddleware, loadPersistedState } from 'dev-react-microstore';

// Sync (localStorage / sessionStorage)
const persisted = loadPersistedState<AppState>(localStorage, 'app', ['theme', 'user']);
const store = createStoreState<AppState>({ theme: 'light', user: null, ...persisted });
store.addMiddleware(createPersistenceMiddleware(localStorage, 'app', ['theme', 'user']));

// Async (React Native AsyncStorage)
const persisted = await loadPersistedState<AppState>(AsyncStorage, 'app', ['theme', 'user']);
const store = createStoreState<AppState>({ theme: 'light', user: null, ...persisted });
store.addMiddleware(createPersistenceMiddleware(AsyncStorage, 'app', ['theme', 'user']));
```

Each key is stored individually (`app:theme`, `app:user`).

## onChange

Listen for value changes outside React:

```tsx
const unsub = store.onChange(['theme', 'locale'], (values, prev) => {
  document.body.className = values.theme;
});

unsub();
```

## Custom Comparison

Control when re-renders happen:

```tsx
const { tasks } = useStore([
  {
    tasks: (prev, next) =>
      !prev.some((t, i) => t.completed !== next?.[i]?.completed)
  }
]);
```

## skipSetWhen

Custom equality per key — skip updates when values are semantically equal:

```tsx
const store = createStoreState({ user: { id: 1, name: 'Alice' }, tags: ['a', 'b'] });

store.skipSetWhen('user', (prev, next) => prev.id === next.id && prev.name === next.name);
store.skipSetWhen('tags', (prev, next) => prev.length === next.length && prev.every((t, i) => t === next[i]));

store.mergeSet('user', { name: 'Alice' }); // skipped — same content

store.removeSkipSetWhen('user'); // back to reference equality
```

## Features

- Fine-grained subscriptions — components only re-render when their keys change
- Full TypeScript inference — no manual generics
- `createSelectorHook` for one-line per-store hooks
- `merge` / `mergeSet` for ergonomic object updates
- `batch` to group updates
- `reset` to restore initial state (full or per-key)
- `onChange` for non-React listeners
- `skipSetWhen` for custom equality
- Custom comparison functions in selectors
- Middleware (validation, transforms, logging)
- Persistence (localStorage, sessionStorage, AsyncStorage)
- Zero dependencies (peer: React >= 17)
- < 5KB minified

## ESLint Plugin

[eslint-plugin-dev-react-microstore](https://www.npmjs.com/package/eslint-plugin-dev-react-microstore) warns on unused selector keys:

```bash
npm install --save-dev eslint-plugin-dev-react-microstore
```

```tsx
import reactMicrostore from 'eslint-plugin-dev-react-microstore';

export default [{
  plugins: { 'dev-react-microstore': reactMicrostore },
  rules: { 'dev-react-microstore/no-unused-selector-keys': 'warn' }
}];
```

```tsx
// warns — 'b' is selected but unused
const { a } = useStore(['a', 'b']);

// fine
const { a, b } = useStore(['a', 'b']);
```
