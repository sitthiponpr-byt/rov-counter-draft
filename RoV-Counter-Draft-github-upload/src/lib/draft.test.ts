import { describe, expect, it } from 'vitest';
import {
  DRAFT_ORDER, act, bansOf, canAct, currentGame, currentStep, draftComplete, globalBans, isDecider, newSeries,
  nextGame, picksOf, recordWinner, sanitizeSeries, score, seriesWinner, undo, unavailableReason, type Series,
} from './draft';

const H = Array.from({ length: 80 }, (_, i) => `h${i}`);
const ids = new Set(H);

/** เล่นเกมปัจจุบันจนจบด้วยฮีโร่ชุดที่ให้ (ข้ามตัวที่ใช้ไม่ได้) */
function playGame(s: Series, pool: string[]): Series {
  let i = 0;
  while (currentStep(currentGame(s))) {
    while (!canAct(s, pool[i])) i++;
    s = act(s, pool[i++]);
  }
  return s;
}

describe('ลำดับแบน/พิค', () => {
  it('ลีกอาชีพ 2 เฟส: แบนทีมละ 4 พิคทีมละ 5 ตามลำดับที่ยืนยัน', () => {
    expect(DRAFT_ORDER).toHaveLength(18);
    const sig = DRAFT_ORDER.map((s) => `${s.side[0]}${s.kind[0]}`).join(' ');
    expect(sig).toBe('bb rb bb rb bp rp rp bp bp rp rb bb rb bb rp bp bp rp');
    expect(DRAFT_ORDER.filter((s) => s.side === 'blue' && s.kind === 'ban')).toHaveLength(4);
    expect(DRAFT_ORDER.filter((s) => s.side === 'red' && s.kind === 'pick')).toHaveLength(5);
  });

  it('ห้ามเลือก/แบนฮีโร่ซ้ำในเกมเดียวกัน และข้ามได้เฉพาะตาแบน', () => {
    let s = newSeries(3, 'blue');
    s = act(s, 'h1'); // ฟ้าแบน
    expect(unavailableReason(s, 'h1', 'them', 'pick')).toBe('banned');
    expect(canAct(s, 'h1')).toBe(false);
    s = act(s, null); // แดงข้ามการแบน
    expect(bansOf(currentGame(s), 'them')).toEqual([null]);
    s = act(s, 'h2');
    s = act(s, 'h3');
    expect(currentStep(currentGame(s))?.kind).toBe('pick');
    expect(canAct(s, null)).toBe(false); // ข้ามตาพิคไม่ได้
    s = act(s, 'h4');
    expect(unavailableReason(s, 'h4', 'them', 'pick')).toBe('picked');
  });

  it('ย้อนกลับได้ทีละขั้น', () => {
    let s = act(act(newSeries(3, 'blue'), 'h1'), 'h2');
    s = undo(s);
    expect(currentGame(s).actions).toEqual(['h1']);
  });
});

describe('ซีรีส์ BO3/BO5', () => {
  it('Global Ban: ทีมใช้ฮีโร่ที่ตัวเองเคยใช้ซ้ำไม่ได้ แต่อีกทีมใช้ได้', () => {
    let s = playGame(newSeries(3, 'blue'), H);
    const g1 = currentGame(s);
    const ourPicks = picksOf(g1, 'us');
    expect(ourPicks).toHaveLength(5);
    s = recordWinner(s, 'us');
    s = nextGame(s, 'blue'); // ทีมคู่แข่งแพ้ เลือกฝั่งฟ้า
    expect(currentGame(s).blue).toBe('them');
    expect([...globalBans(s, 1, 'us')].sort()).toEqual([...ourPicks].sort());
    expect(unavailableReason(s, ourPicks[0], 'us', 'pick')).toBe('global-ban');
    expect(unavailableReason(s, ourPicks[0], 'them', 'pick')).toBeNull();
    expect(unavailableReason(s, ourPicks[0], 'them', 'ban')).toBeNull();
  });

  it('เกมตัดสินเป็น Ultimate Battle: ล้าง Global Ban ทั้งหมด', () => {
    let s = newSeries(3, 'blue');
    s = playGame(s, H);
    s = nextGame(recordWinner(s, 'us'), 'red');
    s = playGame(s, H);
    s = nextGame(recordWinner(s, 'them'), 'blue');
    const g3 = currentGame(s);
    expect(g3.number).toBe(3);
    expect(isDecider(s, g3)).toBe(true);
    expect(globalBans(s, 2, 'us').size).toBe(0);
    expect(globalBans(s, 2, 'them').size).toBe(0);
  });

  it('ทีมที่แพ้เลือกฝั่ง และจบซีรีส์เมื่อชนะครบ', () => {
    let s = newSeries(3, 'red');
    expect(currentGame(s).blue).toBe('them');
    s = recordWinner(playGame(s, H), 'us');
    s = nextGame(s, 'red'); // คู่แข่ง (แพ้) เลือกแดง → เราได้ฟ้า
    expect(currentGame(s).blue).toBe('us');
    s = recordWinner(playGame(s, H.slice(20)), 'us');
    expect(score(s)).toEqual({ us: 2, them: 0 });
    expect(seriesWinner(s)).toBe('us');
    expect(nextGame(s, 'blue')).toBe(s); // ซีรีส์จบแล้ว
  });

  it('BO5 ต้องชนะ 3 เกม และเกม 5 เท่านั้นที่เป็นเกมตัดสิน', () => {
    let s = newSeries(5, 'blue');
    for (let g = 0; g < 4; g++) {
      expect(isDecider(s, currentGame(s))).toBe(false);
      s = recordWinner(playGame(s, H), g % 2 ? 'us' : 'them');
      s = nextGame(s, 'blue');
    }
    expect(currentGame(s).number).toBe(5);
    expect(isDecider(s, currentGame(s))).toBe(true);
    expect(seriesWinner(s)).toBeNull();
  });

  it('บันทึกผลได้เมื่อดราฟต์ครบเท่านั้น', () => {
    const s = act(newSeries(3, 'blue'), 'h1');
    expect(draftComplete(currentGame(s))).toBe(false);
    expect(recordWinner(s, 'us')).toBe(s);
  });

  it('ข้อมูลที่บันทึกในเบราว์เซอร์ต้องผ่านการตรวจกติกา', () => {
    let s = recordWinner(playGame(newSeries(3, 'blue'), H), 'them');
    s = nextGame(s, 'red');
    s = act(s, 'h50');
    const back = sanitizeSeries(JSON.parse(JSON.stringify(s)), ids);
    expect(back).toEqual(s);
    // แก้ข้อมูลให้ผิดกติกา: ทีมเราพิคซ้ำตัวที่เคยใช้ในเกม 1
    const bad = JSON.parse(JSON.stringify(s));
    // เกม 2: คู่แข่งอยู่ฝั่งฟ้า → ขั้นที่ 6 (index 5) เป็นตาพิคของทีมเรา (แดง)
    expect(s.games[1].blue).toBe('them');
    bad.games[1].actions = [null, null, null, null, 'h79', picksOf(s.games[0], 'us')[0]];
    expect(sanitizeSeries(bad, ids)).toBeNull();
    expect(sanitizeSeries({ format: 7 }, ids)).toBeNull();
    expect(sanitizeSeries('x', ids)).toBeNull();
  });
});
