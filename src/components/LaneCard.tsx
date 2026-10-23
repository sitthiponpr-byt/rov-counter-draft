import type { Hero, Insights } from '../lib/types';
import { LANE_LABEL } from '../lib/types';
import { IDENTITY_RANK, stars, type Candidate, type LaneResult } from '../lib/engine';
import { IDENTITY_LABEL, IDENTITY_SHORT, heroName, markGlyph, markText, roleTh } from '../lib/format';
import { Monogram } from './Monogram';
import { TierBadge } from './TierBadge';
import { HeroDetail } from './HeroDetail';
import { useMedia } from '../lib/useMedia';
import { IconAlert, IconInfo, LaneIcon } from './icons';

interface Props {
  result: LaneResult;
  heroes: Map<string, Hero>;
  rovmeta?: Insights['rovmeta'];
  insights?: Insights;
}

export function TrustBadge({ c }: { c: Pick<Candidate, 'identity'> }) {
  return (
    <span className={`trust trust-${c.identity}`} title={IDENTITY_LABEL[c.identity]}>
      <span className="trust-dot" aria-hidden="true" />
      {IDENTITY_SHORT[c.identity]}
    </span>
  );
}

function MarkRaw({ c }: { c: Candidate }) {
  const isStar = c.mark.symbol === 'star';
  return (
    <span className={isStar ? 'mark' : 'mark mark-skull'}>
      <span aria-hidden="true">{markGlyph(c.mark)}</span>
      <span className="sr-only">
        {markText(c.mark)} {isStar ? '(3 ดาว = แก้ทางได้ดีที่สุด)' : '(3 หัวกะโหลก = ห้ามเลือกมากที่สุด)'}
      </span>
    </span>
  );
}

export function SupportBadge({ c }: { c: Pick<Candidate, 'support'> }) {
  if (!c.support) return null;
  return c.support === 'agree' ? (
    <span className="src-badge src-agree" title="ROV META ระบุว่าตัวนี้ชนะทางศัตรูตัวนี้ด้วย (ไม่ระบุเลน)">ROV META เห็นด้วย</span>
  ) : (
    <span className="src-badge src-disagree" title="ROV META ระบุว่าตัวนี้แพ้ทางศัตรูตัวนี้ (ไม่ระบุเลน)">ROV META เห็นต่าง</span>
  );
}

function CandidateRow({ c, heroes, note }: { c: Candidate; heroes: Map<string, Hero>; note?: string }) {
  const h = heroes.get(c.heroId);
  return (
    <li className="cand">
      <Monogram hero={h} size="sm" />
      <span className="cand-name">
        {heroName(h, c.heroId)}
        {note && <em className="cand-note">{note}</em>}
      </span>
      <span className="cand-meta">
        <TierBadge tier={c.tier} />
        <MarkRaw c={c} />
        <TrustBadge c={c} />
        <SupportBadge c={c} />
      </span>
    </li>
  );
}

const STATE: Record<Exclude<LaneResult['status'], 'ok'>, { title: string; body: string; tone: 'muted' | 'warn' }> = {
  'no-enemy': { title: 'ยังไม่มีศัตรูในเลนนี้', body: 'กำหนดเลนให้ศัตรูด้านบนเพื่อดูตัวเลือก', tone: 'muted' },
  'no-data': {
    title: 'ข้อมูลไม่เพียงพอ',
    body: 'เอกสารต้นทางไม่มีข้อมูลของศัตรูตัวนี้ในเลนนี้ ระบบจึงไม่สร้างคำแนะนำขึ้นเอง',
    tone: 'warn',
  },
  'no-usable-candidates': {
    title: 'ข้อมูลไม่เพียงพอ',
    body: 'ตัวเลือกในเอกสารถูกตัดออกทั้งหมด (ตัวตนอ่านไม่ได้ ขัดแย้ง ยังไม่ยืนยันและถูกซ่อน หรือศัตรูเลือกไปแล้ว)',
    tone: 'warn',
  },
};

export function LaneCard({ result, heroes, rovmeta, insights }: Props) {
  const { lane } = result;
  // จอแคบ: พับรายละเอียดหลักฐานไว้เพื่อลดความยาวหน้า (เปิดดูได้)
  const wide = useMedia('(min-width: 700px)');
  const enemy = result.enemyId ? heroes.get(result.enemyId) : undefined;
  const pickHero = result.pick ? heroes.get(result.pick.heroId) : undefined;
  const p = result.pick;
  const sameStars = !!p && result.alternates.some((a) => stars(a) === stars(p));
  const tiedAll =
    !!p &&
    result.alternates.some(
      (a) => stars(a) === stars(p) && a.support === p.support && IDENTITY_RANK[a.identity] === IDENTITY_RANK[p.identity],
    );
  const why = !p
    ? ''
    : !sameStars
      ? `ได้ระดับดาวสูงสุดในแถวนี้ (${stars(p)} ดาว)`
      : tiedAll
        ? `มีตัวเลือกระดับ ${stars(p)} ดาวที่หลักฐานเท่ากัน ระบบเลือกตามความหลากหลายบทบาทของทีม แล้วตามลำดับตัวอักษร`
        : p.support === 'agree'
          ? `ดาวเท่ากับตัวเลือกอื่น (${stars(p)} ดาว) แต่ ROV META ยืนยันว่าแก้ทางได้ด้วย`
          : `ดาวเท่ากับตัวเลือกอื่น (${stars(p)} ดาว) แต่การระบุตัวตนฮีโร่น่าเชื่อถือกว่า หรือตัวอื่นถูกใช้ในเลนอื่นแล้ว`;
  // แหล่งที่ 2: ตัวที่ ROV META บอกว่าแก้ทางศัตรูตัวนี้ได้ แต่ไม่อยู่ในรายการของ QZADD (ไม่ระบุเลน)
  const listed = new Set([p?.heroId, ...result.alternates.map((a) => a.heroId)]);
  const extra = result.enemyId && rovmeta ? (rovmeta[result.enemyId]?.weakAgainst ?? []).filter((h) => !listed.has(h)) : [];
  const allUsed = result.status === 'ok' && !result.pick;
  const state = result.status !== 'ok' ? STATE[result.status] : null;

  return (
    <article
      className={`lineup-card st-${result.pick ? 'pick' : allUsed ? 'used' : result.status}`}
      data-testid={`lane-result-${lane}`}
      aria-labelledby={`lane-title-${lane}`}
    >
      <header className="lc-head">
        <span className="lc-lane">
          <LaneIcon lane={lane} size={16} />
          <h3 id={`lane-title-${lane}`}>{LANE_LABEL[lane]}</h3>
        </span>
        {result.enemyId && (
          <span className="lc-vs">
            <span className="vs-tag">VS</span> {enemy?.nameTh ?? enemy?.nameEn ?? result.enemyId}
          </span>
        )}
      </header>

      {state && (
        <div className={`state state-${state.tone}`} role={state.tone === 'warn' ? 'status' : undefined}>
          {state.tone === 'warn' ? <IconAlert size={18} /> : <IconInfo size={18} />}
          <div>
            <p className="state-title">{state.title}</p>
            <p>{state.body}</p>
          </div>
        </div>
      )}

      {allUsed && (
        <div className="state state-warn" role="status">
          <IconAlert size={18} />
          <div>
            <p className="state-title">เว้นเลนนี้ไว้</p>
            <p>ตัวเลือกทั้งหมดถูกใช้ในเลนอื่นของทีมแล้ว (ไม่แนะนำฮีโร่ซ้ำในทีมเดียวกัน)</p>
          </div>
        </div>
      )}

      {result.pick && (
        <div className="lc-pick">
          <Monogram hero={pickHero} size="lg" />
          <div className="lc-pick-text">
            <strong className="lc-name" data-testid={`pick-${lane}`}>
              {heroName(pickHero, result.pick.heroId)}
            </strong>
            <span className="lc-tags">
              <TierBadge tier={rovmeta?.[result.pick.heroId]?.tier} />
              <span className="role-tag">{roleTh(pickHero?.role)}</span>
              <MarkRaw c={result.pick} />
              <TrustBadge c={result.pick} />
              <SupportBadge c={result.pick} />
            </span>
          </div>
        </div>
      )}

      {result.pick && (
        <details className="evidence" open={wide}>
          <summary>
            <span className="ev-label">หลักฐานการแก้ทาง</span>
            <span className="ev-peek">
              {stars(result.pick)} ดาว · QZADD หน้า {result.sourcePage}
            </span>
          </summary>
          <p>
            เอกสาร QZADD หน้า {result.sourcePage} จัดตัวนี้ไว้ในกลุ่ม <b>“เราควรเลือก”</b> เมื่อเจอ{' '}
            {heroName(enemy, result.enemyId ?? '')}
          </p>
          <p className="ev-sub">
            ระดับแก้ทางในเอกสาร: <MarkRaw c={result.pick} /> {stars(result.pick)}/3 ดาว{' '}
            <span className="muted">(3 ดาว = แก้ทางได้ดีที่สุด)</span>
          </p>
          <p className="ev-sub">
            แหล่งที่ 2 (ROV META):{' '}
            {result.pick.support === 'agree'
              ? 'ระบุว่าตัวนี้ชนะทางศัตรูตัวนี้เช่นกัน'
              : result.pick.support === 'disagree'
                ? 'ระบุว่าตัวนี้แพ้ทางศัตรูตัวนี้ — ควรพิจารณาเพิ่ม'
                : 'ไม่ได้กล่าวถึงคู่นี้'}
          </p>
          <p className="ev-sub">
            <b>ทำไมเลือกตัวนี้:</b> {why}
          </p>
        </details>
      )}

      {result.pick?.identity === 'unverified' && (
        <p className="ev-warn">
          <IconAlert size={15} /> ตัวตนฮีโร่ในเอกสารยังไม่ผ่านการยืนยัน ถือเป็นข้อมูลทดลอง
        </p>
      )}

      {(result.alternates.length > 0 || result.avoid.length > 0 || extra.length > 0 || (p && insights)) && (
        <div className="lc-more">
          {p && insights && (
            <details>
              <summary>ข้อมูลฮีโร่ {heroes.get(p.heroId)?.nameTh ?? p.heroId}: บิลด์ สถิติ แมตช์อัพ (ROV META)</summary>
              <HeroDetail heroId={p.heroId} heroes={heroes} insights={insights} compact />
            </details>
          )}
          {result.alternates.length > 0 && (
            <details>
              <summary>ตัวเลือกสำรอง ({result.alternates.length})</summary>
              <ul className="cand-list">
                {result.alternates.map((c) => (
                  <CandidateRow
                    key={c.heroId}
                    c={c}
                    heroes={heroes}
                    note={result.usedElsewhere.includes(c.heroId) ? 'ใช้ในเลนอื่นแล้ว' : undefined}
                  />
                ))}
              </ul>
            </details>
          )}
          {extra.length > 0 && (
            <details>
              <summary>แหล่งอื่นแนะนำเพิ่ม: ROV META ({extra.length})</summary>
              <p className="lc-foot">ROV META ระบุว่าฮีโร่เหล่านี้ชนะทางศัตรูตัวนี้ แต่ไม่ได้ระบุเลน และไม่อยู่ในเอกสาร QZADD ของเลนนี้</p>
              <ul className="cand-list">
                {extra.map((h) => (
                  <li key={h} className="cand">
                    <Monogram hero={heroes.get(h)} size="sm" />
                    <span className="cand-name">{heroName(heroes.get(h), h)}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {result.avoid.length > 0 && (
            <details>
              <summary>ห้ามเลือกตามเอกสาร ({result.avoid.length}) · เรียงจากอันตรายที่สุด</summary>
              <ul className="cand-list">
                {result.avoid.map((c) => (
                  <CandidateRow key={c.heroId} c={c} heroes={heroes} />
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {result.excluded.length > 0 && (
        <p className="lc-foot">ตัดออก {result.excluded.length} รายการ (อ่านไม่ได้/ขัดแย้ง/ซ่อน/ศัตรูเลือกแล้ว)</p>
      )}
    </article>
  );
}
