import { describe, expect, it } from 'vitest';
import { sanitize } from './storage';
import { dataset } from './data';

const ids = dataset.heroes.map((h) => h.id);

describe('sanitize (ตรวจข้อมูลที่โหลดจากเบราว์เซอร์)', () => {
  it('รับข้อมูลที่ถูกต้อง', () => {
    const s = sanitize(
      { enemies: [{ heroId: ids[0], lane: 'jungle' }, { heroId: null, lane: null }, {}, {}, {}], includeUnverified: false },
      dataset,
    );
    expect(s?.enemies[0]).toEqual({ heroId: ids[0], lane: 'jungle' });
    expect(s?.enemies.slice(1).every((e) => e.heroId === null && e.lane === null)).toBe(true);
    expect(s?.includeUnverified).toBe(false);
  });

  it('ตัดฮีโร่ที่ไม่รู้จัก ฮีโร่ซ้ำ เลนผิด และเลนซ้ำ', () => {
    const s = sanitize(
      {
        enemies: [
          { heroId: ids[0], lane: 'jungle' },
          { heroId: ids[0], lane: 'roaming' }, // ฮีโร่ซ้ำ
          { heroId: 'fake-hero', lane: 'midlane' }, // ไม่มีในรายชื่อ
          { heroId: ids[1], lane: 'jungle' }, // เลนซ้ำ
          { heroId: ids[2], lane: 'top-lane' }, // เลนไม่ถูกต้อง
        ],
      },
      dataset,
    )!;
    expect(s.enemies.map((e) => e.heroId)).toEqual([ids[0], null, null, ids[1], ids[2]]);
    expect(s.enemies.map((e) => e.lane)).toEqual(['jungle', null, null, null, null]);
    expect(s.includeUnverified).toBe(true);
  });

  it('ปฏิเสธรูปแบบที่ผิด', () => {
    expect(sanitize(null, dataset)).toBeNull();
    expect(sanitize({ enemies: [] }, dataset)).toBeNull();
    expect(sanitize('x', dataset)).toBeNull();
  });
});
