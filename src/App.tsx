import { useEffect, useMemo, useState } from 'react';
import { dataset, insights, meta } from './lib/data';
import { loadState, saveState } from './lib/storage';
import { useMedia } from './lib/useMedia';
import { LANES, LANE_LABEL, type LaneId } from './lib/types';
import { heroMap, recommend, suggestLane, type EnemySlot } from './lib/engine';
import { heroName } from './lib/format';
import { EnemySlotCard } from './components/EnemySlotCard';
import { HeroPicker } from './components/HeroPicker';
import { LaneCard, TrustBadge } from './components/LaneCard';
import { Monogram } from './components/Monogram';
import { EnemyRead } from './components/EnemyRead';
import { TierList } from './components/TierList';
import { DraftSim } from './components/DraftSim';
import { TierBadge } from './components/TierBadge';
import { TIER_RANK } from './lib/format';
import { IconAlert, IconCheck, IconChevron, IconInfo, IconReset, IconShield, LaneIcon, LogoMark } from './components/icons';

const EMPTY: EnemySlot[] = Array.from({ length: 5 }, () => ({ heroId: null, lane: null }));
const ROLES = ['Tank', 'Warrior', 'Assassin', 'Mage', 'Marksman', 'Support'];
const avgTier = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
// แปลงค่าเฉลี่ยกลับเป็นป้ายเทียร์ใกล้ที่สุด (S+=5 … C=1)
const tierLabel = (v: number) => ['C', 'C', 'B', 'A', 'S', 'S+'][Math.round(v)] ?? '—';

export default function App() {
  // กู้คืนการเลือกจากครั้งก่อน (ตรวจความถูกต้องแล้วใน loadState)
  const [restored] = useState(() => loadState(dataset));
  const [view, setView] = useState<'draft' | 'banpick' | 'tiers'>('draft');
  const [enemies, setEnemies] = useState<EnemySlot[]>(() => restored?.enemies ?? EMPTY);
  const [includeUnverified, setIncludeUnverified] = useState(() => restored?.includeUnverified ?? true);
  const [active, setActive] = useState<number | null>(() => {
    if (!restored) return 0;
    const k = restored.enemies.findIndex((e) => !e.heroId);
    return k === -1 ? null : k;
  });
  const [confirmClear, setConfirmClear] = useState(false);
  const [msg, setMsg] = useState(() =>
    restored && restored.enemies.some((e) => e.heroId) ? 'กู้คืนการเลือกจากครั้งก่อนแล้ว (บันทึกไว้ในเบราว์เซอร์เครื่องนี้)' : '',
  );

  useEffect(() => {
    saveState({ enemies, includeUnverified });
  }, [enemies, includeUnverified]);

  const wide = useMedia('(min-width: 700px)');
  const heroById = useMemo(() => heroMap(dataset), []);
  const rec = useMemo(() => recommend(dataset, enemies, { includeUnverified, rovmeta: insights.rovmeta }), [enemies, includeUnverified]);

  const takenHeroes = new Set(enemies.map((e) => e.heroId).filter((x): x is string => !!x));
  const takenLanesFor = (except: number) =>
    new Set(enemies.filter((_, i) => i !== except).map((e) => e.lane).filter((x): x is LaneId => !!x));
  const nameOf = (id: string) => heroName(heroById.get(id), id);

  const pickHero = (i: number, heroId: string) => {
    if (enemies.some((s, k) => k !== i && s.heroId === heroId)) return; // ห้ามเลือกซ้ำ
    const taken = enemies.filter((_, k) => k !== i).map((s) => s.lane).filter((x): x is LaneId => !!x);
    // เลน: (1) เอกสาร QZADD มีข้อมูลเลนเดียว (2) เลนหลักตาม ROV META ถ้าเลนนั้นว่าง และ QZADD ไม่มีข้อมูลหรือมีข้อมูลในเลนนั้น
    const rmLane = insights.rovmeta[heroId]?.lane ?? null;
    const qLanes = heroById.get(heroId)?.enemyLanes ?? [];
    const lane =
      suggestLane(dataset, heroId, taken) ??
      (rmLane && !taken.includes(rmLane) && (qLanes.length === 0 || qLanes.includes(rmLane)) ? rmLane : null);
    const laneFromRm = !!lane && lane === rmLane && !suggestLane(dataset, heroId, taken);
    const next = enemies.map((s, k) => (k === i ? { heroId, lane } : { ...s }));
    setEnemies(next);
    setMsg(
      `ศัตรูตัวที่ ${i + 1}: ${nameOf(heroId)}` +
        (lane
          ? ` · ตั้งเลน ${LANE_LABEL[lane]} ให้อัตโนมัติ${laneFromRm ? ' (เลนหลักตาม ROV META)' : ''}`
          : ' · กรุณาเลือกเลนในช่องนี้'),
    );
    const order = [...Array(5).keys()].map((k) => (i + 1 + k) % 5);
    const nextEmpty = order.find((k) => !next[k].heroId);
    setActive(nextEmpty ?? null);
    setConfirmClear(false);
  };

  const removeHero = (i: number) => {
    const old = enemies[i].heroId;
    setEnemies(enemies.map((s, k) => (k === i ? { heroId: null, lane: null } : { ...s })));
    if (old) setMsg(`นำ ${nameOf(old)} ออกจากช่องที่ ${i + 1} แล้ว`);
    setActive(i);
  };

  const setLane = (i: number, lane: LaneId) => {
    if (enemies.some((s, k) => k !== i && s.lane === lane)) return;
    setEnemies(enemies.map((s, k) => (k === i ? { ...s, lane } : { ...s })));
    setMsg(`ศัตรูตัวที่ ${i + 1}: เลน ${LANE_LABEL[lane]}`);
  };

  const clearAll = () => {
    setEnemies(EMPTY.map((s) => ({ ...s })));
    setActive(0);
    setConfirmClear(false);
    setMsg('ล้างการเลือกทั้งหมดแล้ว เริ่มจัดทีมใหม่ได้เลย');
  };

  const selected = enemies.filter((e) => e.heroId).length;
  const tierOf = (id: string) => TIER_RANK[insights.rovmeta[id]?.tier ?? ''] ?? 0;
  const teamTiers = rec.lanes.flatMap((l) => (l.pick && tierOf(l.pick.heroId) ? [tierOf(l.pick.heroId)] : []));
  const enemyTiers = enemies.flatMap((e) => (e.heroId && tierOf(e.heroId) ? [tierOf(e.heroId)] : []));
  const ready = enemies.filter((e) => e.heroId && e.lane).length;
  const picks = rec.lanes.filter((l) => l.pick);
  const insufficient = rec.lanes.filter((l) => l.enemyId && l.status !== 'ok');
  const missingLanes = LANES.filter((l) => !rec.lanes.find((x) => x.lane === l)?.enemyId);
  const cells = meta.counts.identityCells;
  const confirmedCells = (cells['human-confirmed'] ?? 0) + (cells['system-verified'] ?? 0);
  const totalCells = Object.values(cells).reduce((s, v) => s + v, 0);
  const c = meta.sources.counters;
  const step = ready === 0 ? (selected === 0 ? 1 : 2) : 3;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <LogoMark />
          <div>
            <h1>RoV Counter Draft</h1>
            <p className="tagline">วิเคราะห์ดราฟต์ วางแผนทีม ตอบโต้คู่แข่ง</p>
          </div>
        </div>
        <div className="status-pills">
          <span className="pill pill-draft">ร่าง {meta.dataVersion.replace('-draft', '')}</span>
          <span className="pill pill-patch">แพตช์ {insights.sources.rovmeta.patch} · ข้อมูล {insights.sources.rovmeta.fetchedAt}</span>
          <span className="pill" title="จำนวนช่องที่ระบบหรือมนุษย์ยืนยันตัวตนฮีโร่แล้ว">
            <IconShield size={14} /> ยืนยันแล้ว {confirmedCells}/{totalCells} ช่อง
          </span>
        </div>
      </header>

      <aside className="notice" role="note" aria-label="ข้อควรทราบเกี่ยวกับข้อมูล">
        <IconInfo size={18} />
        <div>
          <p>
            <b>ข้อมูลทดลอง</b> ตัวเลือกแก้ทางมาจากเอกสาร “{c.title}” ({c.credit}) ซึ่งอ้างอิงการสัมภาษณ์ผู้เล่น{' '}
            <b>ไม่ใช่สถิติการแข่งขัน</b> · จัดอันดับด้วย <b>จำนวนดาว (3 ดาว = แก้ทางได้ดีที่สุด)</b> แล้วเทียบกับ ROV META เป็นแหล่งที่ 2 · <b>หัวกะโหลก 3 อัน = ห้ามเลือกมากที่สุด</b>
          </p>
          <details>
            <summary>อ่านข้อจำกัดเพิ่มเติม</summary>
            <ul>
              <li>ไม่ทราบว่าเอกสารตรงกับแพตช์ใด และยังไม่ได้ยืนยันสิทธิ์เผยแพร่ซ้ำ</li>
              <li>ชื่อฮีโร่ในช่องคำแนะนำอ่านจากภาพ ส่วนใหญ่ยังไม่ผ่านการยืนยันโดยมนุษย์ ดูป้ายสถานะข้างชื่อทุกครั้ง</li>
              <li>ไม่มี win rate, pick rate, tier หรือคะแนนเมตา</li>
              <li>เว็บนี้ไม่ใช่เว็บทางการของ Garena ชื่อและงานศิลป์ที่เกี่ยวข้องเป็นของเจ้าของ</li>
            </ul>
          </details>
        </div>
      </aside>

      <nav className="view-tabs" aria-label="มุมมอง">
        <button type="button" className={view === 'draft' ? 'is-on' : ''} aria-current={view === 'draft' ? 'page' : undefined} onClick={() => setView('draft')}>
          ดราฟต์แก้ทาง
        </button>
        <button type="button" className={view === 'banpick' ? 'is-on' : ''} aria-current={view === 'banpick' ? 'page' : undefined} onClick={() => setView('banpick')}>
          แบน/พิค BO3·BO5
        </button>
        <button type="button" className={view === 'tiers' ? 'is-on' : ''} aria-current={view === 'tiers' ? 'page' : undefined} onClick={() => setView('tiers')}>
          เทียร์ลิสต์ฮีโร่
        </button>
      </nav>

      {view === 'tiers' && <TierList heroes={dataset.heroes} heroById={heroById} insights={insights} />}
      {view === 'banpick' && <DraftSim data={dataset} heroById={heroById} insights={insights} />}

      {view === 'draft' && (
      <>
      <ol className="steps" aria-label="ขั้นตอนการใช้งาน">
        {['เลือกศัตรู 5 ตัว', 'กำหนดเลน', 'ดูทีมแนะนำ'].map((t, k) => (
          <li key={t} className={step > k + 1 ? 'is-done' : step === k + 1 ? 'is-current' : ''} aria-current={step === k + 1 ? 'step' : undefined}>
            <span className="step-no">{step > k + 1 ? <IconCheck size={14} /> : k + 1}</span>
            {t}
          </li>
        ))}
      </ol>

      <section className="panel-section" aria-labelledby="enemy-h">
        <div className="sec-head">
          <div>
            <p className="eyebrow">ขั้นที่ 1–2</p>
            <h2 id="enemy-h">ทีมศัตรู</h2>
          </div>
          <div className="sec-tools">
            <div className="progress" aria-live="polite">
              <span className="count">
                เลือกแล้ว {selected}/5 · กำหนดเลนแล้ว {ready}/5
              </span>
              <span className="bar" aria-hidden="true">
                <span style={{ width: `${(ready / 5) * 100}%` }} />
              </span>
            </div>
            {confirmClear ? (
              <div className="confirm" role="group" aria-label="ยืนยันการล้าง">
                <span>ล้างศัตรูทั้งหมด?</span>
                <button type="button" className="btn btn-danger btn-sm" onClick={clearAll}>
                  ยืนยันล้าง
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmClear(false)}>
                  ยกเลิก
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setConfirmClear(true)}
                disabled={selected === 0}
              >
                <IconReset size={15} /> ล้างทั้งหมด
              </button>
            )}
          </div>
        </div>

        <p className="live" role="status" aria-live="polite">
          {msg || 'เลือกช่องศัตรู แล้วเลือกฮีโร่จากรายชื่อ ระบบจะเลื่อนไปช่องถัดไปให้อัตโนมัติ'}
        </p>

        <div className="slot-grid">
          {enemies.map((slot, i) => (
            <EnemySlotCard
              key={i}
              index={i}
              slot={slot}
              hero={slot.heroId ? heroById.get(slot.heroId) : undefined}
              active={active === i}
              takenLanes={takenLanesFor(i)}
              onActivate={() => setActive(active === i ? null : i)}
              onRemove={() => removeHero(i)}
              onLane={(l) => setLane(i, l)}
            />
          ))}
        </div>

        {active !== null && (
          <HeroPicker
            key={active}
            slotNumber={active + 1}
            heroes={dataset.heroes}
            currentHeroId={enemies[active].heroId}
            takenHeroes={takenHeroes}
            insights={insights}
            onPick={(id) => pickHero(active, id)}
            onClose={() => {
              const n = active + 1;
              setActive(null);
              // คืนโฟกัสให้ช่องศัตรูที่เปิดอยู่ (ผู้ใช้คีย์บอร์ดไม่หลงตำแหน่ง)
              requestAnimationFrame(() =>
                document.querySelector<HTMLButtonElement>(`[data-testid="enemy-slot-${n}"] .slot-main`)?.focus(),
              );
            }}
          />
        )}

        {ready > 0 && (
          <a className="jump" href="#team-h">
            ดูทีมแนะนำ ({rec.counterEvidence.lanesWithEvidence}/{ready} เลนมีตัวเลือก) <IconChevron size={16} />
          </a>
        )}

        {selected > 0 && (
          <EnemyRead
            enemyIds={enemies.map((e) => e.heroId).filter((x): x is string => !!x)}
            heroes={heroById}
            insights={insights}
            open={wide}
          />
        )}

        {rec.errors.length > 0 && (
          <p className="error" role="alert">
            <IconAlert size={16} /> {rec.errors.join(' · ')}
          </p>
        )}
      </section>

      <section className="panel-section" aria-labelledby="team-h">
        <div className="sec-head">
          <div>
            <p className="eyebrow">ขั้นที่ 3</p>
            <h2 id="team-h">ทีมแนะนำ</h2>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={includeUnverified}
              onChange={(e) => setIncludeUnverified(e.target.checked)}
              aria-label="รวมตัวเลือกที่ตัวตนฮีโร่ยังไม่ยืนยัน (unverified)"
            />
            <span className="switch-track" aria-hidden="true" />
            <span>รวมข้อมูลที่ยังไม่ยืนยัน</span>
          </label>
        </div>

        <ul className="legend" aria-label="ความหมายของป้ายสถานะ">
          <li><span className="trust trust-human-confirmed"><span className="trust-dot" />มนุษย์ยืนยัน</span> ตรวจโดยคนแล้ว</li>
          <li><span className="trust trust-system-verified"><span className="trust-dot" />ระบบยืนยัน</span> จับคู่ภาพผ่านเกณฑ์ ยังไม่ผ่านคน</li>
          <li><span className="trust trust-unverified"><span className="trust-dot" />ยังไม่ยืนยัน</span> ข้อมูลทดลอง</li>
        </ul>

        {ready === 0 ? (
          <div className="state state-empty big" data-testid="empty-state">
            <IconShield size={28} />
            <div>
              <p className="state-title">ยังไม่มีข้อมูลให้วิเคราะห์</p>
              <p>เลือกฮีโร่ศัตรูและกำหนดเลนอย่างน้อย 1 ตัว ระบบจะไม่สร้างคำแนะนำเมื่อไม่มีหลักฐานรองรับ</p>
            </div>
          </div>
        ) : (
          <>
            <ol className="team-strip" aria-label="สรุปทีมแนะนำ">
              {rec.lanes.map((l) => {
                const h = l.pick ? heroById.get(l.pick.heroId) : undefined;
                return (
                  <li key={l.lane} className={l.pick ? 'is-pick' : l.enemyId ? 'is-warn' : ''}>
                    <span className="ts-lane">
                      <LaneIcon lane={l.lane} size={13} /> {LANE_LABEL[l.lane]}
                    </span>
                    <span className="ts-body">
                      <Monogram hero={h} size="sm" />
                      <span className="ts-name">
                        {h ? h.nameTh ?? h.nameEn : l.enemyId ? (l.status === 'ok' ? 'เว้นไว้' : 'ข้อมูลไม่พอ') : 'ยังไม่กำหนด'}
                      </span>
                    </span>
                    {l.pick && <TrustBadge c={l.pick} />}
                  </li>
                );
              })}
            </ol>

            <ol className="lineup" aria-label="ทีมแนะนำตามเลน">
              {rec.lanes.map((l) => (
                <li key={l.lane}>
                  <LaneCard result={l} heroes={heroById} rovmeta={insights.rovmeta} insights={insights} />
                </li>
              ))}
            </ol>

            <div className="analysis">
              <div className="a-card" data-testid="score-counter">
                <p className="a-label">หลักฐานการแก้ทาง</p>
                <p className="a-big">
                  {rec.counterEvidence.starSum}
                  <span>/{rec.counterEvidence.starMax} ดาว</span>
                </p>
                <p className="a-sub">
                  ผลรวมระดับดาวของตัวที่แนะนำ · มีตัวเลือก {rec.counterEvidence.lanesWithEvidence}/{rec.counterEvidence.lanesAssigned} เลน — เป็นระดับจากเอกสาร ไม่ใช่โอกาสชนะ
                </p>
                <ul className="lane-status">
                  {rec.lanes.map((l) => (
                    <li key={l.lane} className={l.pick ? 'ok' : l.enemyId ? 'warn' : 'idle'}>
                      <LaneIcon lane={l.lane} size={14} />
                      <span>{LANE_LABEL[l.lane]}</span>
                      <b>
                        {l.pick
                          ? l.pick.identity === 'unverified'
                            ? 'มีตัวเลือก (ทดลอง)'
                            : 'มีตัวเลือก'
                          : l.enemyId
                            ? 'ข้อมูลไม่พอ'
                            : 'ยังไม่กำหนด'}
                      </b>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="a-card" data-testid="score-balance">
                <p className="a-label">ความสมดุลของทีม <span className="tag-heur">heuristic เบื้องต้น</span></p>
                <p className="a-big">
                  {rec.balance.distinctRoles}
                  <span>/{ROLES.length} บทบาท</span>
                </p>
                <ul className="role-cover">
                  {ROLES.map((r) => (
                    <li key={r} className={rec.balance.rolesPresent.includes(r) ? 'on' : ''}>
                      {rec.balance.rolesPresent.includes(r) ? <IconCheck size={13} /> : <span className="dash" />}
                      {r}
                    </li>
                  ))}
                </ul>
                {rec.balance.flags.map((f) => (
                  <p key={f} className="a-warn"><IconAlert size={14} /> {f}</p>
                ))}
                <p className="a-sub">กติกาที่ตั้งขึ้นเอง ยังไม่ผ่านการทดสอบ ใช้ประกอบการพิจารณาเท่านั้น</p>
              </div>

              <div className="a-card" data-testid="score-meta">
                <p className="a-label">เมตา (เทียร์ ROV META)</p>
                {teamTiers.length ? (
                  <>
                    <p className="a-big">
                      {tierLabel(avgTier(teamTiers))}
                      <span> เฉลี่ยทีมเรา</span>
                    </p>
                    <ul className="tier-row">
                      {rec.lanes.map((l) =>
                        l.pick ? (
                          <li key={l.lane}>
                            <TierBadge tier={insights.rovmeta[l.pick.heroId]?.tier} /> {heroById.get(l.pick.heroId)?.nameTh ?? l.pick.heroId}
                          </li>
                        ) : null,
                      )}
                    </ul>
                    {enemyTiers.length > 0 && (
                      <p className="a-sub">ทีมศัตรูเฉลี่ย {tierLabel(avgTier(enemyTiers))} ({enemyTiers.length} ตัว)</p>
                    )}
                  </>
                ) : (
                  <p className="a-big small">ไม่มีข้อมูล</p>
                )}
                <p className="a-sub">เทียร์ตาม ROV META แพตช์ {insights.sources.rovmeta.patch} (เน้นเกมแรงค์) ใช้ตัดสินเมื่อดาวเท่ากัน · ไม่ใช่โอกาสชนะ</p>
              </div>
            </div>

            <details className="sl-wrap" open={wide}>
              <summary>
                จุดแข็งและข้อจำกัดของคำแนะนำ
                {insufficient.length > 0 && <span className="sl-count">ข้อมูลไม่พอ {insufficient.length} เลน</span>}
              </summary>
            <div className="sl-grid">
              <div className="a-card" data-testid="strengths">
                <p className="a-label">จุดแข็งที่เอกสารรองรับ</p>
                {picks.length === 0 ? (
                  <p className="a-sub">ยังไม่มีเลนที่มีตัวเลือก</p>
                ) : (
                  <ul className="bullets">
                    {picks.map((l) => (
                      <li key={l.lane}>
                        {LANE_LABEL[l.lane]}: มีตัวเลือกเมื่อเจอ {nameOf(l.enemyId!)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="a-card" data-testid="limits">
                <p className="a-label">ข้อจำกัดของคำแนะนำ</p>
                <ul className="bullets">
                  {insufficient.map((l) => (
                    <li key={l.lane}>
                      {LANE_LABEL[l.lane]}: ข้อมูลไม่เพียงพอ ({nameOf(l.enemyId!)})
                    </li>
                  ))}
                  {missingLanes.length > 0 && <li>ยังไม่กำหนดศัตรู: {missingLanes.map((l) => LANE_LABEL[l]).join(', ')}</li>}
                  {rec.counterEvidence.unverifiedPicks > 0 && (
                    <li>{rec.counterEvidence.unverifiedPicks} ตัวเลือกใช้ข้อมูลที่ตัวตนฮีโร่ยังไม่ยืนยัน</li>
                  )}
                  <li>ข้อมูลจากการสัมภาษณ์ในเอกสารเดียว ไม่ใช่สถิติ และไม่ทราบแพตช์</li>
                  <li>ความหมายของดาวและหัวกะโหลกมาจากเจ้าของโปรเจกต์ ยังไม่ได้ยืนยันกับ QZADD</li>
                  <li>ข้อมูล ROV META ไม่ระบุเลน ใช้เป็นตัวประกอบเท่านั้น</li>
                  <li>ฮีโร่ที่ศัตรูเลือกแล้วจะไม่ถูกแนะนำ (สมมติฐานว่าโหมดดราฟต์เลือกซ้ำข้ามทีมไม่ได้)</li>
                </ul>
              </div>
            </div>
            </details>
          </>
        )}
      </section>

      </>
      )}

      <section className="about" aria-labelledby="about-h">
        <details>
          <summary id="about-h">เกี่ยวกับข้อมูลและแหล่งที่มา</summary>
          <ul className="bullets">
            <li>
              แหล่งข้อมูลแก้ทาง: {c.title} — เครดิต {c.credit} · {c.basis} · แพตช์: ไม่ทราบ · สิทธิ์เผยแพร่ซ้ำ: ยังไม่ยืนยัน
            </li>
            <li>
              รายชื่อฮีโร่และบทบาท: {meta.sources.roster.title} ({meta.sources.roster.reliability}) ตรวจเมื่อ{' '}
              {meta.sources.roster.checkedAt ?? 'ไม่ทราบ'}
            </li>
            <li>
              ฮีโร่ทั้งหมด {meta.counts.heroes} ตัว · มีข้อมูลแก้ทางเมื่อเป็นศัตรู {meta.counts.heroesWithEnemyData} ตัว · ไม่มีข้อมูล{' '}
              {meta.counts.heroesWithoutEnemyData} ตัว · แถวข้อมูล {meta.counts.rows} แถว
            </li>
            <li>
              สถานะตัวตนฮีโร่ในช่อง: มนุษย์ยืนยัน {cells['human-confirmed']} · ระบบยืนยัน {cells['system-verified']} · ยังไม่ยืนยัน{' '}
              {cells['unverified']} · อ่านไม่ได้ {cells['unreadable']} · ขัดแย้ง {cells['conflict']}
            </li>
            <li>ดาว: 3 = แก้ทางได้ดีที่สุด ดาวน้อยลง = แก้ทางได้น้อยลง ({c.rankSemantics.starSource}, ยังไม่ยืนยันกับ QZADD) · หัวกะโหลก: 3 อัน = ห้ามเลือกมากที่สุด น้อยลง = อันตรายน้อยลง ({c.rankSemantics.skullSource ?? 'เจ้าของโปรเจกต์'}) · ข้อมูลสร้างเมื่อ {meta.generatedAt}</li>
            <li>วิธีเลือกทีม: ไม่ซ้ำฮีโร่ในทีม → เติมเลนให้มากที่สุด → ดาวรวมสูงสุด → สอดคล้องกับ ROV META → ตัวตนที่ยืนยันแล้วก่อน → บทบาทหลากหลาย → ตัวอักษร</li>
            <li>
              แหล่งที่ 2: {insights.sources.rovmeta.title} แพตช์ {insights.sources.rovmeta.patch} (แพ้ทาง/ชนะทาง/คู่หู ไม่ระบุเลน) ดึงเมื่อ{' '}
              {insights.sources.rovmeta.fetchedAt} — {insights.sources.rovmeta.reliability}
            </li>
            <li>
              แหล่งที่ 3: {insights.sources.copick.title} — ดราฟต์ลีกอาชีพปี {insights.copick?.year} จำนวน {insights.copick?.games} เกม (
              {insights.copick?.leagues.join(', ')}) · {insights.sources.copick.reliability}
            </li>
            <li>
              ภาพฮีโร่ (ลิขสิทธิ์ Garena / TiMi / Tencent) แสดงเฉพาะเมื่อรันในเครื่อง ส่วนเว็บที่ build เพื่อเผยแพร่จะใช้ตัวอักษรย่อแทนจนกว่าจะยืนยันสิทธิ์
            </li>
            <li>การเลือกของคุณถูกบันทึกในเบราว์เซอร์เครื่องนี้เท่านั้น (localStorage) ไม่ถูกส่งไปที่ใด กด “ล้างทั้งหมด” เพื่อลบ</li>
          </ul>
        </details>
      </section>

      <footer className="foot">
        RoV Counter Draft — โครงงานเพื่อการเรียนรู้ ไม่ใช่เว็บทางการของ Garena · ข้อมูลแก้ทางอ้างอิง {c.credit} ·
        ผลที่แสดงเป็นคำแนะนำเบื้องต้น ไม่รับประกันผลการเล่น
      </footer>
    </div>
  );
}
