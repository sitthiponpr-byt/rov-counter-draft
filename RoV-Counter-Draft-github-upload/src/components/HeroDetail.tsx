import type { Hero, Insights } from '../lib/types';
import { LANE_LABEL } from '../lib/types';
import { heroName, roleTh, rovmetaUrl } from '../lib/format';
import { Monogram } from './Monogram';
import { TierBadge } from './TierBadge';

interface Props {
  heroId: string;
  heroes: Map<string, Hero>;
  insights: Insights;
  onPickHero?: (id: string) => void;
  compact?: boolean;
}

const pct = (v: number | null | undefined) => (v == null ? '—' : `${v}%`);

/** ข้อมูลฮีโร่จาก ROV META: เฉพาะข้อเท็จจริง (เทียร์ เลน สถิติ แมตช์อัพ บิลด์) พร้อมลิงก์ไปหน้าต้นทาง */
export function HeroDetail({ heroId, heroes, insights, onPickHero, compact }: Props) {
  const h = heroes.get(heroId);
  const rm = insights.rovmeta[heroId];
  const ps = insights.prostats?.heroes[heroId];
  const mu = insights.matchups?.heroes[heroId];
  const ap = insights.afterPick?.heroes[heroId];
  const label = (id: string) => heroes.get(id)?.nameTh ?? heroes.get(id)?.nameEn ?? id;
  const chips = (ids: string[] | undefined, tone: string) =>
    ids && ids.length ? (
      <ul className={`hd-chips ${tone}`}>
        {ids.map((id) => (
          <li key={id}>
            {onPickHero ? (
              <button type="button" onClick={() => onPickHero(id)}>
                <Monogram hero={heroes.get(id)} size="sm" />
                {label(id)}
              </button>
            ) : (
              <span>
                <Monogram hero={heroes.get(id)} size="sm" />
                {label(id)}
              </span>
            )}
          </li>
        ))}
      </ul>
    ) : (
      <p className="muted small">ไม่มีข้อมูล</p>
    );

  return (
    <div className={`hero-detail${compact ? ' is-compact' : ''}`} data-testid={`hero-detail-${heroId}`}>
      {!compact && (
        <div className="hd-head">
          <Monogram hero={h} size="lg" />
          <div>
            <h3>{heroName(h, heroId)}</h3>
            <p className="hd-meta">
              <TierBadge tier={rm?.tier} size="md" />
              <span>{roleTh(h?.role)}</span>
              {rm?.lane && <span>· {LANE_LABEL[rm.lane]}</span>}
              {rm?.difficulty && <span>· ความยาก {rm.difficulty}</span>}
            </p>
          </div>
        </div>
      )}
      {rm ? (
        <>
          <dl className="hd-stats">
            <div>
              <dt>วินเรตลีกอาชีพ</dt>
              <dd>{pct(rm.rates?.win)}</dd>
            </div>
            <div>
              <dt>อัตราเลือก</dt>
              <dd>{pct(rm.rates?.pick)}</dd>
            </div>
            <div>
              <dt>อัตราแบน</dt>
              <dd>{pct(rm.rates?.ban)}</dd>
            </div>
          </dl>
          <div className="hd-sources" data-testid={`hero-sources-${heroId}`}>
            <p className="hd-label">ตรวจทานจากหลายแหล่ง</p>
            <ul>
              <li>
                <span className="hs-src">ROV META</span> เทียร์ <TierBadge tier={rm.tier} /> · แพตช์ {insights.sources.rovmeta.patch}
              </li>
              {(insights.tierSources ?? []).map((t) => (
                <li key={t.key}>
                  <span className="hs-src">{t.title.split(' —')[0]}</span>{' '}
                  {t.tiers[heroId] ? <>เทียร์ <b>{t.tiers[heroId]}</b></> : <span className="muted">ไม่อยู่ในรายการ</span>}{' '}
                  <span className="muted">({t.pageDate}, สเกล {t.scale.join('/')})</span>
                </li>
              ))}
              {ps ? (
                <li>
                  <span className="hs-src">ลีกอาชีพ {insights.prostats?.year}</span> หยิบ {ps.picks} เกม
                  {ps.picks >= (insights.prostats?.minPicksForWinRate ?? 20) ? <> · ชนะ <b>{ps.winRate}%</b></> : <span className="muted"> · ตัวอย่างน้อย ไม่สรุปวินเรต</span>}
                  {' '}· แบน {ps.banRate}% · โผล่ในดราฟต์ {ps.presence}%{' '}
                  <span className="muted">(คำนวณเองจาก {insights.prostats?.games.toLocaleString()} เกม)</span>
                </li>
              ) : (
                <li>
                  <span className="hs-src">ลีกอาชีพ</span> <span className="muted">ไม่ถูกหยิบ/แบนในปี {insights.prostats?.year}</span>
                </li>
              )}
            </ul>
          </div>
          {(mu || ap) && (
            <div className="hd-pro" data-testid={`hero-pro-${heroId}`}>
              <p className="hd-label">จากดราฟต์ลีกอาชีพ {insights.prostats?.year} (เจอกันจริงอย่างน้อย {insights.matchups?.minGames} เกม)</p>
              {mu && (mu.beats.length > 0 || mu.loses.length > 0) ? (
                <div className="hd-pro-grid">
                  <div>
                    <p className="small muted">ชนะบ่อยเมื่อเจอ</p>
                    <ul className="hd-mu">
                      {mu.beats.slice(0, 4).map((m) => (
                        <li key={m.id} title={`ช่วงเชื่อมั่น 95%: ${m.lb}–${m.ub}%`}>
                          {label(m.id)} <b>{m.win}%</b> <span className="muted">({m.n} เกม)</span>
                        </li>
                      ))}
                      {mu.beats.length === 0 && <li className="muted">ไม่มีคู่ที่ชัดเจน</li>}
                    </ul>
                  </div>
                  <div>
                    <p className="small muted">แพ้บ่อยเมื่อเจอ</p>
                    <ul className="hd-mu lose">
                      {mu.loses.slice(0, 4).map((m) => (
                        <li key={m.id} title={`ช่วงเชื่อมั่น 95%: ${m.lb}–${m.ub}%`}>
                          {label(m.id)} <b>{m.win}%</b> <span className="muted">({m.n} เกม)</span>
                        </li>
                      ))}
                      {mu.loses.length === 0 && <li className="muted">ไม่มีคู่ที่ชัดเจน</li>}
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="small muted">ยังไม่มีคู่เจอกันที่ตัวอย่างพอจะสรุป</p>
              )}
              {ap && ap.reply.length > 0 && (
                <p className="small">
                  หลังฮีโร่นี้ถูกหยิบ ฝั่งตรงข้ามมักตอบด้วย:{' '}
                  {ap.reply.slice(0, 3).map((r) => `${label(r.id)} ${r.rate}%`).join(' · ')}{' '}
                  <span className="muted">(จาก {ap.picks} เกมที่ถูกหยิบ)</span>
                </p>
              )}
              <p className="small muted">นับเฉพาะคู่ที่ช่วงเชื่อมั่นไม่คร่อม 50% ไม่แยกเลน และเป็นเกมลีกอาชีพ ไม่ใช่แรงค์</p>
            </div>
          )}
          <div className="hd-grid">
            <div>
              <p className="hd-label">แพ้ทาง (ตัวที่แก้ทางฮีโร่นี้)</p>
              {chips(rm.weakAgainst, 'bad')}
            </div>
            <div>
              <p className="hd-label">ชนะทาง</p>
              {chips(rm.strongAgainst, 'good')}
            </div>
            <div>
              <p className="hd-label">คู่หูที่เข้ากัน</p>
              {chips(rm.bestSynergy, 'syn')}
            </div>
          </div>
          {(!!rm.build?.length || !!rm.runes?.length || !!rm.spell) && (
            <div className="hd-build">
              <p className="hd-label">บิลด์แนะนำ</p>
              {!!rm.build?.length && (
                <ol className="hd-items">
                  {rm.build.map((it, i) => (
                    <li key={it + i}>
                      <span className="hd-no">{i + 1}</span>
                      {it}
                    </li>
                  ))}
                </ol>
              )}
              <p className="small muted">
                {rm.spell && (
                  <>
                    สเปล: <b>{rm.spell}</b> ·{' '}
                  </>
                )}
                {!!rm.runes?.length && (
                  <>
                    รูน: <b>{rm.runes.join(', ')}</b> ·{' '}
                  </>
                )}
                {rm.skillPriority && (
                  <>
                    ลำดับอัปสกิล: <b>{rm.skillPriority}</b>
                  </>
                )}
              </p>
            </div>
          )}
          <p className="hd-src">
            ที่มา: ROV META แพตช์ {insights.sources.rovmeta.patch} (เว็บแฟนอิสระ ไม่ใช่ทางการ) ·{' '}
            <a href={rovmetaUrl(heroId)} target="_blank" rel="noopener noreferrer">
              อ่านบทวิเคราะห์เต็มบน ROV META ↗
            </a>
          </p>
        </>
      ) : (
        <p className="muted small">ไม่มีข้อมูลจาก ROV META</p>
      )}
    </div>
  );
}
