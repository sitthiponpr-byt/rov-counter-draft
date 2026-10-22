// ตรวจ production build (dist/) ว่าไม่มีไฟล์/ข้อความที่ไม่ควรเผยแพร่ — รันอัตโนมัติหลัง `npm run build`
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
if (!existsSync(dist)) {
  console.error('ไม่พบ dist/ — รัน vite build ก่อน');
  process.exit(1);
}

const files = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    statSync(p).isDirectory() ? walk(p) : files.push(p);
  }
})(dist);

const problems = [];
const bannedExt = /\.(jpe?g|png|webp|gif|bmp|tiff?|avif|csv|xlsx?|zip|rar|7z|psd)$/i;
const bannedName = /(raw|reference|portrait|review|human-results|manifest|slots\.v2|hero-icons|infographic)/i;
const bannedText = [
  'data-source',
  'reference-icons',
  'portrait_',
  'review-tool',
  'human-results',
  'garenanow.com',
  'supabase.co',
  'rovmeta.com/heroes/',
  '_n.jpg',
  'C:\\\\Users',
  'D:\\\\RoV',
];

// ภาพฮีโร่จะผ่านได้เฉพาะเมื่อผู้ดูแลยืนยันสิทธิ์แล้ว (HERO_IMAGES_LICENSED=1)
const heroImagesLicensed = process.env.HERO_IMAGES_LICENSED === '1';

for (const f of files) {
  const rel = relative(dist, f).replace(/\\/g, '/');
  if (heroImagesLicensed && /^hero-images\/[a-z0-9-]+\.webp$/.test(rel)) continue;
  const size = statSync(f).size;
  if (bannedExt.test(rel)) problems.push(`ไฟล์ชนิดต้องห้ามใน dist: ${rel}`);
  if (bannedName.test(rel)) problems.push(`ชื่อไฟล์น่าสงสัยใน dist: ${rel}`);
  if (size > 2 * 1024 * 1024) problems.push(`ไฟล์ใหญ่ผิดปกติ (${(size / 1048576).toFixed(1)} MB): ${rel}`);
  if (/\.(html|js|css|json|txt|map|svg)$/i.test(rel)) {
    const text = readFileSync(f, 'utf8');
    for (const b of bannedText) if (text.includes(b)) problems.push(`พบข้อความต้องห้าม "${b}" ใน ${rel}`);
    if (/\.map$/i.test(rel)) problems.push(`พบ source map ใน dist: ${rel}`);
  }
}

if (problems.length) {
  console.error('❌ dist/ ไม่ผ่านการตรวจ:\n - ' + problems.join('\n - '));
  process.exit(1);
}
const total = files.reduce((s, f) => s + statSync(f).size, 0);
console.log(`✅ dist/ ผ่านการตรวจ: ${files.length} ไฟล์ (${(total / 1024).toFixed(0)} KB) ไม่มีภาพ/ไฟล์ต้นฉบับ/ข้อความต้องห้าม`);
for (const f of files) console.log('   ' + relative(dist, f).replace(/\\/g, '/') + `  ${(statSync(f).size / 1024).toFixed(1)} KB`);
