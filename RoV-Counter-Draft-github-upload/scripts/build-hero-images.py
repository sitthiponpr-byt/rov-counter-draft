"""สร้างภาพฮีโร่ขนาดเล็กสำหรับแสดงในเว็บ **เฉพาะในเครื่อง** (public/hero-images/, ถูก .gitignore)

ที่มา: data-source/reference-icons/portrait_<id>.* (ภาพจากหน้าฮีโร่ของ rovmeta.com, ลิขสิทธิ์ Garena/TiMi/Tencent)
ภาพเหล่านี้ยังไม่มีสิทธิ์เผยแพร่: `npm run build` จะลบโฟลเดอร์ hero-images ออกจาก dist/ อัตโนมัติ
เว้นแต่ตั้ง HERO_IMAGES_LICENSED=1 หลังได้รับอนุญาตแล้วเท่านั้น

ใช้: python scripts/build-hero-images.py   (ต้องมี Pillow)
"""
import glob, os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'data-source', 'reference-icons')
OUT = os.path.join(ROOT, 'public', 'hero-images')
SIZE = 128
SKIP = {'flowborn'}  # ภาพต้นทางเป็นภาพบทความที่มีตัวละครอื่นปน ไม่ใช่ภาพฮีโร่ตัวเดียว

if not os.path.isdir(SRC):
    sys.exit('ไม่พบ data-source/reference-icons — ข้ามการสร้างภาพ (เว็บจะใช้ตัวอักษรย่อแทน)')
os.makedirs(OUT, exist_ok=True)
done, skipped = 0, []
for f in sorted(glob.glob(os.path.join(SRC, 'portrait_*'))):
    hid = os.path.splitext(os.path.basename(f))[0][len('portrait_'):]
    if hid in SKIP:
        skipped.append(hid)
        continue
    im = Image.open(f).convert('RGB')
    w, h = im.size
    s = min(w, h)
    im = im.crop(((w - s) // 2, 0 if h > w else (h - s) // 2, (w - s) // 2 + s, (0 if h > w else (h - s) // 2) + s))
    im.resize((SIZE, SIZE), Image.LANCZOS).save(os.path.join(OUT, f'{hid}.webp'), 'WEBP', quality=80)
    done += 1
print(f'สร้างภาพ {done} ไฟล์ใน public/hero-images/ (ข้าม: {", ".join(skipped) or "-"})')
