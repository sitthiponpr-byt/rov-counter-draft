// สร้างข้อมูลสำหรับเว็บ (src/data/*.json) จาก data-source/ — เฉพาะข้อความ/ตัวเลข ไม่มีภาพหรือชื่อไฟล์ภาพ
// รันด้วย: npm run build:data   (ต้องมีโฟลเดอร์ data-source/ ในเครื่อง; repo สาธารณะไม่ต้องมี เพราะ src/data ถูก commit แล้ว)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ds = join(root, 'data-source');
const out = join(root, 'src', 'data');
const rd = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));

for (const p of ['matching/slots.v2.json', 'researched/hero-roster.v2.json']) {
  if (!existsSync(join(ds, p))) throw new Error(`ไม่พบ data-source/${p}`);
}
const slotsV2 = rd(join(ds, 'matching/slots.v2.json'));
const roster = rd(join(ds, 'researched/hero-roster.v2.json'));
const humanPath = join(ds, 'matching/review/human-eval/evaluation.json');
const human = existsSync(humanPath) ? rd(humanPath) : { results: [] };
const markSemantics = rd(join(ds, 'researched/mark-semantics.json'));

// ผลตรวจมนุษย์: นับเป็น human-confirmed เฉพาะที่ตัดสิน "hero" และตรงกับป้ายที่ระบบเสนอ
const humanConfirmed = new Map();
for (const r of human.results ?? []) {
  if (r.decision === 'hero' && r.humanHero) humanConfirmed.set(r.itemId, r.humanHero);
}

const heroIds = new Set(roster.heroes.map((h) => h.id));
const problems = [];
const identityCounts = { 'human-confirmed': 0, 'system-verified': 0, unverified: 0, unreadable: 0, conflict: 0 };

function identityOf(entry, slot, h) {
  const key = `${entry.file.slice(0, 9)}-r${entry.row}-s${slot.cell.slot}-${h.part}`;
  if (h.id == null) return { status: 'unreadable' };
  if (humanConfirmed.get(key) === h.id) return { status: 'human-confirmed' };
  if ((h.reviewReasons ?? []).includes('strong-matcher-disagrees-with-label')) return { status: 'conflict' };
  if (h.status === 'verified') return { status: 'system-verified' };
  return { status: 'unverified' };
}

const rows = slotsV2.entries.map((e) => {
  if (!heroIds.has(e.enemy.id)) problems.push(`enemy not in roster: ${e.enemy.id}`);
  const conv = (slots) =>
    slots.map((s) => ({
      position: s.position,
      mark: { symbol: s.rankSymbol, count: s.displayedRank }, // ข้อมูลดิบ: ความหมายยังไม่ทราบ
      heroes: s.heroes.map((h) => {
        const identity = identityOf(e, s, h);
        identityCounts[identity.status]++;
        if (h.id != null && !heroIds.has(h.id)) problems.push(`candidate not in roster: ${h.id}`);
        return h.id == null ? { id: null, identity } : { id: h.id, identity };
      }),
    }));
  return {
    id: `${e.lane}:${e.enemy.id}`,
    lane: e.lane,
    enemyId: e.enemy.id,
    enemyCaption: e.enemy.nameEn,
    sourcePage: e.page,
    good: conv(e.goodPicks),
    avoid: conv(e.badPicks),
  };
});

const ids = rows.map((r) => r.id);
if (new Set(ids).size !== ids.length) problems.push('duplicate (lane, enemy) rows');
if (rows.length !== 108) problems.push(`expected 108 rows, got ${rows.length}`);
if (problems.length) throw new Error('ข้อมูลไม่ผ่านการตรวจ:\n' + problems.join('\n'));

const lanesOf = {};
for (const r of rows) (lanesOf[r.enemyId] ??= []).push(r.lane);

const heroes = roster.heroes.map((h) => ({
  id: h.id,
  nameEn: h.nameEn,
  nameTh: h.nameTh ?? null,
  role: h.listedRole ?? null,
  enemyLanes: lanesOf[h.id] ?? [],
}));

const meta = {
  generatedAt: new Date().toISOString().slice(0, 10),
  dataVersion: 'v0.1-draft',
  counts: {
    heroes: heroes.length,
    rows: rows.length,
    heroesWithEnemyData: Object.keys(lanesOf).length,
    heroesWithoutEnemyData: heroes.length - Object.keys(lanesOf).length,
    identityCells: identityCounts,
  },
  sources: {
    counters: {
      title: 'สรุปแก้ทาง RoV 2026 ฉบับ QZADD',
      credit: 'QZADD / GAS TOPUP',
      basis: 'อ้างอิงจากการสัมภาษณ์ผู้เล่นระดับเม็ดส้ม, Immortal และ Glorious Ruler (ตามหมายเหตุท้ายภาพของเอกสารต้นทาง)',
      patch: null,
      reliability: 'interview-based',
      rankSemantics: {
        star: markSemantics.star.meaning,
        starSource: markSemantics.star.source,
        skull: markSemantics.skull.meaning,
        skullSource: markSemantics.skull.source ?? null,
      },
      rightsStatus: 'unconfirmed',
    },
    roster: {
      title: 'รายชื่อฮีโร่ ROV META (แพตช์ 1.64)',
      url: 'https://rovmeta.com/th/heroes',
      checkedAt: roster.source?.checkedAt ?? null,
      reliability: 'community-site-unofficial',
    },
  },
};

// ---------- ข้อมูลเสริมจากอินเทอร์เน็ต (แหล่งที่ 2 และ 3) ----------
const aliases = { richter: 'riktor', 'flowborn (mage)': 'flowborn', 'flowborn (marksman)': 'flowborn' };
const idOf = (name) => {
  const k = name.toLowerCase();
  if (aliases[k]) return aliases[k];
  return roster.heroes.find((h) => h.nameEn.toLowerCase() === k)?.id ?? null;
};

// ROV META: แพ้ทาง / ชนะทาง / เล่นคู่กัน (ไม่ระบุเลน)
const rovmetaPath = join(ds, 'researched/rovmeta/heroes-2026-10-22.v2.json');
const rovmeta = existsSync(rovmetaPath) ? rd(rovmetaPath) : null;
const rovmetaOut = {};
for (const h of rovmeta?.heroes ?? []) {
  rovmetaOut[h.id] = {
    weakAgainst: h.weakAgainst,
    strongAgainst: h.strongAgainst,
    bestSynergy: h.bestSynergy,
    tier: h.tier,
    lane: h.lane,
    difficulty: h.difficulty,
    rates: { win: h.proWinRate, pick: h.proPickRate, ban: h.proBanRate },
    build: h.build,
    runes: h.runes,
    spell: h.summonerSpell[0] ?? null,
    skillPriority: h.skillPriority,
  };
}

// golfdesu/rov: คำนวณ "หยิบในทีมเดียวกัน" จากดราฟต์ลีกอาชีพปี 2026 เอง (ไม่ใช้ synergy_matrix ที่ไม่ระบุวิธีคำนวณ)
const draftsPath = join(ds, 'researched/golfdesu-rov/matches_draft_full.json');
const COPICK_YEAR = '2026';
const MIN_N = 15; // ต้องถูกเลือกอย่างน้อย 15 ครั้งจึงคำนวณคู่
const MIN_CO = 5; // ต้องอยู่ทีมเดียวกันอย่างน้อย 5 เกม
const MIN_LIFT = 1.2; // หยิบคู่กันบ่อยกว่าค่าเฉลี่ยอย่างน้อย 20% (ตัดผลจากฮีโร่ที่นิยมทั่วไป)
let copick = null;
if (existsSync(draftsPath)) {
  const games = rd(draftsPath).filter((g) => g.year === COPICK_YEAR);
  const n = new Map();
  const co = new Map();
  let teamGames = 0;
  const unmatched = new Set();
  for (const g of games) {
    for (const side of ['blue_picks', 'red_picks']) {
      const ids = [...new Set((g[side] ?? []).map((x) => idOf(x) ?? (unmatched.add(x), null)).filter(Boolean))];
      if (!ids.length) continue;
      teamGames++;
      for (const a of ids) {
        n.set(a, (n.get(a) ?? 0) + 1);
        for (const b of ids) if (a !== b) co.set(`${a}|${b}`, (co.get(`${a}|${b}`) ?? 0) + 1);
      }
    }
  }
  if (unmatched.size) throw new Error('ชื่อฮีโร่ในข้อมูลดราฟต์ที่จับคู่ไม่ได้: ' + [...unmatched].join(', '));
  const heroesCo = {};
  for (const [a, na] of n) {
    if (na < MIN_N) continue;
    const partners = [];
    for (const [b, nb] of n) {
      const c = co.get(`${a}|${b}`) ?? 0;
      if (a === b || c < MIN_CO) continue;
      const rate = c / na;
      const lift = rate / (nb / teamGames);
      if (lift >= MIN_LIFT) partners.push({ id: b, together: c, rate: Math.round(rate * 1000) / 10, lift: Math.round(lift * 100) / 100 });
    }
    partners.sort((x, y) => y.rate - x.rate || y.together - x.together);
    heroesCo[a] = { picks: na, partners: partners.slice(0, 8) };
  }
  copick = {
    games: games.length,
    teamGames,
    year: COPICK_YEAR,
    leagues: [...new Set(games.map((g) => g.league))].sort(),
    rules: { minPicks: MIN_N, minTogether: MIN_CO, minLift: MIN_LIFT },
    heroes: heroesCo,
  };
}

// ---------- สถิติลีกอาชีพที่คำนวณเองจากข้อมูลดราฟต์ดิบ (ตรวจย้อนได้ทุกตัวเลข) ----------
let prostats = null;
if (existsSync(draftsPath)) {
  const games = rd(draftsPath).filter((g) => g.year === COPICK_YEAR);
  const st = {};
  const get = (id) => (st[id] ??= { picks: 0, wins: 0, bans: 0 });
  for (const g of games) {
    for (const [side, win] of [['blue', g.blue_win === 1], ['red', g.blue_win === 0]]) {
      for (const n of g[side + '_picks'] ?? []) {
        const id = idOf(n);
        if (!id) continue;
        get(id).picks++;
        if (win) get(id).wins++;
      }
      for (const n of g[side + '_bans'] ?? []) {
        const id = idOf(n);
        if (id) get(id).bans++;
      }
    }
  }
  const total = games.length;
  const heroesPs = {};
  for (const [id, v] of Object.entries(st)) {
    heroesPs[id] = {
      picks: v.picks,
      wins: v.wins,
      bans: v.bans,
      winRate: v.picks ? Math.round((v.wins / v.picks) * 1000) / 10 : null,
      pickRate: Math.round((v.picks / total) * 1000) / 10,
      banRate: Math.round((v.bans / total) * 1000) / 10,
      presence: Math.round(((v.picks + v.bans) / total) * 1000) / 10,
    };
  }
  prostats = { games: total, year: COPICK_YEAR, leagues: [...new Set(games.map((g) => g.league))].sort(), minPicksForWinRate: 20, heroes: heroesPs };
}

// ---------- เจอกัน (head-to-head) และหยิบตอบ จากดราฟต์ลีกอาชีพปี 2026 ----------
const H2H_MIN = 25; // ต้องเจอกันอย่างน้อย 25 เกมจึงนับ
const AFTER_MIN = 15; // ต้องถูกหยิบอย่างน้อย 15 ครั้งจึงสรุป "หยิบตอบ"
// ลำดับหยิบรวมของทั้งสองฝั่ง (ตรงกับ src/lib/draft.ts): ฟ้า1 แดง1-2 ฟ้า2-3 แดง3 แดง4 ฟ้า4-5 แดง5
const PICK_SEQ = ['b0', 'r0', 'r1', 'b1', 'b2', 'r2', 'r3', 'b3', 'b4', 'r4'];
const wilson = (k, n, z = 1.96) => {
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const m = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [c - m, c + m];
};
let matchups = null;
let afterPick = null;
if (existsSync(draftsPath)) {
  const games = rd(draftsPath).filter((g) => g.year === COPICK_YEAR);
  const h2h = new Map();
  const own = new Map(); // `${x}|${y}` = ทีมหยิบ x แล้วหยิบ y เป็นตัวถัดไปของทีมเดียวกัน
  const reply = new Map(); // `${x}|${y}` = ทีมหนึ่งหยิบ x แล้วอีกทีมหยิบ y เป็นตัวถัดไป
  const cnt = new Map();
  const bump = (m, k) => m.set(k, (m.get(k) ?? 0) + 1);
  for (const g of games) {
    const blue = (g.blue_picks ?? []).map(idOf);
    const red = (g.red_picks ?? []).map(idOf);
    for (const [mine, theirs, won] of [[blue, red, g.blue_win === 1], [red, blue, g.blue_win === 0]]) {
      for (const a of mine) for (const b of theirs) {
        if (!a || !b) continue;
        const v = h2h.get(`${a}|${b}`) ?? [0, 0];
        v[0]++;
        if (won) v[1]++;
        h2h.set(`${a}|${b}`, v);
      }
    }
    if (blue.length === 5 && red.length === 5 && blue.every(Boolean) && red.every(Boolean)) {
      const seq = PICK_SEQ.map((t) => ({ team: t[0], id: (t[0] === 'b' ? blue : red)[Number(t[1])] }));
      seq.forEach((cur, i) => {
        bump(cnt, cur.id);
        const sameNext = seq.slice(i + 1).find((x) => x.team === cur.team);
        const otherNext = seq.slice(i + 1).find((x) => x.team !== cur.team);
        if (sameNext) bump(own, `${cur.id}|${sameNext.id}`);
        if (otherNext) bump(reply, `${cur.id}|${otherNext.id}`);
      });
    }
  }
  matchups = { minGames: H2H_MIN, year: COPICK_YEAR, heroes: {} };
  for (const [key, [n, w]] of h2h) {
    if (n < H2H_MIN) continue;
    const [a, b] = key.split('|');
    const [lb, ub] = wilson(w, n);
    const e = (matchups.heroes[a] ??= { beats: [], loses: [] });
    const rec = { id: b, n, win: Math.round((w / n) * 1000) / 10, lb: Math.round(lb * 1000) / 10, ub: Math.round(ub * 1000) / 10 };
    if (lb > 0.5) e.beats.push(rec);
    else if (ub < 0.5) e.loses.push(rec);
  }
  for (const e of Object.values(matchups.heroes)) {
    e.beats = e.beats.sort((x, y) => y.lb - x.lb).slice(0, 8);
    e.loses = e.loses.sort((x, y) => x.ub - y.ub).slice(0, 8);
  }
  const top = (m, x) =>
    [...m]
      .filter(([k]) => k.startsWith(x + '|'))
      .map(([k, c]) => ({ id: k.split('|')[1], n: c, rate: Math.round((c / cnt.get(x)) * 1000) / 10 }))
      .sort((p, q) => q.n - p.n || p.id.localeCompare(q.id))
      .slice(0, 5);
  afterPick = { minPicks: AFTER_MIN, year: COPICK_YEAR, order: PICK_SEQ.join(' '), heroes: {} };
  for (const [x, n] of cnt) {
    if (n < AFTER_MIN) continue;
    afterPick.heroes[x] = { picks: n, own: top(own, x), reply: top(reply, x) };
  }
}

// ---------- เทียร์ลิสต์จากบทความอื่น (ข้อมูลประกอบ) ----------
const tierSources = [];
for (const [key, path] of [
  ['zathong', 'researched/zathong/tiers-2026-10-22.json'],
  ['commonsensegamer', 'researched/commonsensegamer/tiers-2026-10-22.json'],
]) {
  const f = join(ds, path);
  if (!existsSync(f)) continue;
  const d = rd(f);
  tierSources.push({ key, title: d.source, url: d.url, pageDate: d.pageDate, retrievedAt: d.retrievedAt, method: d.method, reliability: d.reliability, scale: d.scale, tiers: d.tiers });
}

const insights = {
  sources: {
    rovmeta: {
      title: 'ROV META (rovmeta.com)',
      url: 'https://rovmeta.com/heroes',
      fetchedAt: rovmeta?.fetchedAt ?? null,
      patch: '1.64',
      reliability: 'community-aggregator (เว็บแฟนอิสระ รวบรวมจาก tier list หลายเว็บและสถิติลีกอาชีพ, คำบรรยายเขียนด้วยเครื่อง)',
      lanes: false,
    },
    prostats: {
      title: 'สถิติลีกอาชีพปี 2026 (คำนวณเองจากข้อมูลดราฟต์ golfdesu/rov)',
      url: 'https://github.com/golfdesu/rov',
      fetchedAt: '2026-10-22',
      reliability: 'computed-from-raw-records — นับจากรายการหยิบ/แบน/ผลแพ้ชนะของทุกเกม ตรวจย้อนได้ แต่ข้อมูลต้นทางเป็นโปรเจกต์ส่วนบุคคล',
    },
    copick: {
      title: 'สถิติดราฟต์ลีกอาชีพ (golfdesu/rov บน GitHub)',
      url: 'https://github.com/golfdesu/rov',
      fetchedAt: '2026-10-22',
      reliability: 'third-party-dataset (โปรเจกต์ส่วนบุคคล ไม่ระบุสัญญาอนุญาต) — คำนวณเองจากรายการหยิบของแต่ละทีม',
      note: 'ข้อมูลระบุฮีโร่ที่ทีมหยิบในเกม แต่ไม่ระบุลำดับการหยิบ จึงบอกได้เพียง "มักอยู่ทีมเดียวกัน" ไม่ใช่ "หยิบต่อจาก"',
    },
  },
  rovmeta: rovmetaOut,
  copick,
  prostats,
  matchups,
  afterPick,
  tierSources,
};

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'insights.json'), JSON.stringify(insights) + '\n');
writeFileSync(join(out, 'heroes.json'), JSON.stringify(heroes, null, 1) + '\n');
writeFileSync(join(out, 'counters.json'), JSON.stringify(rows) + '\n');
writeFileSync(join(out, 'meta.json'), JSON.stringify(meta, null, 1) + '\n');
console.log(`heroes=${heroes.length} rows=${rows.length} withData=${meta.counts.heroesWithEnemyData}`);
console.log('identity cells:', identityCounts);
