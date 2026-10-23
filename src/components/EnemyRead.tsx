import type { Hero, Insights } from '../lib/types';
import { readEnemyDraft } from '../lib/draftRead';
import { Monogram } from './Monogram';
import { IconInfo } from './icons';

interface Props {
  enemyIds: string[];
  heroes: Map<string, Hero>;
  insights: Insights;
  open: boolean;
}

const nm = (heroes: Map<string, Hero>, id: string) => {
  const h = heroes.get(id);
  return h?.nameTh ?? h?.nameEn ?? id;
};

export function EnemyRead({ enemyIds, heroes, insights, open }: Props) {
  const read = readEnemyDraft(insights, enemyIds);
  const cp = insights.copick;

  return (
    <details className="enemy-read" open={open} data-testid="enemy-read">
      <summary>
        <span className="er-title">อ่านดราฟต์ศัตรู: คอมโบและตัวที่อาจหยิบต่อ</span>
        <span className="er-badge">ข้อมูลอินเทอร์เน็ต 2 แหล่ง</span>
      </summary>

      {read.likely.length > 0 && (
        <div className="er-likely">
          <p className="a-label">ศัตรูอาจหยิบต่อ (เรียงตามจำนวนหลักฐาน)</p>
          <ol className="er-list">
            {read.likely.map((l) => (
              <li key={l.heroId} data-testid={`likely-${l.heroId}`}>
                <Monogram hero={heroes.get(l.heroId)} size="sm" />
                <span className="er-name">{nm(heroes, l.heroId)}</span>
                <span className="er-why">
                  {l.mentions
                    .map((m) =>
                      m.source === 'copick'
                        ? `อยู่ทีมเดียวกับ ${nm(heroes, m.enemyId)} ${m.rate}% (${m.together} เกม)`
                        : `ROV META: คู่หูของ ${nm(heroes, m.enemyId)}`,
                    )
                    .join(' · ')}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="er-grid">
        {read.perEnemy.map((e) => (
          <div key={e.enemyId} className="er-card">
            <div className="er-head">
              <Monogram hero={heroes.get(e.enemyId)} size="sm" />
              <b>{nm(heroes, e.enemyId)}</b>
              {e.picks != null && <span className="muted small">ถูกเลือก {e.picks} ครั้งในลีกอาชีพ {cp?.year}</span>}
            </div>
            <p className="er-src">มักอยู่ทีมเดียวกัน (สถิติลีกอาชีพ)</p>
            {e.partners.length ? (
              <ul className="er-chips">
                {e.partners.map((p) => (
                  <li key={p.id} title={`อยู่ทีมเดียวกัน ${p.together} เกม · บ่อยกว่าค่าเฉลี่ย ${p.lift} เท่า`}>
                    {nm(heroes, p.id)} <b>{p.rate}%</b>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">ข้อมูลไม่พอ (ถูกเลือกน้อยกว่า {cp?.rules.minPicks ?? 15} ครั้ง หรือไม่มีคู่ที่เด่นชัด)</p>
            )}
            {(() => {
              const ap = insights.afterPick?.heroes[e.enemyId];
              const mu = insights.matchups?.heroes[e.enemyId];
              return (
                <>
                  {ap && ap.reply.length > 0 && (
                    <>
                      <p className="er-src">หลังตัวนี้ถูกหยิบ ฝั่งตรงข้ามมักตอบ (ลีกอาชีพ)</p>
                      <ul className="er-chips">
                        {ap.reply.slice(0, 4).map((r) => (
                          <li key={r.id} title={`${r.n} เกม`}>
                            {nm(heroes, r.id)} <b>{r.rate}%</b>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {mu && mu.loses.length > 0 && (
                    <>
                      <p className="er-src">ตัวนี้แพ้บ่อยเมื่อเจอ (ลีกอาชีพ)</p>
                      <ul className="er-chips alt">
                        {mu.loses.slice(0, 3).map((m) => (
                          <li key={m.id} title={`ตัวนี้ชนะแค่ ${m.win}% ใน ${m.n} เกม`}>
                            {nm(heroes, m.id)} <b>{m.win}%</b>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </>
              );
            })()}
            <p className="er-src">ROV META แนะนำเป็นคู่หู</p>
            {e.synergy.length ? (
              <ul className="er-chips alt">
                {e.synergy.map((s) => (
                  <li key={s}>{nm(heroes, s)}</li>
                ))}
              </ul>
            ) : (
              <p className="muted small">ไม่มีข้อมูล</p>
            )}
          </div>
        ))}
      </div>

      <p className="er-note">
        <IconInfo size={14} /> ใช้ประกอบการตัดสินใจเท่านั้น: สถิติมาจากดราฟต์ลีกอาชีพปี {cp?.year} ({cp?.games.toLocaleString()} เกม,
        คำนวณเองจากข้อมูลใน {insights.sources.copick.title}) ซึ่งไม่ระบุลำดับการหยิบ ตัวเลขคือ % ของเกมที่ฮีโร่นั้นถูกเลือกแล้วมีอีกตัวอยู่ทีมเดียวกัน
        ไม่ใช่ความน่าจะเป็นในเกมแรงก์ · คู่หูจาก ROV META เป็นข้อมูลจากเว็บแฟนอิสระ (แพตช์ {insights.sources.rovmeta.patch})
      </p>
    </details>
  );
}
