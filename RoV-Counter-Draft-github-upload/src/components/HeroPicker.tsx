import { useEffect, useMemo, useRef, useState } from 'react';
import type { Hero, Insights, LaneId } from '../lib/types';
import { LANES, LANE_LABEL } from '../lib/types';
import { Monogram } from './Monogram';
import { TierBadge } from './TierBadge';
import { ROLE_TH, TIER_RANK, roleTh } from '../lib/format';
import { IconClose, IconSearch, LaneIcon } from './icons';

interface Props {
  slotNumber: number;
  heroes: Hero[];
  currentHeroId: string | null;
  takenHeroes: Set<string>;
  onPick: (heroId: string) => void;
  onClose: () => void;
  insights?: Insights;
}

type Filter = 'all' | 'data' | LaneId;

function norm(s: string) {
  return s.toLowerCase().replace(/['’\s-]/g, '');
}

export function HeroPicker({ slotNumber, heroes, currentHeroId, takenHeroes, onPick, onClose, insights }: Props) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [role, setRole] = useState<string>('all');
  const [byTier, setByTier] = useState(false);
  const tierOf = (id: string) => insights?.rovmeta[id]?.tier ?? null;
  const searchRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // โฟกัสช่องค้นหาเฉพาะอุปกรณ์ที่มีเมาส์ (มือถือจะไม่เด้งคีย์บอร์ดเอง)
    const fine = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: fine)').matches;
    if (fine) searchRef.current?.focus({ preventScroll: true });
    else rootRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }, [slotNumber]);

  const sorted = useMemo(
    () =>
      [...heroes].sort(
        (a, b) =>
          (byTier ? (TIER_RANK[tierOf(b.id) ?? ''] ?? 0) - (TIER_RANK[tierOf(a.id) ?? ''] ?? 0) : 0) ||
          a.nameEn.localeCompare(b.nameEn),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [heroes, byTier, insights],
  );
  const list = useMemo(() => {
    const nq = norm(q);
    return sorted.filter((h) => {
      if (role !== 'all' && h.role !== role) return false;
      if (filter === 'data' && h.enemyLanes.length === 0) return false;
      if (filter !== 'all' && filter !== 'data' && !h.enemyLanes.includes(filter)) return false;
      if (!nq) return true;
      return norm(h.nameEn).includes(nq) || (h.nameTh ? norm(h.nameTh).includes(nq) : false) || h.id.includes(nq);
    });
  }, [sorted, q, filter, role]);

  const chips: { key: Filter; label: string; lane?: LaneId }[] = [
    { key: 'all', label: 'ทั้งหมด' },
    { key: 'data', label: 'มีข้อมูลแก้ทาง' },
    ...LANES.map((l) => ({ key: l as Filter, label: LANE_LABEL[l], lane: l })),
  ];

  return (
    <section
      ref={rootRef}
      className="picker"
      aria-label={`เลือกฮีโร่สำหรับศัตรูตัวที่ ${slotNumber}`}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="picker-head">
        <div>
          <p className="eyebrow">กำลังเลือก</p>
          <h3>ศัตรูตัวที่ {slotNumber}</h3>
        </div>
        <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="ปิดรายชื่อฮีโร่">
          <IconClose />
        </button>
      </div>

      <div className="picker-tools">
        <label className="search">
          <IconSearch size={17} />
          <input
            ref={searchRef}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาชื่อฮีโร่ (ไทยหรืออังกฤษ)"
            aria-label="ค้นหาฮีโร่"
          />
        </label>
        <div className="chips" role="group" aria-label="กรองรายชื่อ">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              className={`chip-btn${filter === c.key ? ' is-on' : ''}`}
              aria-pressed={filter === c.key}
              onClick={() => setFilter(c.key)}
            >
              {c.lane && <LaneIcon lane={c.lane} size={13} />}
              {c.label}
            </button>
          ))}
        </div>
        <div className="chips" role="group" aria-label="กรองตามบทบาท">
          {['all', ...Object.keys(ROLE_TH)].map((r) => (
            <button
              key={r}
              type="button"
              className={`chip-btn chip-role${role === r ? ' is-on' : ''}`}
              aria-pressed={role === r}
              onClick={() => setRole(r)}
            >
              {r === 'all' ? 'ทุกบทบาท' : ROLE_TH[r]}
            </button>
          ))}
          {insights && (
            <button
              type="button"
              className={`chip-btn chip-sort${byTier ? ' is-on' : ''}`}
              aria-pressed={byTier}
              onClick={() => setByTier(!byTier)}
            >
              เรียงตามเทียร์
            </button>
          )}
        </div>
      </div>

      <p className="picker-count" aria-live="polite">
        แสดง {list.length} จาก {heroes.length} ตัว
      </p>

      {list.length === 0 ? (
        <div className="state state-empty">
          <p>ไม่พบฮีโร่ที่ตรงกับคำค้นหรือตัวกรอง</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setQ(''); setFilter('all'); setRole('all'); }}>
            ล้างตัวกรอง
          </button>
        </div>
      ) : (
        <ul className="hero-grid">
          {list.map((h) => {
            const taken = takenHeroes.has(h.id) && h.id !== currentHeroId;
            const current = h.id === currentHeroId;
            const noData = h.enemyLanes.length === 0;
            return (
              <li key={h.id}>
                <button
                  type="button"
                  className={['hero-tile', current && 'is-current', taken && 'is-taken', noData && 'no-data'].filter(Boolean).join(' ')}
                  data-testid={`hero-tile-${h.id}`}
                  disabled={taken}
                  aria-pressed={current}
                  aria-label={`${h.nameEn}${h.nameTh ? ` ${h.nameTh}` : ''}${taken ? ' — ถูกเลือกในช่องอื่นแล้ว' : ''}${noData ? ' — ไม่มีข้อมูลแก้ทาง' : ''}`}
                  onClick={() => onPick(h.id)}
                >
                  <Monogram hero={h} size="sm" />
                  <span className="tile-text">
                    <span className="tile-name">{h.nameTh ?? h.nameEn}</span>
                    <span className="tile-en">
                      {h.nameTh ? `${h.nameEn} · ` : ''}
                      {roleTh(h.role)}
                    </span>
                    {taken ? (
                      <span className="tile-flag">เลือกแล้ว</span>
                    ) : noData ? (
                      <span className="tile-flag muted">ไม่มีข้อมูลแก้ทาง</span>
                    ) : null}
                  </span>
                  <span className="tile-tier">
                    <TierBadge tier={tierOf(h.id)} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="picker-foot">เทียร์จาก ROV META แพตช์ 1.64 · ภาพฮีโร่แสดงเฉพาะเมื่อรันในเครื่อง (เว็บที่เผยแพร่ใช้ตัวอักษรย่อ) · กด Esc เพื่อปิด</p>
    </section>
  );
}
