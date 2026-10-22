import type { SVGProps } from 'react';
import type { LaneId } from '../lib/types';

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 18): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
});

export const LogoMark = ({ size = 34, ...p }: P) => (
  <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden focusable={false} {...p}>
    <defs>
      <linearGradient id="lg-logo" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="var(--accent)" />
        <stop offset="1" stopColor="var(--gold)" />
      </linearGradient>
    </defs>
    <path d="M20 2 36 11v18L20 38 4 29V11z" fill="none" stroke="url(#lg-logo)" strokeWidth="2.5" />
    <path d="M13 26 20 12l7 14M15.6 21h8.8" fill="none" stroke="var(--text-1)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconSearch = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);
export const IconPlus = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconClose = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const IconSwap = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" /></svg>
);
export const IconCheck = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="m5 12 5 5 9-10" /></svg>
);
export const IconAlert = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17h.01" /></svg>
);
export const IconInfo = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
);
export const IconShield = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z" /></svg>
);
export const IconReset = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M4 4v6h6" /><path d="M5.5 15a7 7 0 1 0 1.7-7.3L4 10" /></svg>
);
export const IconChevron = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="m9 6 6 6-6 6" /></svg>
);

/** สัญลักษณ์เลน: รูปทรงเรขาคณิตเรียบง่าย ไม่ใช่ไอคอนทางการของเกม */
export function LaneIcon({ lane, size = 18 }: { lane: LaneId; size?: number }) {
  const b = base(size);
  switch (lane) {
    case 'dark-slayer':
      return <svg {...b}><path d="M5 19 17 7M14 4h6v6M7 15l2 2M4 20l2-2" /></svg>;
    case 'jungle':
      return <svg {...b}><path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z" /><path d="M5 19 13 11" /></svg>;
    case 'midlane':
      return <svg {...b}><path d="M12 3 21 12 12 21 3 12z" /><path d="M12 8v8" /></svg>;
    case 'abyssal-dragon':
      return <svg {...b}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>;
    case 'roaming':
      return <svg {...b}><path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z" /><path d="M9 12l2 2 4-4" /></svg>;
  }
}
