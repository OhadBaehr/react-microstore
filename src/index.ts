import { useMemo, useRef, useSyncExternalStore } from 'react'

type StoreListener = () => void;

type MiddlewareFunction<T extends object> = (
  currentState: T,
  update: Partial<T>,
  next: (modifiedUpdate?: Partial<T>) => void
) => void;

function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  return ((...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  }) as T;
}

/**
 * Creates a new reactive store with fine-grained subscriptions and middleware support.
 * 
 * @param initialState - The initial state object for the store
 * @returns Store object with methods: get, set, subscribe, select, addMiddleware
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
  let state = initialState;
  const keyListeners = new Map<keyof T, Set<StoreListener>>();
  const debouncedNotifiers = new Map<keyof T, () => void>();
  
  // Middleware storage
  const middleware: Array<{ callback: MiddlewareFunction<T>; keys: (keyof T)[] | null }> = [];



  const get = () => state;

  const set = (update: Partial<T>, debounceDelay: number | boolean = false) => {
    if (!update) return;

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
          applyUpdate(currentUpdate, debounceDelay);
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

  const applyUpdate = (processedUpdate: Partial<T>, debounceDelay: number | boolean) => {
    const updatedKeys: (keyof T)[] = [];

    for (const key in processedUpdate) {
      const typedKey = key as keyof T;
      const currentValue = state[typedKey];
      const nextValue = processedUpdate[typedKey];

      if (currentValue === nextValue) continue;

      if (!Object.is(currentValue, nextValue)) {
        state[typedKey] = nextValue!;
        updatedKeys.push(typedKey);
      }
    }

    if (updatedKeys.length === 0) return;

    for (const key of updatedKeys) {
      if (debounceDelay !== false) {
        if (!debouncedNotifiers.has(key)) {
          debouncedNotifiers.set(key, debounce(() => {
            keyListeners.get(key)?.forEach(listener => listener());
          }, typeof debounceDelay === 'number' ? debounceDelay : 0));
        }
        debouncedNotifiers.get(key)!();
      } else {
        keyListeners.get(key)?.forEach(listener => listener());
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
      if (!keyListeners.has(key)) {
        keyListeners.set(key, new Set());
      }
      keyListeners.get(key)!.add(listener);
    }

    return () => {
      for (const key of keys) {
        keyListeners.get(key)?.delete(listener);
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

  return { get, set, subscribe, select, addMiddleware };
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
  const lastSelected = useRef<Partial<T>>({});
  const prevSelector = useRef<SelectorInput<T> | null>(null);
  const normalizedRef = useRef<NormalizedSelector<T>[] | null>(null);
  const keysRef = useRef<(keyof T)[] | null>(null);
  const isFirstRunRef = useRef(true);
  const lastValues = useRef<Partial<T>>({});
  const subscribeRef = useRef<((onStoreChange: () => void) => () => void) | null>(null);
  const storeRef = useRef(store);

  const storeChanged = storeRef.current !== store;
  if (storeChanged) {
    storeRef.current = store;
    lastSelected.current = {};
    prevSelector.current = null;
    normalizedRef.current = null;
    keysRef.current = null;
    isFirstRunRef.current = true;
    lastValues.current = {};
    subscribeRef.current = null;
  }

  if (!prevSelector.current || !shallowEqualSelector(prevSelector.current, selector)) {
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

    normalizedRef.current = normalized;
    keysRef.current = keys;
    prevSelector.current = selector;
    subscribeRef.current = null;
  }

  const normalized = normalizedRef.current!;
  const keys = keysRef.current!;

  const getSnapshot = () => {
    const current = store.get();
    const isFirstRun = isFirstRunRef.current;

    if (isFirstRun) {
      isFirstRunRef.current = false;
      const result = {} as Partial<T>;
      for (const { key } of normalized) {
        const value = current[key];
        lastValues.current[key] = value;
        result[key] = value;
      }
      lastSelected.current = result;
      return result as Picked<T, S>;
    }

    const hasChanges = () => {
      for (const { key, compare } of normalized) {
        const prevVal = lastValues.current[key];
        const nextVal = current[key];
        if (prevVal === undefined ? true : (compare ? !compare(prevVal, nextVal) : !Object.is(prevVal, nextVal))) {
          return true;
        }
      }
      return false;
    };

    if (!hasChanges()) {
      return lastSelected.current as Picked<T, S>;
    }

    const result = {} as Partial<T>;
    for (const { key, compare } of normalized) {
      const prevVal = lastValues.current[key];
      const nextVal = current[key];

      const isFirstTime = prevVal === undefined;
      const changed = isFirstTime || (compare ? !compare(prevVal, nextVal) : !Object.is(prevVal, nextVal));

      if (changed) {
        lastValues.current[key] = nextVal;
        result[key] = nextVal;
      } else {
        result[key] = prevVal;
      }
    }

    lastSelected.current = result;
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

  if (!subscribeRef.current || storeChanged) {
    subscribeRef.current = (onStoreChange: () => void) =>
      store.subscribe(keys, onStoreChange);
  }

  return useSyncExternalStore(subscribeRef.current, getSnapshot, () => staticSnapshot);
}


/**
 * Interface for storage objects compatible with persistence middleware.
 * Includes localStorage, sessionStorage, AsyncStorage, or any custom storage.
 */
export interface StorageSupportingInterface {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Creates a persistence middleware that saves individual keys to storage.
 * Only writes when the specified keys actually change, using per-key storage.
 * Storage format: `${persistKey}:${keyName}` for each persisted key.
 * 
 * @param storage - Storage interface (localStorage, sessionStorage, AsyncStorage, etc.)
 * @param persistKey - Base key prefix for storage (e.g., 'myapp' creates 'myapp:theme')
 * @param keys - Array of state keys to persist
 * @returns Tuple of [middleware function, affected keys] for use with addMiddleware
 * 
 * @example
 * ```ts
 * // Add persistence for theme and user settings
 * store.addMiddleware(
 *   createPersistenceMiddleware(localStorage, 'myapp', ['theme', 'isLoggedIn'])
 * );
 * ```
 */
export function createPersistenceMiddleware<T extends object>(
  storage: Storage | StorageSupportingInterface,
  persistKey: string,
  keys: (keyof T)[]
): [MiddlewareFunction<T>, (keyof T)[]] {
  const middlewareFunction: MiddlewareFunction<T> = (_, update, next) => {
    // Check if any of the persisted keys are being updated
    const changedKeys = keys.filter(key => key in update);
    if (changedKeys.length === 0) {
      return next();
    }

    // Save each changed key individually
    for (const key of changedKeys) {
      try {
        const value = update[key];
        const storageKey = `${persistKey}:${String(key)}`;
        storage.setItem(storageKey, JSON.stringify(value));
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
 * @param storage - Storage interface to read from (same as used in middleware)
 * @param persistKey - Base key prefix used for storage (same as used in middleware)
 * @param keys - Array of keys to restore (should match middleware keys)
 * @returns Partial state object with persisted values, or empty object if loading fails
 * 
 * @example
 * ```ts
 * // Load persisted state before creating store
 * const persistedState = loadPersistedState(localStorage, 'myapp', ['theme', 'isLoggedIn']);
 * 
 * const store = createStoreState({
 *   theme: 'light',
 *   isLoggedIn: false,
 *   ...persistedState // Apply persisted values
 * });
 * ```
 */
export function loadPersistedState<T extends object>(
  storage: Storage | StorageSupportingInterface,
  persistKey: string,
  keys: (keyof T)[]
): Partial<T> {
  const result: Partial<T> = {};
  
  for (const key of keys) {
    try {
      const storageKey = `${persistKey}:${String(key)}`;
      const stored = storage.getItem(storageKey);
      if (stored !== null) {
        result[key] = JSON.parse(stored);
      }
    } catch (error) {
      console.warn(`Failed to load persisted key ${String(key)}:`, error);
    }
  }
  
  return result;
}