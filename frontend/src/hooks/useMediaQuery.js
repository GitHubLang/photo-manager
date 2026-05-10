import { useState, useEffect } from 'react';

/**
 * 响应式媒体查询 hook
 * 只在需要 JS 行为差异时使用（如翻页 vs 无限滚动）
 * 纯视觉差异请用 CSS 媒体查询
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    setMatches(mql.matches);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}
