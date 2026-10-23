import type { CounterRow, Dataset, Insights, LaneId } from './types';
import { LANE_LABEL } from './types';

/*
 * คำแนะนำแบน/พิคระหว่างดราฟต์ — heuristic เบื้องต้น (ยังไม่ผ่านการทดสอบเชิงสถิติ)
 * ทุกคะแนนแยกเหตุผลและแหล่งที่มาไว้ใน reasons เพื่อให้ผู้ใช้ตรวจได้ น้ำหนักแต่ละข้อตั้งเองตามความสำคัญ:
 *   QZADD (แหล่งหลัก, ระบุเลน)        : +ดาว / −หัวกะโหลก (1–3)
 *   ROV META แพ้ทาง/ชนะทาง           : ±1.5
 *   เข้าคู่กับฮีโร่ทีมตัวเอง (คู่หู/หยิบร่วม) : +1
 *   เลนที่ทีมยังขาด / เลนซ้ำ           : +1 / −1
 *   ความแรงในเมตา (เทียร์ ROV META, สถิติลีกอาชีพ, เทียร์ลิสต์อื่น) : +0.5 ถึง +1.5
 */

export interface Reason {
  text: string;
  source: 'qzadd' | 'rovmeta' | 'prostats' | 'copick' | 'tierlists' | 'team' | 'h2h' | 'reply';
  weight: number;
}

export interface Advice {
  heroId: string;
  score: number;
  reasons: Reason[];
}

interface Ctx {
  data: Dataset;
  insights: Insights;
  name: (id: string) => string;
}

const W = { h2h: 1, reply: 0.5, rovmeta: 1.5, synergy: 1, lane: 1, splus: 1.5, s: 1, presence: 0.5, consensus: 0.5 };

function rowsFor(data: Dataset, enemyId: string, lane: LaneId | null | undefined): CounterRow[] {
  const all = data.rows.filter((r) => r.enemyId === enemyId);
  const inLane = lane ? all.filter((r) => r.lane === lane) : [];
  return inLane.length ? inLane : all;
}

/** เทียร์ลิสต์อื่นจัดฮีโร่ไว้ 2 ระดับบนสุดของสเกลตัวเองกี่แหล่ง */
function topTierVotes(ins: Insights, id: string): string[] {
  return (ins.tierSources ?? []).filter((t) => t.tiers[id] && t.scale.slice(0, 2).includes(t.tiers[id])).map((t) => t.title.split(' —')[0]);
}

function metaReasons(ctx: Ctx, id: string, forBan: boolean): Reason[] {
  const out: Reason[] = [];
  const tier = ctx.insights.rovmeta[id]?.tier;
  if (tier === 'S+') out.push({ text: 'เทียร์ S+ (ROV META)', source: 'rovmeta', weight: W.splus });
  else if (tier === 'S') out.push({ text: 'เทียร์ S (ROV META)', source: 'rovmeta', weight: W.s });
  const ps = ctx.insights.prostats?.heroes[id];
  if (ps) {
    if (forBan && ps.banRate >= 15) out.push({ text: `ถูกแบนบ่อยในลีกอาชีพ ${ps.banRate}%`, source: 'prostats', weight: W.presence });
    if (!forBan && ps.presence >= 25) out.push({ text: `ถูกหยิบ/แบน ${ps.presence}% ของเกมลีกอาชีพ`, source: 'prostats', weight: W.presence });
  }
  const votes = topTierVotes(ctx.insights, id);
  if (votes.length >= 2) out.push({ text: `เทียร์ลิสต์อื่นจัดระดับบน (${votes.join(', ')})`, source: 'tierlists', weight: W.consensus });
  return out;
}

function finalize(map: Map<string, Reason[]>, limit: number): Advice[] {
  return [...map.entries()]
    .map(([heroId, reasons]) => ({ heroId, reasons: reasons.sort((a, b) => b.weight - a.weight), score: reasons.reduce((s, r) => s + r.weight, 0) }))
    .filter((a) => a.score > 0)
    .sort((a, b) => b.score - a.score || a.heroId.localeCompare(b.heroId))
    .slice(0, limit);
}

/**
 * แนะนำพิคให้ "ทีมนี้" (own) เมื่อเจอ opp
 * available(id) = ทีมนี้หยิบฮีโร่นั้นได้ตามกติกาไหม (แบน/ถูกเลือก/Global Ban)
 */
export function suggestPicks(ctx: Ctx, own: string[], opp: string[], available: (id: string) => boolean, limit = 6): Advice[] {
  const { data, insights } = ctx;
  const rm = insights.rovmeta;
  const map = new Map<string, Reason[]>();
  const add = (id: string, r: Reason) => {
    if (!available(id)) return;
    (map.get(id) ?? map.set(id, []).get(id)!).push(r);
  };
  for (const e of opp) {
    for (const row of rowsFor(data, e, rm[e]?.lane)) {
      for (const sl of row.good) for (const h of sl.heroes) {
        if (h.id && h.identity.status !== 'unreadable' && h.identity.status !== 'conflict')
          add(h.id, { text: `แก้ทาง ${ctx.name(e)} ${'★'.repeat(sl.mark.count)} (QZADD เลน ${LANE_LABEL[row.lane]})`, source: 'qzadd', weight: sl.mark.count });
      }
      for (const sl of row.avoid) for (const h of sl.heroes) {
        if (h.id) add(h.id, { text: `ห้ามเลือกเจอ ${ctx.name(e)} ${'☠'.repeat(sl.mark.count)} (QZADD)`, source: 'qzadd', weight: -sl.mark.count });
      }
    }
    for (const c of rm[e]?.weakAgainst ?? []) add(c, { text: `ชนะทาง ${ctx.name(e)} (ROV META)`, source: 'rovmeta', weight: W.rovmeta });
    for (const c of rm[e]?.strongAgainst ?? []) add(c, { text: `แพ้ทาง ${ctx.name(e)} (ROV META)`, source: 'rovmeta', weight: -W.rovmeta });
    // สถิติเจอกันจริงในลีกอาชีพ: นับเฉพาะคู่ที่เจอกัน >= 25 เกมและช่วงเชื่อมั่นไม่คร่อม 50%
    const mu = insights.matchups?.heroes;
    for (const [id, m] of Object.entries(mu ?? {})) {
      const beat = m.beats.find((x) => x.id === e);
      const lose = m.loses.find((x) => x.id === e);
      if (beat) add(id, { text: `ชนะ ${ctx.name(e)} ${beat.win}% ใน ${beat.n} เกมลีกอาชีพ (ขอบล่าง ${beat.lb}%)`, source: 'h2h', weight: W.h2h });
      if (lose) add(id, { text: `แพ้ ${ctx.name(e)} ใน ${lose.n} เกมลีกอาชีพ (ชนะแค่ ${lose.win}%)`, source: 'h2h', weight: -W.h2h });
    }
  }
  // หยิบตอบ: หลังฝั่งตรงข้ามหยิบ X ลีกอาชีพมักตอบด้วย Y (ลำดับหยิบจริงของปี 2026)
  const ap = insights.afterPick?.heroes;
  for (const e of opp) {
    for (const r of ap?.[e]?.reply ?? []) add(r.id, { text: `หลัง ${ctx.name(e)} ลีกอาชีพมักตอบด้วยตัวนี้ ${r.rate}% (${r.n} เกม)`, source: 'reply', weight: W.reply });
  }
  for (const p of own) {
    for (const r of ap?.[p]?.own ?? []) add(r.id, { text: `ทีมที่หยิบ ${ctx.name(p)} มักหยิบตัวนี้ตามมา ${r.rate}% (${r.n} เกม)`, source: 'reply', weight: W.reply });
  }
  // คอมโบกับฮีโร่ที่ทีมนี้หยิบแล้ว
  for (const p of own) {
    for (const s of rm[p]?.bestSynergy ?? []) add(s, { text: `คู่หูของ ${ctx.name(p)} (ROV META)`, source: 'rovmeta', weight: W.synergy });
    for (const cp of insights.copick?.heroes[p]?.partners ?? [])
      add(cp.id, { text: `มักอยู่ทีมเดียวกับ ${ctx.name(p)} ${cp.rate}% (ลีกอาชีพ)`, source: 'copick', weight: W.synergy });
  }
  // เลนที่ทีมนี้ยังขาด (ใช้เลนหลักตาม ROV META) — ใช้เป็นตัวปรับเฉพาะฮีโร่ที่มีเหตุผลอื่นแล้ว หรือเมื่อยังไม่มีข้อมูลคู่แข่ง
  const filled = new Set(own.map((p) => rm[p]?.lane).filter(Boolean));
  const candidates = opp.length || own.length ? [...map.keys()] : Object.keys(rm);
  for (const id of candidates) {
    if (!available(id)) continue;
    const lane = rm[id]?.lane;
    if (lane && own.length) {
      if (filled.has(lane)) add(id, { text: `เลน ${LANE_LABEL[lane]} มีคนแล้ว`, source: 'team', weight: -W.lane });
      else add(id, { text: `เติมเลน ${LANE_LABEL[lane]} ที่ยังว่าง`, source: 'team', weight: W.lane });
    }
    for (const r of metaReasons(ctx, id, false)) add(id, r);
  }
  return finalize(map, limit);
}

/**
 * แนะนำแบนให้ทีมนี้ (own): ตัดตัวที่แก้ทางฮีโร่ของเรา ตัวที่เข้าคอมโบกับคู่แข่ง และตัวเมตาแรง
 * oppAvailable(id) = คู่แข่งยังหยิบฮีโร่นั้นได้ไหม (ไม่มีประโยชน์ที่จะแบนตัวที่คู่แข่งใช้ไม่ได้)
 */
export function suggestBans(ctx: Ctx, own: string[], opp: string[], oppAvailable: (id: string) => boolean, limit = 6): Advice[] {
  const { data, insights } = ctx;
  const rm = insights.rovmeta;
  const map = new Map<string, Reason[]>();
  const add = (id: string, r: Reason) => {
    if (!oppAvailable(id)) return;
    (map.get(id) ?? map.set(id, []).get(id)!).push(r);
  };
  for (const p of own) {
    for (const row of rowsFor(data, p, rm[p]?.lane)) {
      for (const sl of row.good) for (const h of sl.heroes) {
        if (h.id && h.identity.status !== 'unreadable' && h.identity.status !== 'conflict')
          add(h.id, { text: `แก้ทาง ${ctx.name(p)} ของเรา ${'★'.repeat(sl.mark.count)} (QZADD)`, source: 'qzadd', weight: sl.mark.count });
      }
    }
    for (const c of rm[p]?.weakAgainst ?? []) add(c, { text: `ชนะทาง ${ctx.name(p)} ของเรา (ROV META)`, source: 'rovmeta', weight: W.rovmeta });
  }
  const apb = insights.afterPick?.heroes;
  for (const p of own) {
    for (const r of apb?.[p]?.reply ?? []) add(r.id, { text: `คู่แข่งมักตอบด้วยตัวนี้หลังเราหยิบ ${ctx.name(p)} ${r.rate}% (${r.n} เกม)`, source: 'reply', weight: W.reply });
  }
  for (const e of opp) {
    for (const r of apb?.[e]?.own ?? []) add(r.id, { text: `ทีมที่หยิบ ${ctx.name(e)} มักหยิบตัวนี้ตามมา ${r.rate}% (${r.n} เกม)`, source: 'reply', weight: W.reply });
    for (const s of rm[e]?.bestSynergy ?? []) add(s, { text: `คอมโบกับ ${ctx.name(e)} ของคู่แข่ง (ROV META)`, source: 'rovmeta', weight: W.synergy });
    for (const cp of insights.copick?.heroes[e]?.partners ?? [])
      add(cp.id, { text: `มักอยู่ทีมเดียวกับ ${ctx.name(e)} ${cp.rate}% (ลีกอาชีพ)`, source: 'copick', weight: W.synergy });
  }
  for (const id of Object.keys(rm)) for (const r of metaReasons(ctx, id, true)) add(id, r);
  return finalize(map, limit);
}
