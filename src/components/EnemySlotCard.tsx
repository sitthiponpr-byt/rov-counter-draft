import { useState } from 'react';
import type { Hero, LaneId } from '../lib/types';
import { LANES, LANE_LABEL } from '../lib/types';
import type { EnemySlot } from '../lib/engine';
import { Monogram } from './Monogram';
import { IconClose, IconPlus, IconSwap, LaneIcon } from './icons';

// ป้ายสั้นบนปุ่มเลน (ชื่อเต็มอยู่ใน aria-label และหัวการ์ด)
const LANE_SHORT: Record<LaneId, string> = {
  'dark-slayer': 'Slayer',
  jungle: 'Jungle',
  midlane: 'Mid',
  'abyssal-dragon': 'Abyssal',
  roaming: 'Roam',
};

interface Props {
  index: number;
  slot: EnemySlot;
  hero: Hero | undefined;
  active: boolean;
  takenLanes: Set<LaneId>;
  onActivate: () => void;
  onRemove: () => void;
  onLane: (lane: LaneId) => void;
}

export function EnemySlotCard({ index, slot, hero, active, takenLanes, onActivate, onRemove, onLane }: Props) {
  const n = index + 1;
  const [editLane, setEditLane] = useState(false);
  const needsLane = !!hero && !slot.lane;
  const cls = ['slot-card', active && 'is-active', hero && 'is-filled', needsLane && 'needs-lane'].filter(Boolean).join(' ');

  return (
    <div className={cls} data-testid={`enemy-slot-${n}`}>
      <div className="slot-head">
        <span className="slot-no" aria-hidden="true">{String(n).padStart(2, '0')}</span>
        <span className="slot-lane">
          {slot.lane ? (
            <>
              <LaneIcon lane={slot.lane} size={14} /> {LANE_LABEL[slot.lane]}
            </>
          ) : hero ? (
            <span className="txt-warn">ยังไม่กำหนดเลน</span>
          ) : (
            'ตำแหน่ง: —'
          )}
        </span>
      </div>

      <div className="slot-row">
      <button
        type="button"
        className="slot-main"
        onClick={onActivate}
        aria-pressed={active}
        aria-label={hero ? `ศัตรูตัวที่ ${n}: ${hero.nameEn} — เปลี่ยนฮีโร่` : `ศัตรูตัวที่ ${n}: เลือกฮีโร่`}
      >
        {hero ? (
          <>
            <Monogram hero={hero} size="md" />
            <span className="slot-hero">
              <span className="slot-hero-name">{hero.nameTh ?? hero.nameEn}</span>
              {hero.nameTh && <span className="slot-hero-en">{hero.nameEn}</span>}
            </span>
            <span className="slot-change" aria-hidden="true">
              <IconSwap size={14} /> เปลี่ยน
            </span>
          </>
        ) : (
          <span className="slot-empty">
            <span className="slot-empty-icon"><IconPlus size={20} /></span>
            <span>
              <strong>เลือกฮีโร่</strong>
              <small>แตะเพื่อเปิดรายชื่อ</small>
            </span>
          </span>
        )}
      </button>
      {hero && (
        <button
          type="button"
          className="btn btn-ghost btn-icon btn-danger-text slot-remove"
          onClick={onRemove}
          aria-label={`ศัตรูตัวที่ ${n}: นำฮีโร่ออก`}
          title="นำออก"
        >
          <IconClose size={18} />
        </button>
      )}
      </div>

      {hero && slot.lane && !editLane && (
        <div className="slot-note">
          {hero.enemyLanes.length === 0 ? (
            <span className="txt-warn">เอกสารไม่มีข้อมูลแก้ทางของฮีโร่นี้</span>
          ) : hero.enemyLanes.includes(slot.lane) ? (
            <span>
              <span className="dot" aria-hidden="true" /> มีข้อมูลในเลนนี้
            </span>
          ) : (
            <span className="txt-warn">ไม่มีข้อมูลในเลนนี้</span>
          )}
          <button
            type="button"
            className="link-btn"
            onClick={() => setEditLane(true)}
            aria-expanded={false}
            aria-label={`ศัตรูตัวที่ ${n}: เปลี่ยนเลน`}
          >
            เปลี่ยนเลน
          </button>
        </div>
      )}

      {hero && (!slot.lane || editLane) && (
        <>
          <div role="radiogroup" aria-label={`ศัตรูตัวที่ ${n}: เลนที่เล่น`} className="lane-pick">
            {LANES.map((l) => {
              const has = hero.enemyLanes.includes(l);
              const taken = takenLanes.has(l) && slot.lane !== l;
              const checked = slot.lane === l;
              return (
                <label
                  key={l}
                  className={['lane-opt', checked && 'is-on', taken && 'is-disabled', has && 'has-data'].filter(Boolean).join(' ')}
                >
                  <input
                    type="radio"
                    name={`enemy-lane-${index}`}
                    checked={checked}
                    disabled={taken}
                    onChange={() => {
                      onLane(l);
                      setEditLane(false);
                    }}
                    aria-label={`ศัตรูตัวที่ ${n} เลน ${LANE_LABEL[l]}${has ? ' (มีข้อมูล)' : ''}`}
                  />
                  <LaneIcon lane={l} size={15} />
                  <span className="lane-short" aria-hidden="true">{LANE_SHORT[l]}</span>
                  {has && <span className="dot" aria-hidden="true" />}
                </label>
              );
            })}
          </div>
          <p className="slot-note">
            {hero.enemyLanes.length > 0 ? (
              <>
                <span className="dot" aria-hidden="true" /> มีข้อมูลในเลนนี้
              </>
            ) : (
              <span className="txt-warn">เอกสารไม่มีข้อมูลแก้ทางของฮีโร่นี้</span>
            )}
            {slot.lane && editLane && (
              <button type="button" className="link-btn" onClick={() => setEditLane(false)}>
                ใช้เลนเดิม
              </button>
            )}
          </p>
        </>
      )}
    </div>
  );
}
