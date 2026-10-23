import { useMemo, useState } from 'react';
import type { Hero, Insights } from '../lib/types';
import { ROLE_TH, TIER_ORDER, roleTh } from '../lib/format';
import { Monogram } from './Monogram';
import { HeroDetail } from './HeroDetail';
import { IconSearch } from './icons';

interface Props {
  heroes: Hero[];
  heroById: Map<string, Hero>;
  insights: Insights;
}

// คำอธิบายสั้นที่เขียนเอง (ไม่ได้คัดลอกจาก ROV META)
const TIER_HINT: Record<string, string> = {
  'S+': 'เด่นที่สุดของแพตช์',
  S: 'แข็งแกร่ง ไว้ใจได้',
  A: 'มั่นคง เลือกได้ทั่วไป',
  B: 'เล่นได้ถ้ามีแผน',
  C: 'หลุดเมต้า',
};

export function TierList({ heroes, heroById, insights }: Props) {
  const [role, setRole] = useState<string>('all');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);

  const groups = useMemo(() => {
    const nq = q.trim().toLowerCase();
    const list = heroes.filter(
      (h) =>
        (role === 'all' || h.role === role) &&
        (!nq || h.nameEn.toLowerCase().includes(nq) || (h.nameTh ?? '').includes(q.trim())),
    );
    const g: Record<string, Hero[]> = {};
    for (const h of list) {
      const t = insights.rovmeta[h.id]?.tier ?? '?';
      (g[t] ??= []).push(h);
    }
    for (const k in g) g[k].sort((a, b) => a.nameEn.localeCompare(b.nameEn));
    return g;
  }, [heroes, insights, role, q]);

  const tiers = [...TIER_ORDER, '?'].filter((t) => groups[t]?.length);
  const cls = (t: string) => (t === 'S+' ? 'splus' : t === '?' ? 'none' : t.toLowerCase());

  return (
    <section className="panel-section" aria-labelledby="tier-h">
      <div className="sec-head">
        <div>
          <p className="eyebrow">ข้อมูลอ้างอิง</p>
          <h2 id="tier-h">เทียร์ลิสต์ฮีโร่</h2>
        </div>
        <p className="small muted">
          เทียร์และสถิติจาก ROV META แพตช์ {insights.sources.rovmeta.patch} (เน้นเกมแรงค์) · ดึงเมื่อ {insights.sources.rovmeta.fetchedAt}
        </p>
      </div>
      <div className="tl-tools">
        <div className="chips" role="group" aria-label="กรองตามบทบาท">
          {['all', ...Object.keys(ROLE_TH)].map((r) => (
            <button
              key={r}
              type="button"
              className={`chip-btn${role === r ? ' is-on' : ''}`}
              aria-pressed={role === r}
              onClick={() => setRole(r)}
            >
              {r === 'all' ? 'ทั้งหมด' : ROLE_TH[r]}
            </button>
          ))}
        </div>
        <label className="search">
          <IconSearch size={17} />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาฮีโร่"
            aria-label="ค้นหาฮีโร่ในเทียร์ลิสต์"
          />
        </label>
      </div>

      <div className="tl-rows">
        {tiers.map((t) => (
          <div key={t} className={`tl-row tl-${cls(t)}`}>
            <div className="tl-tier">
              <span>{t === '?' ? '—' : t}</span>
              <small>{TIER_HINT[t] ?? 'ไม่มีข้อมูล'}</small>
            </div>
            <ul className="tl-heroes">
              {groups[t].map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    className={`tl-hero${sel === h.id ? ' is-on' : ''}`}
                    aria-pressed={sel === h.id}
                    onClick={() => setSel(sel === h.id ? null : h.id)}
                    data-testid={`tier-hero-${h.id}`}
                  >
                    <Monogram hero={h} size="sm" />
                    <span className="tl-text">
                      <span className="tl-name">{h.nameTh ?? h.nameEn}</span>
                      <span className={`tl-role role-text-${(h.role ?? 'unknown').toLowerCase()}`}>{roleTh(h.role)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {sel && groups[t].some((h) => h.id === sel) && (
              <div className="tl-detail">
                <HeroDetail heroId={sel} heroes={heroById} insights={insights} onPickHero={setSel} />
              </div>
            )}
          </div>
        ))}
        {tiers.length === 0 && <p className="state state-empty">ไม่พบฮีโร่ที่ตรงกับตัวกรอง</p>}
      </div>
    </section>
  );
}
