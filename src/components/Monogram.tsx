import { useState } from 'react';
import type { Hero } from '../lib/types';

/**
 * ภาพตัวแทนฮีโร่
 * - ถ้ามีภาพในเครื่อง (public/hero-images, ใช้ได้เฉพาะ dev หรือ build ที่ได้รับอนุญาต) แสดงภาพจริง
 * - ถ้าไม่มี/โหลดไม่ได้ ใช้ตัวอักษรย่อสีตามบทบาท (ไม่ทำภาพปลอม)
 */
export function initials(h: Pick<Hero, 'nameEn'>): string {
  const parts = h.nameEn.replace(/['’]/g, '').split(/[\s-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  const w = parts[0] ?? '?';
  return (w[0] + (w[1] ?? '')).toUpperCase();
}

export function roleKey(role: string | null | undefined): string {
  return (role ?? 'unknown').toLowerCase();
}

const failed = new Set<string>();

export function Monogram({ hero, size = 'md' }: { hero: Hero | undefined; size?: 'sm' | 'md' | 'lg' }) {
  const [broken, setBroken] = useState(false);
  if (!hero) {
    return <span className={`mono mono-${size} mono-empty`} aria-hidden="true" />;
  }
  const cls = `mono mono-${size} role-${roleKey(hero.role)}`;
  if (__HERO_IMAGES__ && !broken && !failed.has(hero.id)) {
    return (
      <span className={`${cls} has-img`} aria-hidden="true">
        <img
          src={`${import.meta.env.BASE_URL}hero-images/${hero.id}.webp`}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => {
            failed.add(hero.id);
            setBroken(true);
          }}
        />
      </span>
    );
  }
  return (
    <span className={cls} aria-hidden="true">
      {initials(hero)}
    </span>
  );
}
