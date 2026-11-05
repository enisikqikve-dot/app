import { useEffect, useState } from 'preact/hooks';
import type { Store } from '../core/store';

export function useStore<T extends object>(store: Store<T>): T {
  const [state, setState] = useState(store.get());
  useEffect(() => {
    setState(store.get());
    const off = store.subscribe(setState);
    return () => {
      off();
    };
  }, [store]);
  return state;
}
