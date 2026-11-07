import { useCallback, useState } from 'react';

// Wires a presenter's refresh() to a RefreshControl without re-render churn.
export function usePullRefresh(refreshFn) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshFn();
    } finally {
      setRefreshing(false);
    }
  }, [refreshFn]);
  return { refreshing, onRefresh };
}
