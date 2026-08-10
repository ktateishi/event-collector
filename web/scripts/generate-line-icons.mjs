import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const OUT_DIR = new URL("../public/icons/", import.meta.url);
mkdirSync(OUT_DIR, { recursive: true });

const W = 800;
const H = 520;

function svg(bg, glyph) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${bg}" />
  <g transform="translate(400,260)" fill="none" stroke="#ffffff" stroke-width="14" stroke-linecap="round" stroke-linejoin="round">
    ${glyph}
  </g>
</svg>`;
}

const icons = {
  // 映画: カチンコ
  movie: svg(
    "#4f46e5",
    `
    <rect x="-140" y="-40" width="280" height="180" rx="16" fill="#ffffff" fill-opacity="0.15" />
    <g transform="translate(0,-100) rotate(-8)">
      <rect x="-150" y="-30" width="300" height="60" rx="10" fill="#ffffff" fill-opacity="0.9" stroke="none" />
      <line x1="-110" y1="-30" x2="-70" y2="30" />
      <line x1="-30" y1="-30" x2="10" y2="30" />
      <line x1="50" y1="-30" x2="90" y2="30" />
    </g>
    `
  ),
  // 展覧会: 額縁と絵
  exhibition: svg(
    "#7c3aed",
    `
    <rect x="-160" y="-120" width="320" height="240" rx="8" />
    <rect x="-124" y="-86" width="248" height="172" rx="4" fill="none" />
    <polyline points="-100,50 -30,-30 30,20 90,-50 124,20" />
    <circle cx="60" cy="-60" r="18" fill="#ffffff" stroke="none" />
    `
  ),
  // ゲーム: コントローラー
  game: svg(
    "#059669",
    `
    <path d="M -180 20
             C -180 -60 -120 -80 -60 -70
             L 60 -70
             C 120 -80 180 -60 180 20
             C 180 90 120 100 90 60
             L -90 60
             C -120 100 -180 90 -180 20 Z" fill="#ffffff" fill-opacity="0.9" stroke="none" />
    <line x1="-120" y1="-5" x2="-120" y2="35" stroke="#059669" stroke-width="12" />
    <line x1="-140" y1="15" x2="-100" y2="15" stroke="#059669" stroke-width="12" />
    <circle cx="90" cy="-10" r="12" fill="#059669" stroke="none" />
    <circle cx="130" cy="20" r="12" fill="#059669" stroke="none" />
    `
  ),
  // コンサート・放送: 音符
  concert: svg(
    "#e11d48",
    `
    <circle cx="-90" cy="90" r="42" fill="#ffffff" stroke="none" />
    <circle cx="90" cy="60" r="42" fill="#ffffff" stroke="none" />
    <line x1="-48" y1="90" x2="-48" y2="-120" stroke="#ffffff" stroke-width="16" />
    <line x1="132" y1="60" x2="132" y2="-90" stroke="#ffffff" stroke-width="16" />
    <path d="M -48 -120 C 0 -150 90 -140 132 -90" fill="none" stroke="#ffffff" stroke-width="16" />
    `
  ),
  // コラボ・グッズ: ギフトボックス
  collab: svg(
    "#d97706",
    `
    <rect x="-140" y="-60" width="280" height="180" rx="14" />
    <line x1="0" y1="-60" x2="0" y2="120" />
    <line x1="-140" y1="10" x2="140" y2="10" />
    <path d="M 0 -60 C -50 -60 -60 -120 -10 -120 C 20 -120 20 -80 0 -60 Z" fill="#ffffff" stroke="none" />
    <path d="M 0 -60 C 50 -60 60 -120 10 -120 C -20 -120 -20 -80 0 -60 Z" fill="#ffffff" stroke="none" />
    `
  ),
  // その他: カレンダー
  other: svg(
    "#475569",
    `
    <rect x="-150" y="-90" width="300" height="220" rx="16" fill="#ffffff" fill-opacity="0.9" stroke="none" />
    <rect x="-150" y="-90" width="300" height="60" rx="16" fill="#ffffff" stroke="none" />
    <line x1="-90" y1="-130" x2="-90" y2="-60" stroke="#475569" stroke-width="14" />
    <line x1="90" y1="-130" x2="90" y2="-60" stroke="#475569" stroke-width="14" />
    <circle cx="-70" cy="20" r="14" fill="#475569" stroke="none" />
    <circle cx="0" cy="20" r="14" fill="#475569" stroke="none" />
    <circle cx="70" cy="20" r="14" fill="#475569" stroke="none" />
    <circle cx="-70" cy="70" r="14" fill="#475569" stroke="none" />
    <circle cx="0" cy="70" r="14" fill="#475569" stroke="none" />
    `
  ),
};

for (const [name, markup] of Object.entries(icons)) {
  const outPath = fileURLToPath(new URL(`${name}.png`, OUT_DIR));
  await sharp(Buffer.from(markup)).png().toFile(outPath);
  console.log("wrote", outPath);
}
