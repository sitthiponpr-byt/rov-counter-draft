import {
  LANES,
  type CounterRow,
  type Dataset,
  type Hero,
  type IdentityStatus,
  type Insights,
  type LaneId,
  type Mark,
} from './types';

/*
 * ตรรกะแนะนำทีม — heuristic เบื้องต้น ยังไม่ผ่านการทดสอบเชิงสถิติ
 *
 * หลักฐานแก้ทางหลักมาจากเอกสาร QZADD ซึ่งเป็นข้อมูลจากการสัมภาษณ์ ไม่ใช่สถิติ
 * จำนวนดาว: 3 ดาว = แก้ทางได้ดีที่สุด ดาวน้อยลง = แก้ทางได้น้อยลง (เจ้าของโปรเจกต์ระบุ 2026-10-22,
 * ยังไม่ได้ยืนยันกับ QZADD) — หัวกะโหลก 3 อัน = เราห้ามเลือกมากที่สุด (ใช้เรียงรายการห้ามเลือก)
 * แหล่งที่ 2 (ROV META, ไม่ระบุเลน) ใช้เป็นตัวตัดสินเมื่อดาวเท่ากัน: สอดคล้อง > ไม่มีข้อมูล > ขัดแย้ง
 * การเรียงลำดับตัวเลือก: (1) จำนวนดาว (2) ความสอดคล้องกับ ROV META (3) เทียร์ ROV META
 *   (4) ความมั่นใจในการระบุตัวตนฮีโร่ (5) ความหลากหลายบทบาทในทีม (6) ลำดับตัวอักษรของ id เพื่อให้ผลคงที่
 */

export interface EnemySlot {
  heroId: string | null;
  lane: LaneId | null;
}

export interface Options {
  /** รวมฮีโร่ที่ระบุตัวตนจากภาพแล้วแต่ยังไม่ผ่านการยืนยัน (unverified) */
  includeUnverified: boolean;
  /** ข้อมูลแพ้ทาง/ชนะทางจาก ROV META (ถ้ามี) ใช้ตรวจความสอดคล้อง */
  rovmeta?: Insights['rovmeta'];
}

export type Support = 'agree' | 'disagree' | null;
const SUPPORT_RANK: Record<string, number> = { agree: 1, null: 0, disagree: -1 };
const TIER_RANK: Record<string, number> = { 'S+': 5, S: 4, A: 3, B: 2, C: 1 };
const tierRank = (c: Pick<Candidate, 'tier'>) => TIER_RANK[c.tier ?? ''] ?? 0;

/** ROV META สอดคล้องไหมว่า candidate แก้ทาง enemy */
export function rovmetaSupport(rm: Insights['rovmeta'] | undefined, candidateId: string, enemyId: string): Support {
  if (!rm) return null;
  const e = rm[enemyId];
  const c = rm[candidateId];
  const agree = !!(e?.weakAgainst.includes(candidateId) || c?.strongAgainst.includes(enemyId));
  const disagree = !!(e?.strongAgainst.includes(candidateId) || c?.weakAgainst.includes(enemyId));
  if (agree && !disagree) return 'agree';
  if (disagree && !agree) return 'disagree';
  return null;
}

export const IDENTITY_RANK: Record<IdentityStatus, number> = {
  'human-confirmed': 3,
  'system-verified': 2,
  unverified: 1,
  unreadable: 0,
  conflict: 0,
};

export interface Candidate {
  heroId: string;
  identity: IdentityStatus;
  mark: Mark; // ข้อมูลดิบจากเอกสาร
  slotPosition: number;
  /** ความสอดคล้องกับแหล่งที่ 2 (ROV META) */
  support: Support;
  /** เทียร์จาก ROV META (ใช้ตัดสินเมื่อดาวและความสอดคล้องเท่ากัน) */
  tier?: string | null;
}

export interface Excluded {
  heroId: string | null;
  identity: IdentityStatus;
  reason: 'unreadable' | 'conflict' | 'unverified-hidden' | 'enemy-picked';
}

export type LaneStatus = 'no-enemy' | 'no-data' | 'no-usable-candidates' | 'ok';

export interface LaneResult {
  lane: LaneId;
  status: LaneStatus;
  enemyId: string | null;
  enemyCaption: string | null;
  sourcePage: number | null;
  pick: Candidate | null;
  alternates: Candidate[];
  avoid: Candidate[];
  excluded: Excluded[];
  /** ผู้สมัครที่ถูกใช้ในเลนอื่นแล้ว (ป้องกันซ้ำในทีม) */
  usedElsewhere: string[];
}

export interface Balance {
  rolesPresent: string[];
  distinctRoles: number;
  unknownRoleCount: number;
  flags: string[];
}

export interface Recommendation {
  lanes: LaneResult[];
  team: (string | null)[]; // heroId ต่อเลนตามลำดับ LANES
  counterEvidence: {
    lanesWithEvidence: number;
    lanesAssigned: number;
    unverifiedPicks: number;
    /** ผลรวมดาวของตัวที่แนะนำ (ลำดับความแรงตามเอกสาร ไม่ใช่โอกาสชนะ) */
    starSum: number;
    starMax: number;
  };
  balance: Balance;
  errors: string[];
}

export function heroMap(data: Dataset): Map<string, Hero> {
  return new Map(data.heroes.map((h) => [h.id, h]));
}

export function getRow(data: Dataset, lane: LaneId, enemyId: string): CounterRow | undefined {
  return data.rows.find((r) => r.lane === lane && r.enemyId === enemyId);
}

export function lanesWithData(data: Dataset, heroId: string): LaneId[] {
  return LANES.filter((l) => data.rows.some((r) => r.lane === l && r.enemyId === heroId));
}

/** เลนที่แนะนำให้ตั้งอัตโนมัติ: ใช้เมื่อฮีโร่มีข้อมูลเพียงเลนเดียวและเลนนั้นยังว่าง */
export function suggestLane(data: Dataset, heroId: string, takenLanes: LaneId[]): LaneId | null {
  const ls = lanesWithData(data, heroId);
  return ls.length === 1 && !takenLanes.includes(ls[0]) ? ls[0] : null;
}

export function validateEnemies(slots: EnemySlot[]): string[] {
  const errors: string[] = [];
  const heroes = slots.map((s) => s.heroId).filter((x): x is string => !!x);
  if (new Set(heroes).size !== heroes.length) errors.push('เลือกฮีโร่ฝ่ายตรงข้ามซ้ำกัน');
  const lanes = slots.map((s) => s.lane).filter((x): x is LaneId => !!x);
  if (new Set(lanes).size !== lanes.length) errors.push('กำหนดเลนซ้ำกันมากกว่าหนึ่งตัว');
  return errors;
}

function slotsToCandidates(
  slots: CounterRow['good'],
  enemyId: string,
  opts: Options,
  enemyPicked: Set<string>,
  excluded: Excluded[],
  collectExcluded: boolean,
): Candidate[] {
  const out: Candidate[] = [];
  for (const s of slots) {
    for (const h of s.heroes) {
      const st = h.identity.status;
      const skip = (reason: Excluded['reason']) => {
        if (collectExcluded) excluded.push({ heroId: h.id, identity: st, reason });
      };
      if (h.id == null || st === 'unreadable') { skip('unreadable'); continue; }
      if (st === 'conflict') { skip('conflict'); continue; }
      if (st === 'unverified' && !opts.includeUnverified) { skip('unverified-hidden'); continue; }
      if (enemyPicked.has(h.id)) { skip('enemy-picked'); continue; }
      out.push({ heroId: h.id, identity: st, mark: s.mark, slotPosition: s.position, support: rovmetaSupport(opts.rovmeta, h.id, enemyId), tier: opts.rovmeta?.[h.id]?.tier ?? null });
    }
  }
  // ฮีโร่เดียวกันอาจอยู่ในหลายช่อง: เก็บรายการที่ดาวมากที่สุด แล้ว identity ดีที่สุด
  const best = new Map<string, Candidate>();
  for (const c of out) {
    const p = best.get(c.heroId);
    if (!p || compareCandidates(c, p) < 0) best.set(c.heroId, c);
  }
  return [...best.values()].sort(compareCandidates);
}

/** คะแนนแก้ทางของตัวเลือก = จำนวนดาว (เฉพาะฝั่ง "เราควรเลือก"); ฝั่งหัวกะโหลกไม่นับ */
export function stars(c: Pick<Candidate, 'mark'>): number {
  return c.mark.symbol === 'star' ? c.mark.count : 0;
}

/** ระดับ "ห้ามเลือก" = จำนวนหัวกะโหลก (3 = ห้ามเลือกมากที่สุด, เจ้าของโปรเจกต์ระบุ 2026-10-22) */
export function skulls(c: Pick<Candidate, 'mark'>): number {
  return c.mark.symbol === 'skull' ? c.mark.count : 0;
}

/** เรียงรายการห้ามเลือก: หัวกะโหลกมากก่อน แล้วตัวตนที่ยืนยันแล้วก่อน */
export function compareAvoid(a: Candidate, b: Candidate): number {
  return skulls(b) - skulls(a) || IDENTITY_RANK[b.identity] - IDENTITY_RANK[a.identity] || a.heroId.localeCompare(b.heroId);
}

export function compareCandidates(a: Candidate, b: Candidate): number {
  return (
    stars(b) - stars(a) ||
    SUPPORT_RANK[String(b.support)] - SUPPORT_RANK[String(a.support)] ||
    tierRank(b) - tierRank(a) ||
    IDENTITY_RANK[b.identity] - IDENTITY_RANK[a.identity] ||
    a.heroId.localeCompare(b.heroId)
  );
}

export function computeBalance(heroIds: (string | null)[], heroes: Map<string, Hero>): Balance {
  const picked = heroIds.filter((x): x is string => !!x);
  const roles = new Set<string>();
  let unknown = 0;
  for (const id of picked) {
    const r = heroes.get(id)?.role;
    if (r) roles.add(r);
    else unknown++;
  }
  const flags: string[] = [];
  if (picked.length > 0) {
    if (unknown > 0) flags.push(`ไม่ทราบบทบาทของ ${unknown} ตัว จึงประเมินความสมดุลได้ไม่ครบ`);
    if (!roles.has('Tank') && !roles.has('Support')) flags.push('ยังไม่มี Tank หรือ Support ในทีมที่แนะนำ');
    if (!roles.has('Marksman')) flags.push('ยังไม่มี Marksman ในทีมที่แนะนำ');
  }
  return { rolesPresent: [...roles].sort(), distinctRoles: roles.size, unknownRoleCount: unknown, flags };
}

// [เลนที่เติมได้, ผลรวมดาว, ความสอดคล้องแหล่งที่ 2, ผลรวมเทียร์, ผลรวมความมั่นใจตัวตน, จำนวนบทบาท, tie-break]
type TeamKey = [number, number, number, number, number, number, string];
function better(a: TeamKey, b: TeamKey | null): boolean {
  if (!b) return true;
  for (let i = 0; i < 6; i++) if (a[i] !== b[i]) return (a[i] as number) > (b[i] as number);
  return a[6] < b[6];
}

export function recommend(data: Dataset, enemies: EnemySlot[], opts: Options): Recommendation {
  const heroes = heroMap(data);
  const errors = validateEnemies(enemies);
  const enemyPicked = new Set(enemies.map((e) => e.heroId).filter((x): x is string => !!x));
  const enemyByLane = new Map<LaneId, string>();
  for (const e of enemies) if (e.heroId && e.lane && !enemyByLane.has(e.lane)) enemyByLane.set(e.lane, e.heroId);

  const lanes: LaneResult[] = LANES.map((lane) => {
    const enemyId = enemyByLane.get(lane) ?? null;
    const base: LaneResult = {
      lane, status: 'no-enemy', enemyId, enemyCaption: null, sourcePage: null,
      pick: null, alternates: [], avoid: [], excluded: [], usedElsewhere: [],
    };
    if (!enemyId) return base;
    const row = getRow(data, lane, enemyId);
    if (!row) return { ...base, status: 'no-data' };
    const excluded: Excluded[] = [];
    const cands = slotsToCandidates(row.good, enemyId, opts, enemyPicked, excluded, true);
    const avoid = slotsToCandidates(row.avoid, enemyId, { includeUnverified: true }, new Set(), [], false).sort(compareAvoid);
    return {
      ...base, enemyCaption: row.enemyCaption, sourcePage: row.sourcePage, excluded, avoid,
      status: cands.length ? 'ok' : 'no-usable-candidates', alternates: cands,
    };
  });

  // เลือกทีม: ไม่ซ้ำกัน, เติมเลนให้มากที่สุด, ดาวรวมสูงสุด, identity รวมสูงสุด, บทบาทหลากหลายสุด, tie -> id
  const okLanes = lanes.filter((l) => l.status === 'ok');
  let best: { picks: (Candidate | null)[]; key: TeamKey } | null = null;
  const cur: (Candidate | null)[] = [];
  const used = new Set<string>();
  const dfs = (i: number) => {
    if (i === okLanes.length) {
      const filled = cur.filter(Boolean).length;
      const starSum = cur.reduce((s, c) => s + (c ? stars(c) : 0), 0);
      const supSum = cur.reduce((s, c) => s + (c ? SUPPORT_RANK[String(c.support)] : 0), 0);
      const tierSum = cur.reduce((s, c) => s + (c ? tierRank(c) : 0), 0);
      const idSum = cur.reduce((s, c) => s + (c ? IDENTITY_RANK[c.identity] : 0), 0);
      const distinct = computeBalance(cur.map((c) => c?.heroId ?? null), heroes).distinctRoles;
      const key: TeamKey = [filled, starSum, supSum, tierSum, idSum, distinct, cur.map((c) => c?.heroId ?? '~').join('|')];
      if (better(key, best?.key ?? null)) best = { picks: [...cur], key };
      return;
    }
    for (const c of okLanes[i].alternates) {
      if (used.has(c.heroId)) continue;
      used.add(c.heroId);
      cur.push(c);
      dfs(i + 1);
      cur.pop();
      used.delete(c.heroId);
    }
    cur.push(null); // ปล่อยเลนว่างได้ถ้าผู้สมัครทั้งหมดซ้ำกับเลนอื่น
    dfs(i + 1);
    cur.pop();
  };
  if (okLanes.length) dfs(0);

  const chosen = (best as { picks: (Candidate | null)[]; key: TeamKey } | null)?.picks ?? [];
  const pickedBy = new Map<LaneId, Candidate | null>();
  okLanes.forEach((l, i) => pickedBy.set(l.lane, chosen[i] ?? null));
  const pickedIds = new Set([...pickedBy.values()].filter((c): c is Candidate => !!c).map((c) => c.heroId));
  const finalLanes = lanes.map((l) => {
    if (l.status !== 'ok') return l;
    const pick = pickedBy.get(l.lane) ?? null;
    const rest = l.alternates.filter((c) => c.heroId !== pick?.heroId);
    return {
      ...l,
      pick,
      alternates: rest,
      usedElsewhere: rest.filter((c) => pickedIds.has(c.heroId)).map((c) => c.heroId),
    };
  });

  const team = finalLanes.map((l) => l.pick?.heroId ?? null);
  return {
    lanes: finalLanes,
    team,
    counterEvidence: {
      lanesWithEvidence: finalLanes.filter((l) => l.pick).length,
      lanesAssigned: finalLanes.filter((l) => l.enemyId).length,
      unverifiedPicks: finalLanes.filter((l) => l.pick?.identity === 'unverified').length,
      starSum: finalLanes.reduce((s, l) => s + (l.pick ? stars(l.pick) : 0), 0),
      starMax: 3 * finalLanes.filter((l) => l.pick).length,
    },
    balance: computeBalance(team, heroes),
    errors,
  };
}
