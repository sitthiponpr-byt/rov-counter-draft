import { describe, expect, it } from 'vitest';
import { recommend, suggestLane, validateEnemies, lanesWithData, type EnemySlot } from './engine';
import type { CounterRow, Dataset, IdentityStatus, LaneId, Slot } from './types';
import { LANES } from './types';
import { dataset, meta } from './data';

const hero = (id: string, role: string | null, lanes: LaneId[] = []) => ({
  id, nameEn: id.toUpperCase(), nameTh: null, role, enemyLanes: lanes,
});
const slot = (position: number, count: number, ...heroes: [string | null, IdentityStatus][]): Slot => ({
  position,
  mark: { symbol: 'star', count },
  heroes: heroes.map(([id, status]) => ({ id, identity: { status } })),
});
const emptyAvoid: Slot[] = [slot(1, 3, [null, 'unreadable']), slot(2, 2, [null, 'unreadable']), slot(3, 1, [null, 'unreadable'])];
const row = (lane: LaneId, enemyId: string, good: Slot[], avoid: Slot[] = emptyAvoid): CounterRow => ({
  id: `${lane}:${enemyId}`, lane, enemyId, enemyCaption: enemyId, sourcePage: 1, good, avoid,
});
const E = (heroId: string | null, lane: LaneId | null): EnemySlot => ({ heroId, lane });
const none: EnemySlot[] = [E(null, null), E(null, null), E(null, null), E(null, null), E(null, null)];
const opts = { includeUnverified: true };

const base: Dataset = {
  heroes: [
    hero('e1', 'Warrior', ['dark-slayer']), hero('e2', 'Mage', ['jungle', 'midlane']), hero('e3', 'Tank', ['roaming']),
    hero('e4', 'Marksman', []),
    hero('a', 'Warrior'), hero('b', 'Assassin'), hero('c', 'Mage'), hero('d', 'Tank'), hero('f', 'Marksman'),
  ],
  rows: [
    row('dark-slayer', 'e1', [slot(1, 1, ['a', 'system-verified']), slot(2, 3, ['b', 'system-verified'])]),
    row('jungle', 'e2', [slot(1, 2, ['b', 'system-verified'])]),
    row('midlane', 'e2', [slot(1, 2, ['c', 'system-verified'])]),
    row('roaming', 'e3', [slot(1, 1, ['d', 'unverified'])]),
  ],
};

describe('recommend', () => {
  it('ไม่สร้างคำแนะนำเมื่อยังไม่ได้เลือกศัตรู', () => {
    const r = recommend(base, none, opts);
    expect(r.team.every((t) => t === null)).toBe(true);
    expect(r.lanes.every((l) => l.status === 'no-enemy')).toBe(true);
  });

  it('เลือกตัวที่ดาวมากกว่าก่อน (3 ดาว = แก้ทางดีที่สุด)', () => {
    const a = recommend(base, [E('e1', 'dark-slayer'), ...none.slice(1)], opts);
    expect(a.lanes[0].pick?.heroId).toBe('b'); // b ได้ 3 ดาว, a ได้ 1 ดาว
    const swapped: Dataset = {
      ...base,
      rows: [row('dark-slayer', 'e1', [slot(1, 3, ['a', 'system-verified']), slot(2, 1, ['b', 'system-verified'])])],
    };
    const b = recommend(swapped, [E('e1', 'dark-slayer'), ...none.slice(1)], opts);
    expect(b.lanes[0].pick?.heroId).toBe('a');
    expect(a.counterEvidence.starSum).toBe(3);
  });

  it('ดาวเท่ากัน: ใช้ ROV META เป็นตัวตัดสิน (เห็นด้วย > ไม่มีข้อมูล > เห็นต่าง)', () => {
    const d: Dataset = {
      ...base,
      rows: [row('dark-slayer', 'e1', [slot(1, 2, ['a', 'system-verified']), slot(2, 2, ['b', 'system-verified'])])],
    };
    const rm = {
      e1: { weakAgainst: ['b'], strongAgainst: ['a'], bestSynergy: [] },
    };
    const r = recommend(d, [E('e1', 'dark-slayer'), ...none.slice(1)], { includeUnverified: true, rovmeta: rm });
    expect(r.lanes[0].pick?.heroId).toBe('b');
    expect(r.lanes[0].pick?.support).toBe('agree');
    expect(r.lanes[0].alternates[0]).toMatchObject({ heroId: 'a', support: 'disagree' });
  });

  it('รายการห้ามเลือกเรียงจากหัวกะโหลกมากไปน้อย (3 = ห้ามเลือกมากที่สุด)', () => {
    const skull = (position: number, count: number, id: string): Slot => ({
      position, mark: { symbol: 'skull', count }, heroes: [{ id, identity: { status: 'system-verified' } }],
    });
    const d: Dataset = {
      ...base,
      rows: [row('dark-slayer', 'e1', [slot(1, 1, ['a', 'system-verified'])], [skull(1, 1, 'c'), skull(2, 3, 'd'), skull(3, 2, 'f')])],
    };
    const r = recommend(d, [E('e1', 'dark-slayer'), ...none.slice(1)], opts);
    expect(r.lanes[0].avoid.map((x) => x.heroId)).toEqual(['d', 'f', 'c']);
  });

  it('ROV META ไม่ข้ามระดับดาวของเอกสารหลัก', () => {
    const rm = { e1: { weakAgainst: ['a'], strongAgainst: [], bestSynergy: [] } };
    const r = recommend(base, [E('e1', 'dark-slayer'), ...none.slice(1)], { includeUnverified: true, rovmeta: rm });
    expect(r.lanes[0].pick?.heroId).toBe('b'); // b 3 ดาว ชนะ a 1 ดาวแม้ ROV META สนับสนุน a
  });

  it('เลือกตัวที่ยืนยันตัวตนแล้วก่อนตัวที่ยังไม่ยืนยัน', () => {
    const d: Dataset = {
      ...base,
      rows: [row('midlane', 'e2', [slot(1, 1, ['a', 'unverified']), slot(2, 1, ['c', 'human-confirmed']), slot(3, 1, ['b', 'system-verified'])])],
    };
    const r = recommend(d, [E('e2', 'midlane'), ...none.slice(1)], opts);
    expect(r.lanes[2].pick?.heroId).toBe('c');
    expect(r.lanes[2].alternates.map((x) => x.heroId)).toEqual(['b', 'a']);
  });

  it('ซ่อน unverified ได้ และรายงานข้อมูลไม่พอแทนการเดา', () => {
    const r = recommend(base, [E('e3', 'roaming'), ...none.slice(1)], { includeUnverified: false });
    const lane = r.lanes.find((l) => l.lane === 'roaming')!;
    expect(lane.status).toBe('no-usable-candidates');
    expect(lane.pick).toBeNull();
    const withIt = recommend(base, [E('e3', 'roaming'), ...none.slice(1)], opts);
    expect(withIt.lanes.find((l) => l.lane === 'roaming')!.pick?.identity).toBe('unverified');
    expect(withIt.counterEvidence.unverifiedPicks).toBe(1);
  });

  it('ไม่มีแถวข้อมูล = no-data และไม่มีคำแนะนำ', () => {
    const r = recommend(base, [E('e4', 'midlane'), ...none.slice(1)], opts);
    const lane = r.lanes.find((l) => l.lane === 'midlane')!;
    expect(lane.status).toBe('no-data');
    expect(lane.pick).toBeNull();
    expect(r.counterEvidence).toMatchObject({ lanesWithEvidence: 0, lanesAssigned: 1 });
  });

  it('ตัดตัวตนที่อ่านไม่ได้และขัดแย้งออก', () => {
    const d: Dataset = {
      ...base,
      rows: [row('jungle', 'e2', [slot(1, 1, [null, 'unreadable'], ['a', 'conflict']), slot(2, 1, ['b', 'system-verified'])])],
    };
    const r = recommend(d, [E('e2', 'jungle'), ...none.slice(1)], opts);
    const lane = r.lanes.find((l) => l.lane === 'jungle')!;
    expect(lane.pick?.heroId).toBe('b');
    expect(lane.excluded.map((x) => x.reason).sort()).toEqual(['conflict', 'unreadable']);
  });

  it('ไม่แนะนำฮีโร่ซ้ำในทีมเดียวกัน', () => {
    const d: Dataset = {
      ...base,
      rows: [
        row('dark-slayer', 'e1', [slot(1, 1, ['b', 'system-verified'])]),
        row('jungle', 'e2', [slot(1, 1, ['b', 'system-verified'])]),
      ],
    };
    const r = recommend(d, [E('e1', 'dark-slayer'), E('e2', 'jungle'), ...none.slice(2)], opts);
    const picked = r.team.filter(Boolean);
    expect(new Set(picked).size).toBe(picked.length);
    expect(picked).toEqual(['b']); // อีกเลนต้องว่าง ไม่ซ้ำและไม่เดาตัวอื่น
    expect(r.lanes.filter((l) => l.status === 'ok' && !l.pick)).toHaveLength(1);
  });

  it('ไม่แนะนำฮีโร่ที่ศัตรูเลือกไปแล้ว', () => {
    const d: Dataset = {
      ...base,
      rows: [row('dark-slayer', 'e1', [slot(1, 1, ['e3', 'system-verified'], ['a', 'system-verified'])])],
    };
    const r = recommend(d, [E('e1', 'dark-slayer'), E('e3', 'roaming'), ...none.slice(2)], opts);
    expect(r.lanes[0].pick?.heroId).toBe('a');
    expect(r.lanes[0].excluded.map((x) => x.reason)).toContain('enemy-picked');
  });

  it('ผลคงที่เมื่อรันซ้ำ (deterministic)', () => {
    const sel = [E('e1', 'dark-slayer'), E('e2', 'jungle'), E('e3', 'roaming'), ...none.slice(3)];
    expect(JSON.stringify(recommend(base, sel, opts))).toBe(JSON.stringify(recommend(base, sel, opts)));
  });

  it('ความสมดุลเป็นข้อมูลแยกจากคะแนนแก้ทาง และบอกธงเมื่อขาดบทบาท', () => {
    const r = recommend(base, [E('e1', 'dark-slayer'), ...none.slice(1)], opts);
    expect(r.balance.distinctRoles).toBe(1);
    expect(r.balance.flags.join(' ')).toMatch(/Tank หรือ Support/);
  });
});

describe('validateEnemies / suggestLane', () => {
  it('ตรวจฮีโร่ซ้ำและเลนซ้ำ', () => {
    expect(validateEnemies([E('x', 'jungle'), E('x', 'roaming')])).toContain('เลือกฮีโร่ฝ่ายตรงข้ามซ้ำกัน');
    expect(validateEnemies([E('x', 'jungle'), E('y', 'jungle')])).toContain('กำหนดเลนซ้ำกันมากกว่าหนึ่งตัว');
    expect(validateEnemies([E('x', 'jungle'), E('y', 'roaming')])).toEqual([]);
  });
  it('ตั้งเลนอัตโนมัติเฉพาะเมื่อมีข้อมูลเลนเดียวและเลนนั้นว่าง', () => {
    expect(suggestLane(base, 'e1', [])).toBe('dark-slayer');
    expect(suggestLane(base, 'e1', ['dark-slayer'])).toBeNull();
    expect(suggestLane(base, 'e2', [])).toBeNull(); // มีสองเลน ให้ผู้ใช้เลือก
    expect(suggestLane(base, 'e4', [])).toBeNull();
  });
});

describe('ข้อมูลจริงของโปรเจกต์', () => {
  it('โครงสร้างข้อมูลครบและสอดคล้อง', () => {
    expect(dataset.heroes).toHaveLength(132);
    expect(dataset.rows).toHaveLength(108);
    const ids = new Set(dataset.heroes.map((h) => h.id));
    expect(ids.size).toBe(132);
    for (const r of dataset.rows) {
      expect(ids.has(r.enemyId)).toBe(true);
      expect(r.good).toHaveLength(3);
      expect(r.avoid).toHaveLength(3);
      for (const s of [...r.good, ...r.avoid]) {
        expect(s.heroes.length).toBeGreaterThanOrEqual(1);
        expect(s.heroes.length).toBeLessThanOrEqual(2);
        for (const h of s.heroes) if (h.id) expect(ids.has(h.id)).toBe(true);
      }
    }
    expect(new Set(dataset.rows.map((r) => r.id)).size).toBe(108);
    expect(dataset.heroes.filter((h) => h.enemyLanes.length === 0)).toHaveLength(meta.counts.heroesWithoutEnemyData);
  });

  it('ไม่มีข้อมูลที่อ้างว่ายืนยันสูงกว่าความจริง และความหมายดาว/กะโหลกยังเป็น unknown', () => {
    expect(meta.sources.counters.rankSemantics.star).toBe('higher-is-stronger-counter');
    expect(meta.sources.counters.rankSemantics.skull).toBe('higher-is-stronger-avoid');
    expect(meta.sources.counters.rightsStatus).toBe('unconfirmed');
    expect(meta.counts.identityCells['human-confirmed']).toBeLessThanOrEqual(6);
    const kinds = new Set<string>();
    for (const r of dataset.rows) for (const s of [...r.good, ...r.avoid]) for (const h of s.heroes) kinds.add(h.identity.status);
    expect([...kinds].every((k) => ['human-confirmed', 'system-verified', 'unverified', 'unreadable', 'conflict'].includes(k))).toBe(true);
    // ข้อมูลทีมไม่มีฟิลด์สถิติ
    const json = JSON.stringify(dataset.rows).toLowerCase();
    for (const bad of ['winrate', 'win_rate', 'pickrate', 'tier']) expect(json.includes(bad)).toBe(false);
  });

  it('ทุกการเลือกศัตรู 5 ตัวแบบสุ่ม (seed คงที่) ไม่ทำให้ทีมซ้ำหรือ crash', () => {
    let seed = 20261022;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
    for (let t = 0; t < 300; t++) {
      const heroes = [...dataset.heroes].sort(() => rnd() - 0.5).slice(0, 5);
      const laneOrder = [...LANES].sort(() => rnd() - 0.5);
      const sel = heroes.map((h, i) => {
        const ls = lanesWithData(dataset, h.id);
        return E(h.id, ls.length && rnd() < 0.8 ? ls[0] : laneOrder[i]);
      });
      const fixed = sel.filter((s, i) => sel.findIndex((x) => x.lane === s.lane) === i); // เลนไม่ซ้ำ
      const r = recommend(dataset, [...fixed, ...Array(5 - fixed.length).fill(E(null, null))], { includeUnverified: rnd() < 0.5 });
      const picked = r.team.filter(Boolean);
      expect(new Set(picked).size).toBe(picked.length);
      const enemyIds = fixed.map((f) => f.heroId);
      for (const p of picked) expect(enemyIds).not.toContain(p as string);
      for (const l of r.lanes) if (l.pick) expect(l.status).toBe('ok');
    }
  });
});
