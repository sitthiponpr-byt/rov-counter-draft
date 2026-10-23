import { describe, expect, it } from 'vitest';
import { suggestBans, suggestPicks } from './draftAdvice';
import { dataset, insights } from './data';
import type { Dataset, Insights } from './types';

const name = (id: string) => id;
const all = () => true;

const data: Dataset = {
  heroes: [],
  rows: [
    {
      id: 'jungle:e1', lane: 'jungle', enemyId: 'e1', enemyCaption: 'E1', sourcePage: 1,
      good: [
        { position: 1, mark: { symbol: 'star', count: 1 }, heroes: [{ id: 'low', identity: { status: 'system-verified' } }] },
        { position: 3, mark: { symbol: 'star', count: 3 }, heroes: [{ id: 'top', identity: { status: 'system-verified' } }] },
      ],
      avoid: [{ position: 1, mark: { symbol: 'skull', count: 3 }, heroes: [{ id: 'bad', identity: { status: 'system-verified' } }] }],
    },
  ],
};
const ins: Insights = {
  ...insights,
  rovmeta: {
    e1: { weakAgainst: ['rm'], strongAgainst: ['top'], bestSynergy: ['combo'], lane: 'jungle' },
    mine: { weakAgainst: ['threat'], strongAgainst: [], bestSynergy: ['buddy'], lane: 'midlane' },
  },
  copick: null,
  prostats: null,
  tierSources: [],
};
const ctx = { data, insights: ins, name };

describe('suggestPicks', () => {
  it('ดาวมากได้คะแนนสูงกว่า และตัวที่ห้ามเลือกไม่ถูกแนะนำ', () => {
    const r = suggestPicks(ctx, [], ['e1'], all);
    const ids = r.map((a) => a.heroId);
    expect(ids).toContain('top');
    expect(ids.indexOf('top')).toBeLessThan(ids.indexOf('low'));
    expect(ids).not.toContain('bad');
    // top: +3 (QZADD) −1.5 (ROV META บอกว่าแพ้ทาง e1) → ยังเหลือคะแนนบวก และมีเหตุผลครบทั้งสองแหล่ง
    const top = r.find((a) => a.heroId === 'top')!;
    expect(top.reasons.map((x) => x.source).sort()).toEqual(['qzadd', 'rovmeta']);
    expect(top.score).toBeCloseTo(1.5);
  });

  it('ไม่แนะนำฮีโร่ที่หยิบไม่ได้ตามกติกา', () => {
    const r = suggestPicks(ctx, [], ['e1'], (id) => id !== 'top');
    expect(r.map((a) => a.heroId)).not.toContain('top');
  });

  it('ให้คะแนนคู่หูของฮีโร่ในทีมตัวเอง', () => {
    const r = suggestPicks(ctx, ['mine'], [], all);
    expect(r.map((a) => a.heroId)).toContain('buddy');
  });
});

describe('suggestBans', () => {
  it('แนะนำแบนตัวที่แก้ทางฮีโร่ของเรา และคอมโบของคู่แข่ง', () => {
    const r = suggestBans(ctx, ['mine'], ['e1'], all).map((a) => a.heroId);
    expect(r).toContain('threat');
    expect(r).toContain('combo');
  });
  it('ไม่แนะนำแบนตัวที่คู่แข่งใช้ไม่ได้อยู่แล้ว', () => {
    const r = suggestBans(ctx, ['mine'], [], (id) => id !== 'threat').map((a) => a.heroId);
    expect(r).not.toContain('threat');
  });
});

describe('ข้อมูลจริง', () => {
  it('ทำงานได้ทั้งก่อนเริ่มพิคและระหว่างพิค โดยทุกคำแนะนำมีเหตุผลและแหล่งที่มา', () => {
    const realCtx = { data: dataset, insights, name };
    const empty = suggestPicks(realCtx, [], [], all);
    expect(empty.length).toBeGreaterThan(0);
    const mid = suggestPicks(realCtx, ['airi'], ['keera', 'dolia'], (id) => !['airi', 'keera', 'dolia'].includes(id));
    expect(mid.length).toBeGreaterThan(0);
    for (const a of [...empty, ...mid]) {
      expect(a.reasons.length).toBeGreaterThan(0);
      expect(['airi', 'keera', 'dolia']).not.toContain(a.heroId);
    }
    const bans = suggestBans(realCtx, ['airi'], ['keera'], (id) => !['airi', 'keera'].includes(id));
    expect(bans.length).toBeGreaterThan(0);
    expect(insights.prostats?.games).toBe(1689);
  });

  it('สถิติเจอกันจริง: ชนะ +, แพ้ − และไม่นับคู่ที่ตัวอย่างน้อย/ช่วงเชื่อมั่นคร่อม 50%', () => {
    const withMu: Insights = {
      ...ins,
      matchups: {
        minGames: 25, year: '2026',
        heroes: {
          winner: { beats: [{ id: 'e1', n: 60, win: 70, lb: 57, ub: 80 }], loses: [] },
          loser: { beats: [], loses: [{ id: 'e1', n: 40, win: 30, lb: 18, ub: 45 }] },
        },
      },
    };
    const r = suggestPicks({ data, insights: withMu, name }, [], ['e1'], all);
    const win = r.find((a) => a.heroId === 'winner')!;
    expect(win.reasons.find((x) => x.source === 'h2h')?.weight).toBe(1);
    expect(win.reasons[0].text).toMatch(/70% ใน 60 เกม/);
    expect(r.find((a) => a.heroId === 'loser')).toBeUndefined(); // คะแนนรวมติดลบจึงไม่ถูกแนะนำ
  });

  it('หยิบตอบ: แนะนำตัวที่ลีกอาชีพมักตอบหลังคู่แข่งหยิบ และใช้แนะนำแบนตัวที่คู่แข่งมักตอบเรา', () => {
    const withAp: Insights = {
      ...ins,
      afterPick: {
        minPicks: 15, year: '2026', order: '',
        heroes: {
          e1: { picks: 100, own: [{ id: 'follow', n: 20, rate: 20 }], reply: [{ id: 'answer', n: 30, rate: 30 }] },
          mine: { picks: 100, own: [], reply: [{ id: 'theirAnswer', n: 25, rate: 25 }] },
        },
      },
    };
    const c2 = { data, insights: withAp, name };
    expect(suggestPicks(c2, [], ['e1'], all).map((a) => a.heroId)).toContain('answer');
    expect(suggestBans(c2, ['mine'], [], all).map((a) => a.heroId)).toContain('theirAnswer');
    expect(suggestBans(c2, [], ['e1'], all).map((a) => a.heroId)).toContain('follow');
  });
});

describe('ตรวจตัวเลขสถิติลีกอาชีพใน insights.json', () => {
  it('ทุกคู่ matchups มีตัวอย่างพอ ช่วงเชื่อมั่นไม่คร่อม 50% และตัวเลขสอดคล้องกัน', () => {
    const mu = insights.matchups!;
    let pairs = 0;
    for (const m of Object.values(mu.heroes)) {
      for (const b of m.beats) { pairs++; expect(b.n).toBeGreaterThanOrEqual(mu.minGames); expect(b.lb).toBeGreaterThanOrEqual(50); expect(b.win).toBeGreaterThan(b.lb); }
      for (const l of m.loses) { pairs++; expect(l.n).toBeGreaterThanOrEqual(mu.minGames); expect(l.ub).toBeLessThanOrEqual(50); expect(l.win).toBeLessThan(l.ub); }
    }
    expect(pairs).toBeGreaterThan(50);
  });
  it('หยิบตอบ: อัตราต้องไม่เกิน 100% และมีตัวอย่างขั้นต่ำ', () => {
    const ap = insights.afterPick!;
    for (const h of Object.values(ap.heroes)) {
      expect(h.picks).toBeGreaterThanOrEqual(ap.minPicks);
      for (const r of [...h.own, ...h.reply]) { expect(r.rate).toBeLessThanOrEqual(100); expect(r.n).toBeLessThanOrEqual(h.picks); }
    }
  });
});

