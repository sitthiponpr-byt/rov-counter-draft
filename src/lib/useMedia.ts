import { useEffect, useState } from 'react';

/** true เมื่อหน้าจอตรงกับ media query; ถ้าเบราว์เซอร์/สภาพแวดล้อมไม่รองรับ matchMedia ให้ใช้ค่า fallback */
export function useMedia(query: string, fallback = true): boolean {
  const get = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : fallback;
  const [match, setMatch] = useState(get);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const m = window.matchMedia(query);
    const on = () => setMatch(m.matches);
    on();
    m.addEventListener?.('change', on);
    return () => m.removeEventListener?.('change', on);
  }, [query]);
  return match;
}
