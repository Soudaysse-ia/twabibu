'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api';

/** Loads a back-office resource; `reload` after an action. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    if (!path) return;
    setError(null);
    api<T>(path).then(setData).catch((e) => setError(errorMessage(e)));
  }, [path]);
  useEffect(reload, [reload]);
  return { data, error, reload, setData };
}
