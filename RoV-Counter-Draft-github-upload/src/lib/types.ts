export const LANES = ['dark-slayer', 'jungle', 'midlane', 'abyssal-dragon', 'roaming'] as const;
export type LaneId = (typeof LANES)[number];

export const LANE_LABEL: Record<LaneId, string> = {
  'dark-slayer': 'Dark Slayer',
  jungle: 'Jungle',
  midlane: 'Midlane',
  'abyssal-dragon': 'Abyssal Dragon',
  roaming: 'Roaming',
};

/** สถานะการระบุตัวตนฮีโร่ในช่อง (hero_identity_confidence) */
export type IdentityStatus = 'human-confirmed' | 'system-verified' | 'unverified' | 'unreadable' | 'conflict';

export interface Hero {
  id: string;
  nameEn: string;
  nameTh: string | null;
  role: string | null;
  enemyLanes: LaneId[];
}

/** ข้อมูลดิบจากเอกสารต้นทาง: จำนวนดาว/หัวกะโหลกที่แสดง ความหมายยังไม่ทราบ */
export interface Mark {
  symbol: 'star' | 'skull';
  count: number;
}

export interface SlotHero {
  id: string | null;
  identity: { status: IdentityStatus };
}

export interface Slot {
  position: number;
  mark: Mark;
  heroes: SlotHero[];
}

export interface CounterRow {
  id: string;
  lane: LaneId;
  enemyId: string;
  enemyCaption: string;
  sourcePage: number;
  good: Slot[];
  avoid: Slot[];
}

export interface Meta {
  generatedAt: string;
  dataVersion: string;
  counts: {
    heroes: number;
    rows: number;
    heroesWithEnemyData: number;
    heroesWithoutEnemyData: number;
    identityCells: Record<string, number>;
  };
  sources: {
    counters: {
      title: string;
      credit: string;
      basis: string;
      patch: string | null;
      reliability: string;
      rankSemantics: { star: string; starSource: string; skull: string; skullSource: string | null };
      rightsStatus: string;
    };
    roster: { title: string; url: string; checkedAt: string | null; reliability: string };
  };
}

export interface Dataset {
  heroes: Hero[];
  rows: CounterRow[];
}

export interface CopickPartner {
  id: string;
  together: number;
  rate: number; // % ของเกมที่ฮีโร่หลักถูกหยิบ แล้วมีตัวนี้อยู่ทีมเดียวกัน
  lift: number;
}

export type Tier = 'S+' | 'S' | 'A' | 'B' | 'C';

/** ข้อมูลข้อเท็จจริงจากหน้าฮีโร่ของ ROV META (ไม่รวมคำบรรยายของเว็บนั้น) */
export interface RovmetaHero {
  weakAgainst: string[];
  strongAgainst: string[];
  bestSynergy: string[];
  tier?: Tier | null;
  lane?: LaneId | null;
  difficulty?: string | null;
  rates?: { win: number | null; pick: number | null; ban: number | null };
  build?: string[];
  runes?: string[];
  spell?: string | null;
  skillPriority?: string | null;
}

export interface Insights {
  sources: {
    rovmeta: { title: string; url: string; fetchedAt: string | null; patch: string; reliability: string; lanes: boolean };
    prostats?: { title: string; url: string; fetchedAt: string; reliability: string };
    copick: { title: string; url: string; fetchedAt: string; reliability: string; note: string };
  };
  rovmeta: Record<string, RovmetaHero>;
  copick: null | {
    games: number;
    teamGames: number;
    year: string;
    leagues: string[];
    rules: { minPicks: number; minTogether: number; minLift: number };
    heroes: Record<string, { picks: number; partners: CopickPartner[] }>;
  };
  prostats?: null | {
    games: number;
    year: string;
    leagues: string[];
    minPicksForWinRate: number;
    heroes: Record<string, ProStat>;
  };
  tierSources?: TierSource[];
  matchups?: null | { minGames: number; year: string; heroes: Record<string, { beats: MatchupRec[]; loses: MatchupRec[] }> };
  afterPick?: null | {
    minPicks: number;
    year: string;
    order: string;
    heroes: Record<string, { picks: number; own: AfterRec[]; reply: AfterRec[] }>;
  };
}

/** สถิติเจอกันในลีกอาชีพ: id = ฮีโร่ฝั่งตรงข้าม, win = % ที่ฮีโร่หลักชนะ, lb/ub = ช่วงเชื่อมั่น Wilson 95% */
export interface MatchupRec {
  id: string;
  n: number;
  win: number;
  lb: number;
  ub: number;
}

export interface AfterRec {
  id: string;
  n: number;
  rate: number;
}

export interface ProStat {
  picks: number;
  wins: number;
  bans: number;
  winRate: number | null;
  pickRate: number;
  banRate: number;
  presence: number;
}

export interface TierSource {
  key: string;
  title: string;
  url: string;
  pageDate: string;
  retrievedAt: string;
  method: string;
  reliability: string;
  scale: string[];
  tiers: Record<string, string>;
}
