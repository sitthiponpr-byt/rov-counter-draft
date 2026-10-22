/// <reference types="vitest/config" />
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// ภาพฮีโร่ (public/hero-images) เป็นลิขสิทธิ์ Garena และยังไม่มีสิทธิ์เผยแพร่
// - npm run dev: แสดงภาพ (ใช้ในเครื่อง)
// - npm run build: ลบภาพออกจาก dist/ และเว็บจะใช้ตัวอักษรย่อแทน
//   ยกเว้นตั้ง HERO_IMAGES_LICENSED=1 หลังได้รับอนุญาตแล้วเท่านั้น
const LICENSED = process.env.HERO_IMAGES_LICENSED === '1';

function stripHeroImages(): Plugin {
  let outDir = 'dist';
  return {
    name: 'strip-hero-images',
    apply: 'build',
    configResolved(c) {
      outDir = resolve(c.root, c.build.outDir);
    },
    closeBundle() {
      if (!LICENSED) rmSync(resolve(outDir, 'hero-images'), { recursive: true, force: true });
    },
  };
}

// base path:
//  - ค่าเริ่มต้น './' (path แบบสัมพัทธ์ ใช้ได้ทั้งเปิดเองและบน GitHub Pages ไม่ว่าชื่อ repo อะไร)
//  - GitHub Actions ตั้ง VITE_BASE=/<ชื่อ repo>/ ให้อัตโนมัติ (ดู .github/workflows/deploy.yml)
export default defineConfig(({ command }) => ({
  base: process.env.VITE_BASE ?? './',
  plugins: [react(), stripHeroImages()],
  define: {
    __HERO_IMAGES__: JSON.stringify(command === 'serve' || LICENSED),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
}));
