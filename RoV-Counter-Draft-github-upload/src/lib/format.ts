import type { Hero, IdentityStatus, Mark } from './types';

export function heroName(h: Hero | undefined, fallbackId = ''): string {
  if (!h) return fallbackId;
  return h.nameTh ? `${h.nameTh} (${h.nameEn})` : h.nameEn;
}

export const IDENTITY_LABEL: Record<IdentityStatus, string> = {
  'human-confirmed': 'ตัวตนฮีโร่: มนุษย์ยืนยันแล้ว',
  'system-verified': 'ตัวตนฮีโร่: ระบบจับคู่ภาพยืนยัน (ยังไม่ผ่านมนุษย์)',
  unverified: 'ตัวตนฮีโร่: ยังไม่ยืนยัน (unverified)',
  unreadable: 'ตัวตนฮีโร่: อ่านจากภาพไม่ได้',
  conflict: 'ตัวตนฮีโร่: ขัดแย้ง รอตรวจ',
};

export const IDENTITY_SHORT: Record<IdentityStatus, string> = {
  'human-confirmed': 'มนุษย์ยืนยัน',
  'system-verified': 'ระบบยืนยัน',
  unverified: 'ยังไม่ยืนยัน',
  unreadable: 'อ่านไม่ได้',
  conflict: 'ขัดแย้ง',
};

/** ข้อความของดาว (ระดับแก้ทาง) / หัวกะโหลก (ระดับห้ามเลือก) */
export function markText(m: Mark): string {
  return m.symbol === 'star' ? `ดาว ${m.count}` : `หัวกะโหลก ${m.count}`;
}
export function markGlyph(m: Mark): string {
  return (m.symbol === 'star' ? '★' : '☠').repeat(m.count);
}

/** ชื่อบทบาทภาษาไทยแบบที่ผู้เล่นไทยใช้ (Warrior = ไฟท์เตอร์, Marksman = แครี่) */
export const ROLE_TH: Record<string, string> = {
  Tank: 'แทงค์',
  Warrior: 'ไฟท์เตอร์',
  Assassin: 'อัสซาซิน',
  Mage: 'เมจ',
  Support: 'ซัพพอร์ต',
  Marksman: 'แครี่',
};
export const roleTh = (role: string | null | undefined) => (role ? (ROLE_TH[role] ?? role) : 'ไม่ทราบบทบาท');

export const TIER_ORDER = ['S+', 'S', 'A', 'B', 'C'] as const;
export const TIER_RANK: Record<string, number> = { 'S+': 5, S: 4, A: 3, B: 2, C: 1 };

/** ลิงก์หน้าฮีโร่บน ROV META (ภาษาไทย) */
export const rovmetaUrl = (id: string) => `https://rovmeta.com/th/heroes/${id}`;
