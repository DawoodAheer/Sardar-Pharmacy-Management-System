import { useCallback, useState } from 'react';

// Reset pagination before children/query observers receive the new filter scope.
// A guarded render adjustment avoids committing a stale page and resetting in an effect.
export default function useScopedPage(scope) {
  const [state, setState] = useState(() => ({ scope, page: 1 }));
  if (state.scope !== scope) setState({ scope, page: 1 });

  const setPage = useCallback(value => {
    setState(previous => {
      const currentPage = previous.scope === scope ? previous.page : 1;
      return { scope, page: typeof value === 'function' ? value(currentPage) : value };
    });
  }, [scope]);

  return [state.scope === scope ? state.page : 1, setPage];
}
