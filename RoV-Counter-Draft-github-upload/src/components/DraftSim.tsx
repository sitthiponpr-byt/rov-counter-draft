import { useEffect, useMemo, useState } from 'react';
import type { Dataset, Hero, Insights } from '../lib/types';
import {
  DRAFT_ORDER, act, bansOf, canAct, currentGame, currentStep, draftComplete, globalBans, isDecider, newSeries,
  nextGame, picksOf, recordWinner, sanitizeSeries, score, seriesWinner, teamOnSide, undo, unavailableReason,
  winsNeeded, type Series, type Side, type TeamId,
} from '../lib/draft';
import { suggestBans, suggestPicks, type Advice } from '../lib/draftAdvice';
import { ROLE_TH, roleTh } from '../lib/format';
import { Monogram } from './Monogram';
import { TierBadge } from './TierBadge';
import { IconReset, IconSearch } from './icons';

const KEY = 'rov-counter-draft:series:v1';
const SIDE_TH: Record<Side, string> = { blue: 'ฝั่งฟ้า', red: 'ฝั่งแดง' };
const REASON_TH = { banned: 'แบนแล้ว', picked: 'ถูกเลือกแล้ว', 'global-ban': 'Global Ban' } as const;
const SRC_TH: Record<string, string> = {
  qzadd: 'QZADD', rovmeta: 'ROV META', prostats: 'สถิติลีกอาชีพ', copick: 'ลีกอาชีพ', tierlists: 'เทียร์ลิสต์', team: 'ทีม', h2h: 'เจอกันจริง', reply: 'หยิบตอบ',
};

interface Props {
  data: Dataset;
  heroById: Map<string, Hero>;
  insights: Insights;
}

function load(ids: Set<string>): Series | null {
  try {
    const s = localStorage.getItem(KEY);
    return s ? sanitizeSeries(JSON.parse(s), ids) : null;
  } catch {
    return null;
  }
}

export function DraftSim({ data, heroById, insights }: Props) {
  const ids = useMemo(() => new Set(data.heroes.map((h) => h.id)), [data]);
  const [series, setSeries] = useState<Series | null>(() => load(ids));
  const [format, setFormat] = useState<3 | 5>(3);
  const [usSide, setUsSide] = useState<Side>('blue');
  const [names, setNames] = useState({ us: '', them: '' });
  const [q, setQ] = useState('');
  const [role, setRole] = useState('all');
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    try {
      if (series) localStorage.setItem(KEY, JSON.stringify(series));
      else localStorage.removeItem(KEY);
    } catch {
      /* ใช้งานต่อได้แม้บันทึกไม่ได้ */
    }
  }, [series]);

  const name = (id: string) => heroById.get(id)?.nameTh ?? heroById.get(id)?.nameEn ?? id;

  if (!series) {
    return (
      <section className="panel-section" aria-labelledby="bp-h">
        <div className="sec-head">
          <div>
            <p className="eyebrow">จำลองการแข่งขัน</p>
            <h2 id="bp-h">แบน/พิคแบบแข่งจริง</h2>
          </div>
        </div>
        <div className="bp-setup">
          <fieldset>
            <legend>รูปแบบซีรีส์</legend>
            {([3, 5] as const).map((f) => (
              <label key={f} className={`seg${format === f ? ' is-on' : ''}`}>
                <input type="radio" name="bp-format" checked={format === f} onChange={() => setFormat(f)} />
                BO{f}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>ฝั่งของทีมเราในเกมแรก</legend>
            {(['blue', 'red'] as const).map((s) => (
              <label key={s} className={`seg seg-${s}${usSide === s ? ' is-on' : ''}`}>
                <input type="radio" name="bp-side" checked={usSide === s} onChange={() => setUsSide(s)} />
                {SIDE_TH[s]}
              </label>
            ))}
          </fieldset>
          <div className="bp-names">
            <label>
              ชื่อทีมเรา
              <input value={names.us} maxLength={30} placeholder="ทีมเรา" onChange={(e) => setNames({ ...names, us: e.target.value })} />
            </label>
            <label>
              ชื่อทีมคู่แข่ง
              <input value={names.them} maxLength={30} placeholder="ทีมคู่แข่ง" onChange={(e) => setNames({ ...names, them: e.target.value })} />
            </label>
          </div>
          <ul className="bp-rules">
            <li>ลำดับลีกอาชีพ 2 เฟส: แบน 2-2 → พิค ฟ้า1 แดง1-2 ฟ้า2-3 แดง3 → แบน 2-2 (แดงเริ่ม) → พิค แดง4 ฟ้า4-5 แดง5 · แบนทีมละ 4 ข้ามการแบนได้</li>
            <li>Global Ban Pick: ทีมใช้ฮีโร่ที่ตัวเองเคยใช้ในเกมก่อนหน้าซ้ำไม่ได้ (อีกทีมยังใช้ได้)</li>
            <li>เกมตัดสิน (เกม {format} ของ BO{format}) เป็น Ultimate Battle: ล้าง Global Ban ทั้งหมด</li>
            <li>จบเกมแล้วบันทึกผล ทีมที่แพ้เป็นผู้เลือกฝั่งของเกมถัดไป</li>
          </ul>
          <button type="button" className="btn" onClick={() => setSeries(newSeries(format, usSide, names))}>
            เริ่มซีรีส์ BO{format}
          </button>
        </div>
      </section>
    );
  }

  const g = currentGame(series);
  const gi = series.games.length - 1;
  const st = currentStep(g);
  const turnTeam: TeamId | null = st ? teamOnSide(g, st.side) : null;
  const sc = score(series);
  const winner = seriesWinner(series);
  const decider = isDecider(series, g);
  const ourPicks = picksOf(g, 'us');
  const theirPicks = picksOf(g, 'them');
  const ctx = { data, insights, name };

  let advice: Advice[] = [];
  if (st && turnTeam) {
    const own = turnTeam === 'us' ? ourPicks : theirPicks;
    const opp = turnTeam === 'us' ? theirPicks : ourPicks;
    const oppTeam: TeamId = turnTeam === 'us' ? 'them' : 'us';
    advice =
      st.kind === 'pick'
        ? suggestPicks(ctx, own, opp, (id) => unavailableReason(series, id, turnTeam, 'pick') === null)
        : suggestBans(ctx, own, opp, (id) => unavailableReason(series, id, oppTeam, 'pick') === null && unavailableReason(series, id, turnTeam, 'ban') === null);
  }

  const pool = data.heroes
    .filter((h) => (role === 'all' || h.role === role) && (!q.trim() || h.nameEn.toLowerCase().includes(q.trim().toLowerCase()) || (h.nameTh ?? '').includes(q.trim())))
    .sort((a, b) => a.nameEn.localeCompare(b.nameEn));

  const doAct = (id: string | null) => setSeries((s) => (s ? act(s, id) : s));
  const loser: TeamId | null = g.winner ? (g.winner === 'us' ? 'them' : 'us') : null;

  const TeamCol = ({ side }: { side: Side }) => {
    const team = teamOnSide(g, side);
    const bans = bansOf(g, team);
    const picks = picksOf(g, team);
    const gb = [...globalBans(series, gi, team)];
    const isTurn = st?.side === side;
    return (
      <div className={`bp-team bp-${side}${isTurn ? ' is-turn' : ''}`} data-testid={`bp-team-${side}`}>
        <div className="bp-team-head">
          <span className="bp-side">{SIDE_TH[side]}</span>
          <b>{series.names[team]}</b>
          {team === 'us' && <span className="bp-us">ทีมเรา</span>}
        </div>
        <p className="bp-label">แบน</p>
        <ul className="bp-bans">
          {Array.from({ length: 4 }, (_, i) => {
            const b = bans[i];
            const active = isTurn && st?.kind === 'ban' && i === bans.length;
            return (
              <li key={i} className={`${active ? 'is-active' : ''}${b === null && i < bans.length ? ' is-skip' : ''}`}>
                {b ? <Monogram hero={heroById.get(b)} size="sm" /> : <span className="bp-empty">{i < bans.length ? 'ข้าม' : ''}</span>}
                {b && <span className="sr-only">{name(b)}</span>}
              </li>
            );
          })}
        </ul>
        <p className="bp-label">พิค</p>
        <ol className="bp-picks">
          {Array.from({ length: 5 }, (_, i) => {
            const p = picks[i];
            const active = isTurn && st?.kind === 'pick' && i === picks.length;
            return (
              <li key={i} className={active ? 'is-active' : ''}>
                <span className="bp-no">{i + 1}</span>
                {p ? (
                  <>
                    <Monogram hero={heroById.get(p)} size="sm" />
                    <span className="bp-name">{name(p)}</span>
                    <TierBadge tier={insights.rovmeta[p]?.tier} />
                  </>
                ) : (
                  <span className="bp-empty">{active ? 'กำลังเลือก…' : '—'}</span>
                )}
              </li>
            );
          })}
        </ol>
        {gb.length > 0 && (
          <details className="bp-gb">
            <summary>Global Ban ของทีมนี้ ({gb.length})</summary>
            <p className="small muted">{gb.map(name).join(', ')}</p>
          </details>
        )}
      </div>
    );
  };

  return (
    <section className="panel-section" aria-labelledby="bp-h">
      <div className="sec-head">
        <div>
          <p className="eyebrow">จำลองการแข่งขัน · BO{series.format}</p>
          <h2 id="bp-h">แบน/พิคแบบแข่งจริง</h2>
        </div>
        <div className="sec-tools">
          <span className="bp-score" data-testid="bp-score">
            {series.names.us} <b>{sc.us}</b> – <b>{sc.them}</b> {series.names.them}
            <small> (ชนะ {winsNeeded(series)} เกมก่อนชนะซีรีส์)</small>
          </span>
          {confirmReset ? (
            <span className="confirm">
              เริ่มซีรีส์ใหม่?
              <button type="button" className="btn btn-danger btn-sm" onClick={() => { setSeries(null); setConfirmReset(false); }}>ยืนยัน</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmReset(false)}>ยกเลิก</button>
            </span>
          ) : (
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setConfirmReset(true)}>
              <IconReset size={15} /> เริ่มซีรีส์ใหม่
            </button>
          )}
        </div>
      </div>

      <ol className="bp-games" aria-label="เกมในซีรีส์">
        {Array.from({ length: series.format }, (_, i) => {
          const gm = series.games[i];
          return (
            <li key={i} className={`${i === gi ? 'is-on' : ''}${gm?.winner ? ' is-done' : ''}`}>
              เกม {i + 1}
              {i + 1 === series.format && <small> · ตัดสิน</small>}
              {gm?.winner && <small> · {series.names[gm.winner]} ชนะ</small>}
            </li>
          );
        })}
      </ol>

      <div className="bp-turn" role="status" aria-live="polite" data-testid="bp-turn">
        {winner ? (
          <b className="bp-champ">{series.names[winner]} ชนะซีรีส์ {sc[winner]}–{sc[winner === 'us' ? 'them' : 'us']}</b>
        ) : st ? (
          <>
            เกม {g.number}
            {decider && <span className="bp-ub">Ultimate Battle</span>} · ตาของ <b>{series.names[turnTeam!]}</b> ({SIDE_TH[st.side]}):{' '}
            <b>{st.kind === 'ban' ? `แบนครั้งที่ ${st.n}` : `พิคตัวที่ ${st.n}`}</b> · เฟส {st.phase} · ขั้น {g.actions.length + 1}/{DRAFT_ORDER.length}
          </>
        ) : g.winner ? (
          <>เกม {g.number} จบแล้ว: {series.names[g.winner]} ชนะ</>
        ) : (
          <>ดราฟต์เกม {g.number} ครบแล้ว บันทึกผลการแข่งขัน</>
        )}
      </div>

      <div className="bp-controls">
        {st?.kind === 'ban' && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => doAct(null)}>
            ข้ามการแบน
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSeries(undo(series))} disabled={!g.actions.length && series.games.length === 1}>
          ย้อนกลับ 1 ขั้น
        </button>
        {draftComplete(g) && !g.winner && (
          <>
            <span className="small muted">ผลเกม {g.number}:</span>
            <button type="button" className="btn btn-sm" onClick={() => setSeries(recordWinner(series, 'us'))}>{series.names.us} ชนะ</button>
            <button type="button" className="btn btn-sm btn-danger" onClick={() => setSeries(recordWinner(series, 'them'))}>{series.names.them} ชนะ</button>
          </>
        )}
        {g.winner && !winner && loser && (
          <span className="bp-side-pick" data-testid="bp-side-pick">
            {series.names[loser]} (แพ้) เลือกฝั่งเกม {g.number + 1}:
            <button type="button" className="btn btn-sm bp-btn-blue" onClick={() => setSeries(nextGame(series, 'blue'))}>ฝั่งฟ้า</button>
            <button type="button" className="btn btn-sm bp-btn-red" onClick={() => setSeries(nextGame(series, 'red'))}>ฝั่งแดง</button>
          </span>
        )}
      </div>

      <div className="bp-board">
        <TeamCol side="blue" />
        <TeamCol side="red" />
      </div>

      {st && turnTeam && (
        <div className="bp-advice" data-testid="bp-advice">
          <p className="a-label">
            {turnTeam === 'us'
              ? st.kind === 'pick' ? 'แนะนำพิคให้ทีมเรา' : 'แนะนำแบนให้ทีมเรา'
              : st.kind === 'pick' ? 'คาดว่าคู่แข่งอาจหยิบ' : 'คาดว่าคู่แข่งอาจแบน'}
            <span className="tag-heur">heuristic เบื้องต้น</span>
          </p>
          {advice.length === 0 ? (
            <p className="small muted">ยังไม่มีข้อมูลพอสำหรับคำแนะนำในขั้นนี้</p>
          ) : (
            <ol className="bp-adv-list">
              {advice.map((a) => (
                <li key={a.heroId}>
                  <button type="button" className="bp-adv" onClick={() => doAct(a.heroId)} disabled={!canAct(series, a.heroId)} data-testid={`bp-adv-${a.heroId}`}>
                    <Monogram hero={heroById.get(a.heroId)} size="sm" />
                    <span className="bp-adv-name">{name(a.heroId)}</span>
                    <TierBadge tier={insights.rovmeta[a.heroId]?.tier} />
                    <span className="bp-adv-score">{a.score.toFixed(1)}</span>
                  </button>
                  <ul className="bp-reasons">
                    {a.reasons.slice(0, 4).map((r, i) => (
                      <li key={i} className={r.weight < 0 ? 'neg' : ''}>
                        <span className="src">{SRC_TH[r.source]}</span> {r.text}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
          <p className="small muted">คะแนนรวมจาก QZADD (ดาว/หัวกะโหลก) ROV META สถิติลีกอาชีพปี 2026 และเทียร์ลิสต์อื่น น้ำหนักตั้งเองยังไม่ผ่านการพิสูจน์ ใช้ประกอบการตัดสินใจ</p>
        </div>
      )}

      {st && (
        <div className="bp-pool">
          <div className="tl-tools">
            <div className="chips" role="group" aria-label="กรองตามบทบาท">
              {['all', ...Object.keys(ROLE_TH)].map((r) => (
                <button key={r} type="button" className={`chip-btn${role === r ? ' is-on' : ''}`} aria-pressed={role === r} onClick={() => setRole(r)}>
                  {r === 'all' ? 'ทั้งหมด' : ROLE_TH[r]}
                </button>
              ))}
            </div>
            <label className="search">
              <IconSearch size={17} />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาฮีโร่" aria-label="ค้นหาฮีโร่สำหรับแบน/พิค" />
            </label>
          </div>
          <ul className="hero-grid bp-grid">
            {pool.map((h) => {
              const why = turnTeam ? unavailableReason(series, h.id, turnTeam, st.kind) : null;
              return (
                <li key={h.id}>
                  <button
                    type="button"
                    className={`hero-tile${why ? ' is-taken' : ''}`}
                    disabled={!!why}
                    onClick={() => doAct(h.id)}
                    data-testid={`bp-hero-${h.id}`}
                    aria-label={`${st.kind === 'ban' ? 'แบน' : 'พิค'} ${h.nameEn}${why ? ` — ${REASON_TH[why]}` : ''}`}
                  >
                    <Monogram hero={h} size="sm" />
                    <span className="tile-text">
                      <span className="tile-name">{h.nameTh ?? h.nameEn}</span>
                      <span className="tile-en">{why ? REASON_TH[why] : roleTh(h.role)}</span>
                    </span>
                    <span className="tile-tier">
                      <TierBadge tier={insights.rovmeta[h.id]?.tier} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
