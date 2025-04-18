import { useRef, useSyncExternalStore } from 'react';
type StoreListener = () => void;

export function createStoreState<T>(initialState: T) {
  let state = initialState;

  // Map from key to set of subscribers interested in that key
  const keyListeners = new Map<keyof T, Set<StoreListener>>();

  const get = () => state;

  const set = (next: Partial<T>) => {
    let changed = false;
    const updatedKeys: (keyof T)[] = [];

    for (const key in next) {
      if (!Object.is(state[key], next[key])) {
        changed = true;
        updatedKeys.push(key);
      }
    }

    if (!changed) return;

    state = { ...state, ...next };

    for (const key of updatedKeys) {
      keyListeners.get(key)?.forEach(listener => listener());
    }
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

  return { get, set, subscribe };
}

type StoreType<T> = ReturnType<typeof createStoreState<T>>;
type PrimitiveKey<T> = keyof T;
type CompareFn<V> = (prev: V, next: V) => boolean;

type KeySelector<T> = PrimitiveKey<T>;
type CustomSelector<T> = { [K in keyof T]?: CompareFn<T[K]> };
type SelectorInput<T> = ReadonlyArray<KeySelector<T> | CustomSelector<T>>;

type ExtractSelectorKeys<T, S extends SelectorInput<T>> = {
  [K in S[number] extends infer Item
    ? Item extends keyof T
      ? Item
      : keyof Item
    : never]: T[K];
};

type Picked<T, S extends SelectorInput<T>> = ExtractSelectorKeys<T, S>;

type NormalizedSelector<T> = {
  key: keyof T;
  compare?: CompareFn<T[keyof T]>;
};

export function useStoreSelector<T, S extends SelectorInput<T>>(
  store: StoreType<T>,
  selector: S
): Picked<T, S> {
  const lastState = useRef(store.get());
  const lastSelected = useRef<Partial<T>>({});

  const normalized = selector.flatMap((item): NormalizedSelector<T>[] => {
    if (typeof item === 'string') {
      return [{ key: item as keyof T }];
    }
    return Object.entries(item).map(([key, compare]) => ({
      key: key as keyof T,
      compare: compare as CompareFn<T[keyof T]>,
    }));
  });

  const getSnapshot = () => {
    const current = store.get();
    const prev = lastState.current;

    const isFirstRun = !lastSelected.current || Object.keys(lastSelected.current).length === 0;

    const changed = isFirstRun || normalized.some(({ key, compare }) => {
      const prevVal = prev[key];
      const nextVal = current[key];
      return compare ? compare(prevVal, nextVal) : !Object.is(prevVal, nextVal);
    });

    if (!changed) {
      return lastSelected.current as Picked<T, S>;
    }

    lastState.current = current;

    const nextSelected: Partial<T> = {};

    for (const { key, compare } of normalized) {
      const prevVal = lastSelected.current[key];
      const nextVal = current[key];
      const hasChanged = compare
        ? compare(prevVal as T[keyof T], nextVal as T[keyof T])
        : !Object.is(prevVal, nextVal);

      nextSelected[key] = hasChanged ? nextVal : prevVal;
    }

    lastSelected.current = nextSelected;

    return nextSelected as Picked<T, S>;
  };

  const staticSnapshot = (() => {
    const current = store.get();
    return normalized.reduce((acc, { key }) => {
      acc[key] = current[key];
      return acc;
    }, {} as Partial<T>) as Picked<T, S>;
  })();
  
  const subscribe = (onStoreChange: () => void) =>
    store.subscribe(normalized.map(sel => sel.key), onStoreChange);
  return useSyncExternalStore(subscribe, getSnapshot, () => staticSnapshot);
}