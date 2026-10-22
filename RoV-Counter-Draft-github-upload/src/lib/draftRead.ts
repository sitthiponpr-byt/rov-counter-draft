import type { CopickPartner, Insights } from './types';

/*
 * อ่านดราฟต์ศัตรู: ฮีโร่ที่มักอยู่ทีมเดียวกับตัวที่ศัตรูเลือกแล้ว (คอมโบ)
 * แหล่ง: (1) สถิติหยิบร่วมทีมในลีกอาชีพ (คำนวณเองจากข้อมูลดราฟต์) (2) "Best Synergy" ของ ROV META
 * ข้อมูลดราฟต์ไม่มีลำดับการหยิบ จึงบอกได้ว่า "มักอยู่ทีมเดียวกัน" ไม่ใช่ความน่าจะเป็นที่จะหยิบต่อจริง
 */

export interface Mention {
  enemyId: string;
  source: 'copick' | 'rovmeta';
  rate?: number;
  together?: number;
}

export interface LikelyPick {
  heroId: string;
  mentions: Mention[];
  maxRate: number;
}

export interface EnemyRead {
  perEnemy: { enemyId: string; picks: number | null; partners: CopickPartner[]; synergy: string[] }[];
  likely: LikelyPick[];
}

export function readEnemyDraft(ins: Insights, enemyIds: string[], limit = 6): EnemyRead {
  const picked = new Set(enemyIds);
  const perEnemy = enemyIds.map((id) => {
    const cp = ins.copick?.heroes[id];
    return {
      enemyId: id,
      picks: cp?.picks ?? null,
      partners: (cp?.partners ?? []).filter((p) => !picked.has(p.id)).slice(0, 4),
      synergy: (ins.rovmeta[id]?.bestSynergy ?? []).filter((h) => !picked.has(h)),
    };
  });
  const agg = new Map<string, LikelyPick>();
  const add = (heroId: string, m: Mention) => {
    const cur = agg.get(heroId) ?? { heroId, mentions: [], maxRate: 0 };
    cur.mentions.push(m);
    cur.maxRate = Math.max(cur.maxRate, m.rate ?? 0);
    agg.set(heroId, cur);
  };
  for (const e of perEnemy) {
    for (const p of e.partners) add(p.id, { enemyId: e.enemyId, source: 'copick', rate: p.rate, together: p.together });
    for (const s of e.synergy) add(s, { enemyId: e.enemyId, source: 'rovmeta' });
  }
  const likely = [...agg.values()]
    .sort((a, b) => b.mentions.length - a.mentions.length || b.maxRate - a.maxRate || a.heroId.localeCompare(b.heroId))
    .slice(0, limit);
  return { perEnemy, likely };
}
