import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { dataset, insights } from './lib/data';
import type { LaneId } from './lib/types';
import { STORAGE_KEY } from './lib/storage';

beforeEach(() => localStorage.clear());

type User = ReturnType<typeof userEvent.setup>;

// เลือกศัตรูที่มีข้อมูลเลนเดียวจริงจากข้อมูลโปรเจกต์ (ไม่ hardcode ชื่อ เพื่อไม่ผูกกับข้อมูลที่อาจอัปเดต)
function singleLaneHeroByLane(): Record<LaneId, string> {
  const out = {} as Record<LaneId, string>;
  for (const h of dataset.heroes) {
    if (h.enemyLanes.length === 1 && !out[h.enemyLanes[0]]) out[h.enemyLanes[0]] = h.id;
  }
  return out;
}
const slotButton = (n: number) => screen.getByRole('button', { name: new RegExp(`^ศัตรูตัวที่ ${n}:`) });
const laneRadio = (n: number, lane: string) =>
  screen.getByRole('radio', { name: new RegExp(`^ศัตรูตัวที่ ${n} เลน ${lane}`) });

async function pick(user: User, n: number, heroId: string) {
  const b = slotButton(n);
  if (b.getAttribute('aria-pressed') !== 'true') await user.click(b);
  await user.click(screen.getByTestId(`hero-tile-${heroId}`));
}

describe('App', () => {
  it('เริ่มต้น: เปิดรายชื่อให้ช่องที่ 1 แสดงคำเตือนข้อมูล และยังไม่มีคำแนะนำ', () => {
    render(<App />);
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(/ไม่ใช่สถิติ/);
    expect(screen.getByRole('note')).toHaveTextContent(/หัวกะโหลก 3 อัน = ห้ามเลือกมากที่สุด/);
    expect(screen.getByRole('region', { name: 'เลือกฮีโร่สำหรับศัตรูตัวที่ 1' })).toBeInTheDocument();
    expect(screen.queryByTestId('lane-result-jungle')).not.toBeInTheDocument();
    expect(screen.getByText(/เลือกแล้ว 0\/5/)).toBeInTheDocument();
  });

  it('เลือกศัตรู 5 ตัวแล้วแสดงทีมแนะนำทั้ง 5 เลน ไม่มีฮีโร่ซ้ำ และแยกคะแนนชัดเจน', async () => {
    const user = userEvent.setup();
    render(<App />);
    const byLane = singleLaneHeroByLane();
    const lanes = Object.keys(byLane) as LaneId[];
    expect(lanes).toHaveLength(5);
    for (let i = 0; i < 5; i++) await pick(user, i + 1, byLane[lanes[i]]);
    expect(screen.getByText(/เลือกแล้ว 5\/5 · กำหนดเลนแล้ว 5\/5/)).toBeInTheDocument();
    for (const l of lanes) expect(screen.getByTestId(`lane-result-${l}`)).toBeInTheDocument();
    const picks = lanes.map((l) => screen.queryByTestId(`pick-${l}`)?.textContent).filter((x): x is string => !!x);
    expect(picks.length).toBeGreaterThan(0);
    expect(new Set(picks).size).toBe(picks.length);
    expect(screen.getByTestId('score-counter')).toHaveTextContent(/ไม่ใช่โอกาสชนะ/);
    expect(screen.getByTestId('score-balance')).toHaveTextContent(/heuristic/);
    expect(screen.getByTestId('score-meta')).toHaveTextContent(/เทียร์ ROV META/); // เทียร์มาจากแหล่งภายนอก ไม่ได้คำนวณเอง
    expect(screen.getByTestId('score-meta')).toHaveTextContent(/ไม่ใช่โอกาสชนะ/);
    const withPick = lanes.find((l) => screen.queryByTestId(`pick-${l}`))!;
    const card = screen.getByTestId(`lane-result-${withPick}`);
    expect(card.querySelector('.trust')).not.toBeNull();
    expect(within(card).getByText('หลักฐานการแก้ทาง')).toBeInTheDocument();
    // ทุกช่องเต็มแล้ว ตัวเลือกฮีโร่ปิดเอง
    expect(screen.queryByRole('region', { name: /เลือกฮีโร่สำหรับศัตรูตัวที่/ })).not.toBeInTheDocument();
  });

  it('ป้องกันเลือกฮีโร่ศัตรูซ้ำ: ไทล์ของฮีโร่ที่เลือกแล้วถูกปิดในช่องอื่น', async () => {
    const user = userEvent.setup();
    render(<App />);
    const id = singleLaneHeroByLane()['midlane'];
    await pick(user, 1, id);
    // ระบบเลื่อนไปช่อง 2 ให้อัตโนมัติ
    expect(screen.getByRole('region', { name: 'เลือกฮีโร่สำหรับศัตรูตัวที่ 2' })).toBeInTheDocument();
    expect(screen.getByTestId(`hero-tile-${id}`)).toBeDisabled();
    expect(screen.getByTestId(`hero-tile-${id}`)).toHaveTextContent('เลือกแล้ว');
  });

  it('ตั้งเลนอัตโนมัติสำหรับฮีโร่ที่มีข้อมูลเลนเดียว และไม่ให้สองตัวใช้เลนเดียวกัน', async () => {
    const user = userEvent.setup();
    render(<App />);
    const mids = dataset.heroes.filter((h) => h.enemyLanes.length === 1 && h.enemyLanes[0] === 'midlane').slice(0, 2);
    await pick(user, 1, mids[0].id);
    // เลนถูกตั้งอัตโนมัติและปุ่มเลนถูกพับไว้ เปิดดูได้ด้วยปุ่ม "เปลี่ยนเลน"
    expect(screen.getByTestId('enemy-slot-1')).toHaveTextContent('Midlane');
    await user.click(screen.getByRole('button', { name: 'ศัตรูตัวที่ 1: เปลี่ยนเลน' }));
    expect(laneRadio(1, 'Midlane')).toBeChecked();
    await pick(user, 2, mids[1].id);
    expect(laneRadio(2, 'Midlane')).toBeDisabled();
    expect(laneRadio(2, 'Midlane')).not.toBeChecked();
    expect(screen.getByText(/กรุณาเลือกเลนในช่องนี้/)).toBeInTheDocument();
  });

  it('ฮีโร่ที่ไม่มีข้อมูลแก้ทางแสดงสถานะข้อมูลไม่พอ ไม่สร้างคำแนะนำ', async () => {
    const user = userEvent.setup();
    render(<App />);
    const none = dataset.heroes.find((h) => h.enemyLanes.length === 0)!;
    await pick(user, 1, none.id);
    expect(screen.getByText('เอกสารไม่มีข้อมูลแก้ทางของฮีโร่นี้')).toBeInTheDocument();
    // ระบบอาจตั้งเลนตาม ROV META ให้แล้ว: เปิดปุ่มเลนก่อนเปลี่ยนเป็น Jungle
    const change = screen.queryByRole('button', { name: 'ศัตรูตัวที่ 1: เปลี่ยนเลน' });
    if (change) await user.click(change);
    await user.click(laneRadio(1, 'Jungle'));
    const card = screen.getByTestId('lane-result-jungle');
    expect(card).toHaveTextContent(/ข้อมูลไม่เพียงพอ/);
    expect(screen.queryByTestId('pick-jungle')).not.toBeInTheDocument();
    expect(screen.getByTestId('limits')).toHaveTextContent(/ข้อมูลไม่เพียงพอ/);
  });

  it('ล้างทั้งหมดต้องยืนยันก่อน และยกเลิกได้', async () => {
    const user = userEvent.setup();
    render(<App />);
    const byLane = singleLaneHeroByLane();
    await pick(user, 1, byLane['roaming']);
    await pick(user, 2, byLane['jungle']);
    await user.click(screen.getByRole('button', { name: /ล้างทั้งหมด/ }));
    await user.click(screen.getByRole('button', { name: 'ยกเลิก' }));
    expect(screen.getByText(/เลือกแล้ว 2\/5/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /ล้างทั้งหมด/ }));
    await user.click(screen.getByRole('button', { name: 'ยืนยันล้าง' }));
    expect(screen.getByText(/เลือกแล้ว 0\/5/)).toBeInTheDocument();
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText(/ล้างการเลือกทั้งหมดแล้ว/)).toBeInTheDocument();
  });

  it('นำฮีโร่ออกทีละช่องได้', async () => {
    const user = userEvent.setup();
    render(<App />);
    const id = singleLaneHeroByLane()['abyssal-dragon'];
    await pick(user, 1, id);
    await user.click(screen.getByRole('button', { name: 'ศัตรูตัวที่ 1: นำฮีโร่ออก' }));
    expect(slotButton(1)).toHaveAccessibleName('ศัตรูตัวที่ 1: เลือกฮีโร่');
    expect(screen.getByText(/เลือกแล้ว 0\/5/)).toBeInTheDocument();
  });

  it('ค้นหาและกรองรายชื่อได้ มี empty state เมื่อไม่พบ และ Esc ปิดรายชื่อ', async () => {
    const user = userEvent.setup();
    render(<App />);
    const search = () => screen.getByRole('searchbox', { name: 'ค้นหาฮีโร่' });
    const target = dataset.heroes.find((h) => h.enemyLanes.length > 0)!;
    await user.type(search(), target.nameEn);
    expect(screen.getByTestId(`hero-tile-${target.id}`)).toBeInTheDocument();
    await user.clear(search());
    await user.type(search(), 'zzzzqq');
    expect(screen.getByText('ไม่พบฮีโร่ที่ตรงกับคำค้นหรือตัวกรอง')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ล้างตัวกรอง' }));
    await user.click(screen.getByRole('button', { name: 'มีข้อมูลแก้ทาง' }));
    const noData = dataset.heroes.find((h) => h.enemyLanes.length === 0)!;
    expect(screen.queryByTestId(`hero-tile-${noData.id}`)).not.toBeInTheDocument();
    await user.click(search());
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: /เลือกฮีโร่สำหรับศัตรูตัวที่/ })).not.toBeInTheDocument();
  });

  it('สวิตช์ข้อมูลที่ยังไม่ยืนยันใช้งานได้โดยไม่ crash', async () => {
    const user = userEvent.setup();
    render(<App />);
    await pick(user, 1, singleLaneHeroByLane()['abyssal-dragon']);
    const toggle = screen.getByRole('checkbox', { name: /unverified/ });
    expect(toggle).toBeChecked();
    await user.click(toggle);
    expect(toggle).not.toBeChecked();
    expect(screen.getByTestId('lane-result-abyssal-dragon')).toBeInTheDocument();
  });

  it('บันทึกการเลือกในเบราว์เซอร์ และกู้คืนเมื่อเปิดใหม่', async () => {
    const user = userEvent.setup();
    const byLane = singleLaneHeroByLane();
    const first = render(<App />);
    await pick(user, 1, byLane['jungle']);
    await pick(user, 2, byLane['roaming']);
    await user.click(screen.getByRole('checkbox', { name: /unverified/ }));
    first.unmount();
    render(<App />);
    expect(screen.getByText(/เลือกแล้ว 2\/5 · กำหนดเลนแล้ว 2\/5/)).toBeInTheDocument();
    expect(screen.getByText(/กู้คืนการเลือกจากครั้งก่อนแล้ว/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /unverified/ })).not.toBeChecked();
    expect(screen.getByTestId('lane-result-jungle')).toBeInTheDocument();
    // ช่องว่างถัดไป (ช่อง 3) ถูกเปิดให้เลือกต่อ
    expect(screen.getByRole('region', { name: 'เลือกฮีโร่สำหรับศัตรูตัวที่ 3' })).toBeInTheDocument();
  });

  it('ล้างทั้งหมดแล้วลบข้อมูลที่บันทึกไว้', async () => {
    const user = userEvent.setup();
    render(<App />);
    await pick(user, 1, singleLaneHeroByLane()['midlane']);
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    await user.click(screen.getByRole('button', { name: /ล้างทั้งหมด/ }));
    await user.click(screen.getByRole('button', { name: 'ยืนยันล้าง' }));
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('ข้อมูลที่บันทึกเสียหรือผิดรูปแบบไม่ทำให้เว็บพัง', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    const a = render(<App />);
    expect(screen.getByText(/เลือกแล้ว 0\/5/)).toBeInTheDocument();
    a.unmount();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ enemies: [{ heroId: 'not-a-hero', lane: 'jungle' }], includeUnverified: 'x' }));
    render(<App />);
    expect(screen.getByText(/เลือกแล้ว 0\/5/)).toBeInTheDocument();
  });

  it('แสดงแผงอ่านดราฟต์ศัตรู (คอมโบ) เมื่อเลือกศัตรูที่มีข้อมูล', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.queryByTestId('enemy-read')).not.toBeInTheDocument();
    await pick(user, 1, 'airi');
    const panel = screen.getByTestId('enemy-read');
    expect(panel).toHaveTextContent('มักอยู่ทีมเดียวกัน');
    expect(panel).toHaveTextContent('ROV META');
    expect(panel).toHaveTextContent(/ไม่ใช่ความน่าจะเป็นในเกมแรงก์/);
    expect(panel.querySelectorAll('[data-testid^="likely-"]').length).toBeGreaterThan(0);
  });

  it('ตั้งเลนตาม ROV META เมื่อเอกสารหลักไม่มีข้อมูลของฮีโร่นั้น', async () => {
    const user = userEvent.setup();
    render(<App />);
    const h = dataset.heroes.find((x) => x.enemyLanes.length === 0 && insights.rovmeta[x.id]?.lane)!;
    await pick(user, 1, h.id);
    expect(screen.getByText(/เลนหลักตาม ROV META/)).toBeInTheDocument();
  });

  it('มุมมองเทียร์ลิสต์: แสดงเทียร์ กรองบทบาท และเปิดข้อมูลฮีโร่พร้อมลิงก์แหล่งที่มา', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'เทียร์ลิสต์ฮีโร่' }));
    expect(screen.getByRole('heading', { name: 'เทียร์ลิสต์ฮีโร่' })).toBeInTheDocument();
    await user.click(screen.getByTestId('tier-hero-airi'));
    const d = screen.getByTestId('hero-detail-airi');
    expect(d).toHaveTextContent('แพ้ทาง');
    expect(d).toHaveTextContent('บิลด์แนะนำ');
    expect(within(d).getByRole('link', { name: /ROV META/ })).toHaveAttribute('href', 'https://rovmeta.com/th/heroes/airi');
    await user.click(screen.getByRole('button', { name: 'แทงค์' }));
    expect(screen.queryByTestId('tier-hero-airi')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ดราฟต์แก้ทาง' }));
    expect(screen.getByText(/เลือกแล้ว 0\/5/)).toBeInTheDocument();
  });

  it('แบน/พิค BO3: เล่นครบเกม บันทึกผล ทีมแพ้เลือกฝั่ง และ Global Ban มีผลในเกม 2', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'แบน/พิค BO3·BO5' }));
    await user.click(screen.getByRole('button', { name: 'เริ่มซีรีส์ BO3' }));
    expect(screen.getByTestId('bp-turn')).toHaveTextContent(/แบนครั้งที่ 1/);
    expect(screen.getByTestId('bp-advice')).toHaveTextContent('แนะนำแบนให้ทีมเรา');
    // ข้ามการแบนครั้งแรกได้
    await user.click(screen.getByRole('button', { name: 'ข้ามการแบน' }));
    // เล่นต่อจนครบ 18 ขั้นด้วยฮีโร่ตัวแรกที่ยังเลือกได้
    for (let i = 1; i < 18; i++) {
      const tile = screen.getAllByTestId(/^bp-hero-/).find((b) => !(b as HTMLButtonElement).disabled)!;
      await user.click(tile);
    }
    expect(screen.getByTestId('bp-turn')).toHaveTextContent(/บันทึกผล/);
    const ourPicks = within(screen.getByTestId('bp-team-blue')).getAllByText(/./, { selector: '.bp-name' }).map((e) => e.textContent);
    expect(ourPicks).toHaveLength(5);
    await user.click(screen.getByRole('button', { name: 'ทีมเรา ชนะ' }));
    expect(screen.getByTestId('bp-score')).toHaveTextContent(/1\s*–\s*0/);
    // คู่แข่งแพ้ → เป็นผู้เลือกฝั่ง
    expect(screen.getByTestId('bp-side-pick')).toHaveTextContent('ทีมคู่แข่ง (แพ้) เลือกฝั่งเกม 2');
    await user.click(screen.getByRole('button', { name: 'ฝั่งฟ้า' }));
    expect(screen.getByTestId('bp-team-blue')).toHaveTextContent('ทีมคู่แข่ง');
    // เดิน 4 แบน + พิคแรกของคู่แข่ง แล้วถึงตาพิคของทีมเรา: ฮีโร่ที่เราใช้ในเกม 1 ต้องถูก Global Ban
    for (let i = 0; i < 4; i++) await user.click(screen.getByRole('button', { name: 'ข้ามการแบน' }));
    const t = screen.getAllByTestId(/^bp-hero-/).find((b) => !(b as HTMLButtonElement).disabled)!;
    await user.click(t);
    expect(screen.getByTestId('bp-turn')).toHaveTextContent(/ทีมเรา.*พิคตัวที่ 1/);
    expect(screen.getAllByRole('button', { name: /Global Ban/ }).length).toBe(5);
    expect(screen.getByTestId('bp-advice')).toHaveTextContent('แนะนำพิคให้ทีมเรา');
  });
});

