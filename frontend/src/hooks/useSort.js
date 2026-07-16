import { useState } from 'react';

// Reusable column sorter. `accessors` maps a sort key → fn(row) => comparable value.
// Numbers sort numerically; strings via locale-aware compare; null/undefined sort last.
export function useSort(defaultKey, defaultDir = 'asc') {
  const [sort, setSort] = useState({ key: defaultKey, dir: defaultDir });

  const toggle = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  const sortRows = (rows, accessors) => {
    const acc = accessors[sort.key];
    if (!acc) return rows;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = acc(a);
      const vb = acc(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1; // nulls last regardless of direction
      if (vb == null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return dir * (va - vb);
      return dir * String(va).localeCompare(String(vb), undefined, { numeric: true });
    });
  };

  return { sort, toggle, sortRows };
}
