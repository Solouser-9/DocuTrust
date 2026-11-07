import { useEffect, useRef, useState } from 'react';

// Binds a presenter instance to a component: state mirror via useState,
// attach on mount, destroy on unmount. The view stays dumb.
export function usePresenter(factory) {
  const ref = useRef(null);
  if (ref.current === null) ref.current = factory();
  const presenter = ref.current;
  const [state, setState] = useState(presenter.state);

  useEffect(() => {
    presenter.attach(setState);
    return () => presenter.destroy();
  }, [presenter]);

  return [state, presenter];
}
