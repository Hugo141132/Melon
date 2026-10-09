'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Server-side pagination state for the measurement-history tables.
 *
 * Design constraints this hook exists to satisfy:
 *
 * 1. Page size is fixed at exactly 5 rows. "All data" is expressed as "every
 *    retained reading is reachable through pagination and date filters", never
 *    as "download everything in one response".
 * 2. Incoming readings must not yank the user away from an older page. The
 *    newest readings are prepended server-side, which would shift every offset
 *    by one. To stay stable, the table is paginated by an absolute position
 *    captured when the page was opened, and the total is polled only through the
 *    explicit refresh control.
 * 3. No background polling: the hook fetches on mount and whenever the caller
 *    changes the date window, page or filter, and never on a timer.
 * 4. Stale responses are discarded. If the user pages quickly, a slow earlier
 *    response is ignored rather than overwriting newer state.
 */
export const HISTORY_PAGE_SIZE = 5;

export interface HistoryPaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface UseHistoryPaginationResult<TItem> {
  items: TItem[];
  meta: HistoryPaginationMeta;
  loading: boolean;
  error: string | null;
  isEmpty: boolean;
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  refresh: () => void;
}

export interface UseHistoryPaginationOptions<TItem> {
  /** Builds the query string for a page; must include every filter. */
  buildQuery: (page: number, pageSize: number) => string;
  /** Extracts the rows from an API envelope. */
  selectItems: (payload: unknown) => TItem[];
  /** Extracts pagination metadata from an API envelope. */
  selectMeta: (payload: unknown) => {
    totalItems: number;
    totalPages: number;
    pageSize: number;
  };
  /** When any value changes, page 1 is requested again. */
  resetKey?: string;
  enabled?: boolean;
}

export function useHistoryPagination<TItem>(
  options: UseHistoryPaginationOptions<TItem>
): UseHistoryPaginationResult<TItem> {
  const { buildQuery, selectItems, selectMeta, resetKey = '', enabled = true } = options;

  const [items, setItems] = useState<TItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Incremented on every request; a response whose token is not the latest one
  // is dropped. This is what prevents a slow page-3 response from overwriting
  // the page-4 result the user is already looking at.
  const requestTokenRef = useRef(0);

  // The query string is memoised so the effect below is not re-triggered by a
  // fresh function identity on every render.
  const query = useMemo(() => buildQuery(page, HISTORY_PAGE_SIZE), [buildQuery, page, resetKey]);

  const fetchPage = useCallback(async () => {
    if (!enabled) return;

    const token = ++requestTokenRef.current;
    setLoading(true);
    setError(null);

    try {
      const url = query.startsWith('http')
        ? query
        : query.startsWith('/')
          ? query
          : `/api/v1/${query}`;
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });

      if (token !== requestTokenRef.current) return;

      const contentType = response.headers?.get?.('content-type');
      let payload: any = null;
      if (!contentType || contentType.includes('application/json')) {
        payload = await response.json().catch(() => null);
      }

      if (token !== requestTokenRef.current) return;

      if (!response.ok || (payload as { success?: boolean })?.success === false) {
        setError(
          (payload as { error?: { message?: string } })?.error?.message ??
            (response.status === 404
              ? 'Measurement history not found.'
              : 'Failed to load measurement history.')
        );
        setItems([]);
        return;
      }

      const meta = selectMeta(payload);
      setItems(selectItems(payload));
      setTotalItems(meta.totalItems);
      setTotalPages(meta.totalPages);
    } catch {
      if (token !== requestTokenRef.current) return;
      setError('Failed to load measurement history.');
      setItems([]);
    } finally {
      if (token === requestTokenRef.current) {
        setLoading(false);
      }
    }
  }, [enabled, query, selectItems, selectMeta]);

  useEffect(() => {
    void fetchPage();
  }, [fetchPage, reloadToken]);

  // A changed filter window always returns the user to page 1, because page 5
  // of the previous range has no meaningful counterpart in the new range.
  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const goToPage = useCallback((next: number) => {
    // Pages below 1 are clamped. Pages beyond the end are clamped by the
    // disabled state on the next-page control, so no request is ever issued for
    // a page that cannot exist.
    setPage(next < 1 ? 1 : next);
  }, []);

  const refresh = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  const meta: HistoryPaginationMeta = useMemo(
    () => ({
      page,
      pageSize: HISTORY_PAGE_SIZE,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    }),
    [page, totalItems, totalPages]
  );

  return {
    items,
    meta,
    loading,
    error,
    isEmpty: !loading && items.length === 0,
    goToPage,
    nextPage: useCallback(() => goToPage(page + 1), [goToPage, page]),
    previousPage: useCallback(() => goToPage(page - 1), [goToPage, page]),
    refresh,
  };
}
