import { LANES, type Dataset, type LaneId } from './types';
import type { EnemySlot } from './engine';

/*
 * บันทึกการเลือกไว้ในเบราว์เซอร์เครื่องนี้ (localStorage) เท่านั้น — ไม่ส่งไปที่ใด
 * ข้อมูลที่โหลดกลับมาต้องผ่านการตรวจทุกครั้ง: ฮีโร่ต้องมีในรายชื่อ เลนต้องถูกต้อง และห้ามซ้ำ
 */

export const STORAGE_KEY = 'rov-counter-draft:selection:v1';

export interface SavedState {
  enemies: EnemySlot[];
  includeUnverified: boolean;
}

export function sanitize(raw: unknown, data: Dataset): SavedState | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { enemies?: unknown; includeUnverified?: unknown };
  if (!Array.isArray(r.enemies) || r.enemies.length !== 5) return null;
  const ids = new Set(data.heroes.map((h) => h.id));
  const seenHero = new Set<string>();
  const seenLane = new Set<LaneId>();
  const enemies: EnemySlot[] = r.enemies.map((e) => {
    const o = (e && typeof e === 'object' ? e : {}) as { heroId?: unknown; lane?: unknown };
    const heroId = typeof o.heroId === 'string' && ids.has(o.heroId) && !seenHero.has(o.heroId) ? o.heroId : null;
    if (heroId) seenHero.add(heroId);
    const laneOk = heroId && typeof o.lane === 'string' && (LANES as readonly string[]).includes(o.lane);
    const lane = laneOk && !seenLane.has(o.lane as LaneId) ? (o.lane as LaneId) : null;
    if (lane) seenLane.add(lane);
    return { heroId, lane };
  });
  return { enemies, includeUnverified: typeof r.includeUnverified === 'boolean' ? r.includeUnverified : true };
}

export function loadState(data: Dataset): SavedState | null {
  try {
    const s = window.localStorage?.getItem(STORAGE_KEY);
    return s ? sanitize(JSON.parse(s), data) : null;
  } catch {
    return null; // โหมดส่วนตัว / ปิด storage / JSON เสีย → เริ่มใหม่
  }
}

export function saveState(state: SavedState): void {
  try {
    const empty = state.enemies.every((e) => !e.heroId) && state.includeUnverified;
    if (empty) window.localStorage?.removeItem(STORAGE_KEY);
    else window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* บันทึกไม่ได้ก็ใช้งานต่อได้ตามปกติ */
  }
}
