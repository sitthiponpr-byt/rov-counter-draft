import { describe, expect, it } from 'vitest';
import { readEnemyDraft } from './draftRead';
import { insights } from './data';
import type { Insights } from './types';

const fake: Insights = {
  sources: insights.sources,
  rovmeta: {
    x: { weakAgainst: [], strongAgainst: [], bestSynergy: ['p', 'y'] },
    y: { weakAgainst: [], strongAgainst: [], bestSynergy: ['p'] },
  },
  copick: {
    games: 10, teamGames: 20, year: '2026', leagues: [], rules: { minPicks: 1, minTogether: 1, minLift: 1 },
    heroes: {
      x: { picks: 10, partners: [{ id: 'p', together: 4, rate: 40, lift: 2 }, { id: 'q', together: 3, rate: 30, lift: 1.5 }, { id: 'y', together: 2, rate: 20, lift: 1.3 }] },
    },
  },
};

describe('readEnemyDraft', () => {
  it('รวมหลักฐานจากหลายแหล่งและเรียงตามจำนวนหลักฐาน ไม่แนะนำตัวที่ศัตรูเลือกแล้ว', () => {
    const r = readEnemyDraft(fake, ['x', 'y']);
    expect(r.likely[0].heroId).toBe('p'); // copick จาก x + ROV META จาก x และ y = 3 หลักฐาน
    expect(r.likely[0].mentions).toHaveLength(3);
    expect(r.likely.map((l) => l.heroId)).not.toContain('y'); // y ถูกศัตรูเลือกแล้ว
    expect(r.perEnemy.find((e) => e.enemyId === 'y')?.picks).toBeNull();
  });

  it('ข้อมูลจริงของโปรเจกต์: ทำงานได้กับฮีโร่ทุกตัวโดยไม่ crash', () => {
    const ids = Object.keys(insights.rovmeta);
    for (let i = 0; i + 5 <= ids.length; i += 5) {
      const r = readEnemyDraft(insights, ids.slice(i, i + 5));
      for (const l of r.likely) expect(ids.slice(i, i + 5)).not.toContain(l.heroId);
    }
    expect(insights.copick?.games).toBeGreaterThan(0);
  });
});
