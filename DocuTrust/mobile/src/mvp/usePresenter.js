import { useState, useEffect, useRef } from 'react';

export function usePresenter(createPresenter) {
  const presenterRef = useRef(null);
  const isMounted = useRef(true);

  // Using JSDoc to tell IntelliJ to relax its strict type checking on the generic state object.
  const [state, setState] = useState(/** @type {any} */ ({
    status: 'idle',
    data: {},
    fieldErrors: {},
    error: null,
  }));

  if (!presenterRef.current) {
    presenterRef.current = createPresenter();
    // Inject the setState so the presenter can trigger UI updates
    presenterRef.current.setState = (newState) => {
      if (isMounted.current) {
        setState((prev) => ({ ...prev, ...newState }));
      }
    };
    // Inject the state getter so the presenter can read current state
    presenterRef.current.state = state;
  }

  // Update presenter's reference to the latest state on every render
  presenterRef.current.state = state;

  useEffect(() => {
    isMounted.current = true;

    // Call an optional init method on the presenter when the screen mounts
    if (presenterRef.current.init) {
      presenterRef.current.init();
    }

    return () => {
      // When the user leaves the screen, this runs, preventing memory leaks.
      isMounted.current = false;
    };
  }, []);

  return [state, presenterRef.current];
}