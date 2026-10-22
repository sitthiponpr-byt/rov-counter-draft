/*
 * ระบบแบน/พิคแบบแข่งจริง (BO3 / BO5) — กติกาตามที่เจ้าของโปรเจกต์ยืนยัน 2026-10-22
 * - ลำดับแบบลีกอาชีพ 2 เฟส: แบน 2-2 → พิค ฟ้า1 แดง1-2 ฟ้า2-3 แดง3 → แบน 2-2 → พิค แดง4 ฟ้า4-5 แดง5
 *   (แบนเฟส 2 ฝั่งแดงเริ่มก่อน — เจ้าของโปรเจกต์ยืนยันแล้ว)
 * - แบนทีมละ 4 (ตรงกับข้อมูลดราฟต์ RoV Pro League 2026)
 * - Global Ban Pick: ทีมหนึ่งใช้ฮีโร่ที่ตัวเองเคยใช้ในเกมก่อนหน้าของซีรีส์ซ้ำไม่ได้ (อีกทีมยังใช้ได้)
 * - เกมตัดสิน (เกม 3 ของ BO3 / เกม 5 ของ BO5) = Ultimate Battle ล้าง Global Ban ทั้งหมด
 * - ทีมที่แพ้เลือกฝั่งของเกมถัดไป
 */

export type Side = 'blue' | 'red';
export type TeamId = 'us' | 'them';
export type ActionKind = 'ban' | 'pick';

export interface Step {
  side: Side;
  kind: ActionKind;
  phase: 1 | 2;
  /** ลำดับที่ของการแบน/พิคของฝั่งนั้น (1-based) */
  n: number;
}

export const PHASE2_BAN_FIRST: Side = 'red';
const other = (s: Side): Side => (s === 'blue' ? 'red' : 'blue');

function buildOrder(): Step[] {
  const seq: [Side, ActionKind, 1 | 2][] = [
    ['blue', 'ban', 1], ['red', 'ban', 1], ['blue', 'ban', 1], ['red', 'ban', 1],
    ['blue', 'pick', 1], ['red', 'pick', 1], ['red', 'pick', 1], ['blue', 'pick', 1], ['blue', 'pick', 1], ['red', 'pick', 1],
    [PHASE2_BAN_FIRST, 'ban', 2], [other(PHASE2_BAN_FIRST), 'ban', 2], [PHASE2_BAN_FIRST, 'ban', 2], [other(PHASE2_BAN_FIRST), 'ban', 2],
    ['red', 'pick', 2], ['blue', 'pick', 2], ['blue', 'pick', 2], ['red', 'pick', 2],
  ];
  const count: Record<string, number> = {};
  return seq.map(([side, kind, phase]) => {
    const k = side + kind;
    count[k] = (count[k] ?? 0) + 1;
    return { side, kind, phase, n: count[k] };
  });
}

export const DRAFT_ORDER: Step[] = buildOrder();
export const BANS_PER_TEAM = 4;
export const PICKS_PER_TEAM = 5;

export interface Game {
  number: number;
  /** ทีมที่อยู่ฝั่งฟ้า (ได้แบน/พิคก่อน) */
  blue: TeamId;
  /** heroId ตามลำดับ DRAFT_ORDER; null = ข้ามการแบน */
  actions: (string | null)[];
  winner: TeamId | null;
}

export interface Series {
  format: 3 | 5;
  names: Record<TeamId, string>;
  games: Game[];
}

export const winsNeeded = (s: Series) => Math.ceil(s.format / 2);
export const teamOnSide = (g: Game, side: Side): TeamId => (side === 'blue' ? g.blue : g.blue === 'us' ? 'them' : 'us');
export const sideOf = (g: Game, team: TeamId): Side => (g.blue === team ? 'blue' : 'red');
export const isDecider = (s: Series, g: Game) => g.number === s.format;

export function newSeries(format: 3 | 5, usSideGame1: Side, names?: Partial<Record<TeamId, string>>): Series {
  return {
    format,
    names: { us: names?.us || 'ทีมเรา', them: names?.them || 'ทีมคู่แข่ง' },
    games: [{ number: 1, blue: usSideGame1 === 'blue' ? 'us' : 'them', actions: [], winner: null }],
  };
}

export function currentGame(s: Series): Game {
  return s.games[s.games.length - 1];
}

export function currentStep(g: Game): Step | null {
  return DRAFT_ORDER[g.actions.length] ?? null;
}

export function bansOf(g: Game, team: TeamId): (string | null)[] {
  return DRAFT_ORDER.flatMap((st, i) =>
    i < g.actions.length && st.kind === 'ban' && teamOnSide(g, st.side) === team ? [g.actions[i]] : [],
  );
}

export function picksOf(g: Game, team: TeamId): string[] {
  return DRAFT_ORDER.flatMap((st, i) =>
    i < g.actions.length && st.kind === 'pick' && teamOnSide(g, st.side) === team && g.actions[i] ? [g.actions[i] as string] : [],
  );
}

/** ฮีโร่ที่ทีมนี้ใช้ไม่ได้เพราะ Global Ban (เคยใช้ในเกมก่อนหน้า) — เกมตัดสินล้างทั้งหมด */
export function globalBans(s: Series, gameIndex: number, team: TeamId): Set<string> {
  const g = s.games[gameIndex];
  if (!g || isDecider(s, g)) return new Set();
  return new Set(s.games.slice(0, gameIndex).flatMap((pg) => picksOf(pg, team)));
}

export type Unavailable = 'banned' | 'picked' | 'global-ban';

/** เหตุผลที่ทีมหนึ่งเลือก/แบนฮีโร่นี้ไม่ได้ในเกมปัจจุบัน (null = ใช้ได้) */
export function unavailableReason(s: Series, heroId: string, team: TeamId, kind: ActionKind): Unavailable | null {
  const idx = s.games.length - 1;
  const g = s.games[idx];
  const used = g.actions.map((a, i) => ({ a, st: DRAFT_ORDER[i] }));
  if (used.some((u) => u.a === heroId && u.st.kind === 'ban')) return 'banned';
  if (used.some((u) => u.a === heroId && u.st.kind === 'pick')) return 'picked';
  // แบน: แบนตัวที่คู่แข่งใช้ไม่ได้อยู่แล้วก็ได้ (ไม่ผิดกติกา) จึงตรวจ Global Ban เฉพาะการพิค
  if (kind === 'pick' && globalBans(s, idx, team).has(heroId)) return 'global-ban';
  return null;
}

export function canAct(s: Series, heroId: string | null): boolean {
  const g = currentGame(s);
  const st = currentStep(g);
  if (!st || g.winner) return false;
  if (heroId === null) return st.kind === 'ban';
  return unavailableReason(s, heroId, teamOnSide(g, st.side), st.kind) === null;
}

function withGame(s: Series, g: Game): Series {
  return { ...s, games: [...s.games.slice(0, -1), g] };
}

export function act(s: Series, heroId: string | null): Series {
  if (!canAct(s, heroId)) return s;
  const g = currentGame(s);
  return withGame(s, { ...g, actions: [...g.actions, heroId] });
}

export function undo(s: Series): Series {
  const g = currentGame(s);
  if (g.winner) return withGame(s, { ...g, winner: null });
  if (g.actions.length) return withGame(s, { ...g, actions: g.actions.slice(0, -1) });
  if (s.games.length > 1) return { ...s, games: s.games.slice(0, -1).map((x, i, arr) => (i === arr.length - 1 ? { ...x, winner: null } : x)) };
  return s;
}

export const draftComplete = (g: Game) => g.actions.length >= DRAFT_ORDER.length;

export function score(s: Series): Record<TeamId, number> {
  return {
    us: s.games.filter((g) => g.winner === 'us').length,
    them: s.games.filter((g) => g.winner === 'them').length,
  };
}

export function seriesWinner(s: Series): TeamId | null {
  const sc = score(s);
  const need = winsNeeded(s);
  return sc.us >= need ? 'us' : sc.them >= need ? 'them' : null;
}

export function recordWinner(s: Series, winner: TeamId): Series {
  const g = currentGame(s);
  if (!draftComplete(g) || g.winner) return s;
  return withGame(s, { ...g, winner });
}

/** เริ่มเกมถัดไป: ทีมที่แพ้เกมล่าสุดเป็นผู้เลือกฝั่ง (loserSide = ฝั่งที่ทีมแพ้เลือก) */
export function nextGame(s: Series, loserSide: Side): Series {
  const g = currentGame(s);
  if (!g.winner || seriesWinner(s)) return s;
  const loser: TeamId = g.winner === 'us' ? 'them' : 'us';
  const blue: TeamId = loserSide === 'blue' ? loser : loser === 'us' ? 'them' : 'us';
  return { ...s, games: [...s.games, { number: g.number + 1, blue, actions: [], winner: null }] };
}

/** ตรวจข้อมูลที่โหลดจากเบราว์เซอร์ (ไม่เชื่อข้อมูลที่บันทึกไว้โดยตรง) */
export function sanitizeSeries(raw: unknown, heroIds: Set<string>): Series | null {
  try {
    const r = raw as Series;
    if (!r || (r.format !== 3 && r.format !== 5) || !Array.isArray(r.games) || !r.games.length || r.games.length > r.format) return null;
    let s: Series = newSeries(r.format, r.games[0].blue === 'us' ? 'blue' : 'red', {
      us: typeof r.names?.us === 'string' ? r.names.us.slice(0, 30) : undefined,
      them: typeof r.names?.them === 'string' ? r.names.them.slice(0, 30) : undefined,
    });
    r.games.forEach((rg, gi) => {
      if (gi > 0) {
        const prev = currentGame(s);
        if (!prev.winner) throw new Error('bad');
        const loser: TeamId = prev.winner === 'us' ? 'them' : 'us';
        s = nextGame(s, rg.blue === loser ? 'blue' : 'red');
      }
      for (const a of rg.actions ?? []) {
        if (a !== null && !heroIds.has(a)) throw new Error('bad');
        const before = s;
        s = act(s, a);
        if (s === before) throw new Error('bad');
      }
      if (rg.winner === 'us' || rg.winner === 'them') s = recordWinner(s, rg.winner);
    });
    return s;
  } catch {
    return null;
  }
}
