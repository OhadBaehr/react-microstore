import { useMemo, useRef, useSyncExternalStore } from 'react'

type StoreListener = () => void;

type MiddlewareFunction<T extends object> = (
  currentState: T,
  update: Partial<T>,
  next: (modifiedUpdate?: Partial<T>) => void
) => void;

/**
 * Creates a new reactive store with fine-grained subscriptions and middleware support.
 * 
 * @param initialState - The initial state object for the store
 * @returns Store object with methods: get, set, subscribe, select, addMiddleware, onChange
 * 
 * @example
 * ```ts
 * const store = createStoreState({ count: 0, name: 'John' });
 * store.set({ count: 1 }); // Update state
 * const { count } = useStoreSelector(store, ['count']); // Subscribe in React
 * ```
 */
export function createStoreState<T extends object>(
  initialState: T
) {
  const _initialState = { ...initialState };
  let state = initialState;
  const keyListeners: Record<string, Set<StoreListener> | undefined> = Object.create(null);
  
  // Middleware storage
  const middleware: Array<{ callback: MiddlewareFunction<T>; keys: (keyof T)[] | null }> = [];

  // Per-key equality registry
  const equalityRegistry: Record<string, ((prev: any, next: any) => boolean) | undefined> = Object.create(null);

  // Batching
  let batchedKeys: Set<keyof T> | null = null;

  const get = () => state;

  const getKey = <K extends keyof T>(key: K): T[K] => state[key];

  const notifyKey = (key: keyof T) => {
    if (batchedKeys) {
      batchedKeys.add(key);
      return;
    }
    keyListeners[key as string]?.forEach(listener => listener());
  };

  const applySingleKey = <K extends keyof T>(key: K, value: T[K]) => {
    if (Object.is(state[key], value)) return;
    const eq = equalityRegistry[key as string];
    if (eq && eq(state[key], value)) return;
    state[key] = value;
    notifyKey(key);
  };

  const setKey = <K extends keyof T>(key: K, value: T[K]) => {
    if (middleware.length === 0) {
      applySingleKey(key, value);
      return;
    }
    const partial = {} as Partial<T>;
    partial[key] = value;
    set(partial);
  };

  const merge = <K extends keyof T>(key: K, value: T[K] extends object ? Partial<T[K]> : never): T[K] => {
    return { ...state[key], ...value };
  };

  const mergeSet = <K extends keyof T>(key: K, value: T[K] extends object ? Partial<T[K]> : never) => {
    if (middleware.length === 0) {
      applySingleKey(key, { ...state[key], ...value } as T[K]);
      return;
    }
    const partial = {} as Partial<T>;
    partial[key] = { ...state[key], ...value } as T[K];
    set(partial);
  };

  const reset = (keys?: (keyof T)[]) => {
    if (!keys) {
      set({ ..._initialState });
    } else {
      const partial = {} as Partial<T>;
      for (const key of keys) {
        partial[key] = _initialState[key];
      }
      set(partial);
    }
  };

  const batch = (fn: () => void) => {
    if (batchedKeys) {
      fn();
      return;
    }
    batchedKeys = new Set();
    try {
      fn();
    } finally {
      const keys = batchedKeys;
      batchedKeys = null;
      const notified = new Set<StoreListener>();
      for (const key of keys) {
        keyListeners[key as string]?.forEach(listener => {
          if (!notified.has(listener)) {
            notified.add(listener);
            listener();
          }
        });
      }
    }
  };

  const set = (update: Partial<T>) => {
    if (!update) return;

    if (middleware.length === 0) {
      applyUpdate(update);
      return;
    }

    // Run middleware chain
    let currentUpdate = update;
    let middlewareIndex = 0;
    let blocked = false;

    const runMiddleware = (modifiedUpdate?: Partial<T>) => {
      if (modifiedUpdate !== undefined) {
        currentUpdate = modifiedUpdate;
      }

      if (middlewareIndex >= middleware.length) {
        // All middleware processed, apply the update
        if (!blocked) {
          applyUpdate(currentUpdate);
        }
        return;
      }

      const currentMiddleware = middleware[middlewareIndex++];
      
      // Check if middleware applies to these keys
      if (!currentMiddleware.keys || currentMiddleware.keys.some(key => key in currentUpdate)) {
        let nextCalled = false;
        
        const next = (modifiedUpdate?: Partial<T>) => {
          if (nextCalled) return; // Prevent multiple calls
          nextCalled = true;
          runMiddleware(modifiedUpdate);
        };

        try {
          currentMiddleware.callback(state, currentUpdate, next);
        } catch (error) {
          blocked = true;
          console.error('Middleware error:', error);
          return;
        }

        // If next() wasn't called, the middleware blocked the update
        if (!nextCalled) {
          blocked = true;
          return;
        }
      } else {
        // Skip this middleware
        runMiddleware();
      }
    };

    runMiddleware();
  };

  const applyUpdate = (processedUpdate: Partial<T>) => {
    const changedKeys: string[] = [];

    // Phase 1: update all state before notifying
    for (const key in processedUpdate) {
      const typedKey = key as keyof T;
      if (Object.is(state[typedKey], processedUpdate[typedKey])) continue;
      const eq = equalityRegistry[key];
      if (eq && eq(state[typedKey], processedUpdate[typedKey])) continue;
      state[typedKey] = processedUpdate[typedKey]!;
      changedKeys.push(key);
    }

    if (changedKeys.length === 0) return;

    // Phase 2: notify after state is fully consistent
    if (batchedKeys) {
      for (const key of changedKeys) {
        batchedKeys.add(key as keyof T);
      }
      return;
    }

    // Synchronous: deduplicate listeners across keys
    if (changedKeys.length === 1) {
      keyListeners[changedKeys[0]]?.forEach(listener => listener());
    } else {
      const notified = new Set<StoreListener>();
      for (const key of changedKeys) {
        keyListeners[key]?.forEach(listener => {
          if (!notified.has(listener)) {
            notified.add(listener);
            listener();
          }
        });
      }
    }
  };

  const addMiddleware = (
    callbackOrTuple: MiddlewareFunction<T> | [MiddlewareFunction<T>, (keyof T)[]],
    affectedKeys: (keyof T)[] | null = null
  ) => {
    let callback: MiddlewareFunction<T>;
    let keys: (keyof T)[] | null;
    
    if (Array.isArray(callbackOrTuple)) {
      [callback, keys] = callbackOrTuple;
    } else {
      callback = callbackOrTuple;
      keys = affectedKeys;
    }
    
    const middlewareItem = { callback, keys };
    middleware.push(middlewareItem);
    
    return () => {
      const index = middleware.indexOf(middlewareItem);
      if (index > -1) {
        middleware.splice(index, 1);
      }
    };
  };

  const subscribe = (keys: (keyof T)[], listener: StoreListener): (() => void) => {
    for (const key of keys) {
      const k = key as string;
      if (!keyListeners[k]) keyListeners[k] = new Set();
      keyListeners[k]!.add(listener);
    }

    return () => {
      for (const key of keys) {
        keyListeners[key as string]?.delete(listener);
      }
    };
  };

  const select = <K extends keyof T>(keys: K[]): Pick<T, K> => {
    const result = {} as Pick<T, K>;
    const currentState = state;
    for (const key of keys) {
      result[key] = currentState[key];
    }
    return result;
  };

  const onChange = <K extends keyof T>(
    keys: K[],
    callback: (values: Pick<T, K>, prev: Pick<T, K>) => void
  ): (() => void) => {
    let prev = {} as Pick<T, K>;
    for (const key of keys) {
      prev[key] = state[key];
    }

    let scheduled = false;

    const listener = () => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        let hasChanges = false;
        for (const key of keys) {
          if (!Object.is(state[key], prev[key])) {
            hasChanges = true;
            break;
          }
        }
        if (!hasChanges) return;
        const next = {} as Pick<T, K>;
        for (const key of keys) {
          next[key] = state[key];
        }
        const snapshot = prev;
        prev = next;
        callback(next, snapshot);
      });
    };

    return subscribe(keys, listener);
  };

  const skipSetWhen = <K extends keyof T>(key: K, fn: (prev: T[K], next: T[K]) => boolean) => {
    equalityRegistry[key as string] = fn;
  };

  const removeSkipSetWhen = (key: keyof T) => {
    delete equalityRegistry[key as string];
  };

  return { get, getKey, set, setKey, merge, mergeSet, reset, batch, subscribe, select, addMiddleware, onChange, skipSetWhen, removeSkipSetWhen, _eqReg: equalityRegistry };
}

type StoreType<T extends object> = ReturnType<typeof createStoreState<T>>;
type PrimitiveKey<T extends object> = keyof T;
type CompareFn<V> = (prev: V, next: V) => boolean;

type KeySelector<T extends object> = PrimitiveKey<T>;
type CustomSelector<T extends object> = { [K in keyof T]?: CompareFn<T[K]> };
type SelectorInput<T extends object> = ReadonlyArray<KeySelector<T> | CustomSelector<T>>;

type ExtractSelectorKeys<T extends object, S extends SelectorInput<T>> = {
  [K in S[number] extends infer Item
  ? Item extends keyof T
  ? Item
  : keyof Item
  : never]: T[K];
};

type Picked<T extends object, S extends SelectorInput<T>> = ExtractSelectorKeys<T, S>;

type NormalizedSelector<T extends object> = {
  key: keyof T;
  compare?: CompareFn<T[keyof T]>;
};

function shallowEqualSelector<T extends object>(
  a: SelectorInput<T>,
  b: SelectorInput<T>
): boolean {
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

/**
 * React hook that subscribes to specific keys in a store with fine-grained re-renders.
 * Only re-renders when the selected keys actually change (using Object.is comparison).
 * 
 * @param store - The store created with createStoreState
 * @param selector - Array of keys to subscribe to, or objects with custom compare functions
 * @returns Selected state values from the store
 * 
 * @example
 * ```ts
 * // Subscribe to specific keys
 * const { count, name } = useStoreSelector(store, ['count', 'name']);
 * 
 * // Custom comparison for complex objects
 * const { tasks } = useStoreSelector(store, [
 *   { tasks: (prev, next) => prev.length === next.length }
 * ]);
 * ```
 */
export function useStoreSelector<T extends object, S extends SelectorInput<T>>(
  store: StoreType<T>,
  selector: S
): Picked<T, S> {
  const ref = useRef({
    lastSelected: {} as Partial<T>,
    prevSelector: null as SelectorInput<T> | null,
    normalized: null as NormalizedSelector<T>[] | null,
    keys: null as (keyof T)[] | null,
    isFirstRun: true,
    lastValues: {} as Partial<T>,
    subscribe: null as ((onStoreChange: () => void) => () => void) | null,
    store,
  });

  const r = ref.current;
  const storeChanged = r.store !== store;
  if (storeChanged) {
    r.store = store;
    r.lastSelected = {};
    r.prevSelector = null;
    r.normalized = null;
    r.keys = null;
    r.isFirstRun = true;
    r.lastValues = {};
    r.subscribe = null;
  }

  if (!r.prevSelector || !shallowEqualSelector(r.prevSelector, selector)) {
    const normalized: NormalizedSelector<T>[] = [];
    const keys: (keyof T)[] = [];

    for (const item of selector) {
      if (typeof item === 'string') {
        const key = item as keyof T;
        normalized.push({ key });
        keys.push(key);
      } else {
        const customSelector = item as CustomSelector<T>;
        for (const key in customSelector) {
          const compare = customSelector[key as keyof typeof customSelector];
          const typedKey = key as keyof T;
          normalized.push({ key: typedKey, compare: compare as CompareFn<T[keyof T]> });
          keys.push(typedKey);
        }
      }
    }

    r.normalized = normalized;
    r.keys = keys;
    r.prevSelector = selector;
    r.subscribe = null;
  }

  const normalized = r.normalized!;
  const keys = r.keys!;

  const getSnapshot = () => {
    const current = store.get();

    if (r.isFirstRun) {
      r.isFirstRun = false;
      const result = {} as Partial<T>;
      for (const { key } of normalized) {
        const value = current[key];
        r.lastValues[key] = value;
        result[key] = value;
      }
      r.lastSelected = result;
      return result as Picked<T, S>;
    }

    // Single pass — lazy allocation on first change
    let result: Partial<T> | null = null;
    for (let i = 0; i < normalized.length; i++) {
      const { key, compare } = normalized[i];
      const prevVal = r.lastValues[key]!;
      const nextVal = current[key];
      if (!Object.is(prevVal, nextVal)) {
        const cmp = compare || store._eqReg[key as string];
        if (!cmp || !cmp(prevVal, nextVal)) {
          if (!result) {
            result = {} as Partial<T>;
            for (let j = 0; j < i; j++) result[normalized[j].key] = r.lastValues[normalized[j].key];
          }
          r.lastValues[key] = nextVal;
          result[key] = nextVal;
          continue;
        }
      }
      if (result) result[key] = prevVal;
    }

    if (!result) return r.lastSelected as Picked<T, S>;

    r.lastSelected = result;
    return result as Picked<T, S>;
  };

  const staticSnapshot = useMemo(() => {
    const current = store.get();
    const result = {} as Partial<T>;
    for (const key of keys) {
      result[key] = current[key];
    }
    return result as Picked<T, S>;
  }, [keys]);

  if (!r.subscribe || storeChanged) {
    r.subscribe = (onStoreChange: () => void) =>
      store.subscribe(keys, onStoreChange);
  }

  return useSyncExternalStore(r.subscribe, getSnapshot, () => staticSnapshot);
}

/**
 * Creates a pre-bound selector hook for a specific store instance.
 * Infers the state type from the store — no manual generics needed.
 * 
 * @param store - The store created with createStoreState
 * @returns A React hook with the same API as useStoreSelector, but with the store already bound
 * 
 * @example
 * ```ts
 * const useMyStore = createSelectorHook(myStore);
 * 
 * // In a component:
 * const { count, name } = useMyStore(['count', 'name']);
 * ```
 */
export function createSelectorHook<T extends object>(store: StoreType<T>) {
  return function <S extends SelectorInput<T>>(selector: S): Picked<T, S> {
    return useStoreSelector(store, selector);
  };
}

/**
 * Interface for synchronous storage (localStorage, sessionStorage, etc.).
 */
export interface StorageSupportingInterface {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Interface for asynchronous storage (React Native AsyncStorage, etc.).
 */
export interface AsyncStorageSupportingInterface {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

type AnyStorage = Storage | StorageSupportingInterface | AsyncStorageSupportingInterface;

function isThenable(value: unknown): value is Promise<unknown> {
  return value != null && typeof (value as any).then === 'function';
}

/**
 * Creates a persistence middleware that saves individual keys to storage.
 * Only writes when the specified keys actually change, using per-key storage.
 * Storage format: `${persistKey}:${keyName}` for each persisted key.
 * 
 * Works with both synchronous storage (localStorage) and asynchronous storage
 * (React Native AsyncStorage). Async writes are fire-and-forget — the state
 * update is never blocked by a slow write.
 * 
 * @param storage - Storage interface (localStorage, sessionStorage, AsyncStorage, etc.)
 * @param persistKey - Base key prefix for storage (e.g., 'myapp' creates 'myapp:theme')
 * @param keys - Array of state keys to persist
 * @returns Tuple of [middleware function, affected keys] for use with addMiddleware
 * 
 * @example
 * ```ts
 * // Sync — localStorage
 * store.addMiddleware(
 *   createPersistenceMiddleware(localStorage, 'myapp', ['theme', 'isLoggedIn'])
 * );
 * 
 * // Async — React Native AsyncStorage
 * store.addMiddleware(
 *   createPersistenceMiddleware(AsyncStorage, 'myapp', ['theme', 'isLoggedIn'])
 * );
 * ```
 */
export function createPersistenceMiddleware<T extends object>(
  storage: AnyStorage,
  persistKey: string,
  keys: (keyof T)[]
): [MiddlewareFunction<T>, (keyof T)[]] {
  const middlewareFunction: MiddlewareFunction<T> = (_, update, next) => {
    const changedKeys = keys.filter(key => key in update);
    if (changedKeys.length === 0) {
      return next();
    }

    for (const key of changedKeys) {
      try {
        const value = update[key];
        const storageKey = `${persistKey}:${String(key)}`;
        const result = storage.setItem(storageKey, JSON.stringify(value));
        if (isThenable(result)) {
          result.catch(error => {
            console.warn(`Failed to persist key ${String(key)}:`, error);
          });
        }
      } catch (error) {
        console.warn(`Failed to persist key ${String(key)}:`, error);
      }
    }

    next();
  };

  return [middlewareFunction, keys];
}

/**
 * Loads persisted state from individual key storage during store initialization.
 * Reads keys saved by createPersistenceMiddleware and returns them as partial state.
 * 
 * Returns synchronously for sync storage and a Promise for async storage.
 * 
 * @param storage - Storage interface to read from (same as used in middleware)
 * @param persistKey - Base key prefix used for storage (same as used in middleware)
 * @param keys - Array of keys to restore (should match middleware keys)
 * @returns Partial state object (sync) or Promise of partial state (async)
 * 
 * @example
 * ```ts
 * // Sync — localStorage
 * const persisted = loadPersistedState(localStorage, 'myapp', ['theme']);
 * const store = createStoreState({ theme: 'light', ...persisted });
 * 
 * // Async — React Native AsyncStorage
 * const persisted = await loadPersistedState(AsyncStorage, 'myapp', ['theme']);
 * const store = createStoreState({ theme: 'light', ...persisted });
 * ```
 */
export function loadPersistedState<T extends object>(
  storage: Storage | StorageSupportingInterface,
  persistKey: string,
  keys: (keyof T)[]
): Partial<T>;
export function loadPersistedState<T extends object>(
  storage: AsyncStorageSupportingInterface,
  persistKey: string,
  keys: (keyof T)[]
): Promise<Partial<T>>;
export function loadPersistedState<T extends object>(
  storage: AnyStorage,
  persistKey: string,
  keys: (keyof T)[]
): Partial<T> | Promise<Partial<T>> {
  const result: Partial<T> = {};
  const pending: Promise<void>[] = [];

  for (const key of keys) {
    const storageKey = `${persistKey}:${String(key)}`;
    try {
      const stored = storage.getItem(storageKey);
      if (isThenable(stored)) {
        pending.push(
          stored.then(value => {
            if (value !== null) result[key] = JSON.parse(value as string);
          }).catch(error => {
            console.warn(`Failed to load persisted key ${String(key)}:`, error);
          })
        );
      } else if (stored !== null) {
        result[key] = JSON.parse(stored as string);
      }
    } catch (error) {
      console.warn(`Failed to load persisted key ${String(key)}:`, error);
    }
  }

  if (pending.length > 0) {
    return Promise.all(pending).then(() => result);
  }

  return result;
}