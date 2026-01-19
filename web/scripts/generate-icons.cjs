const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '../public/icons');

// 确保目录存在
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 创建简单的 SVG 图标 - 蓝色背景 + "TPP" 文字
function createSVG(size, isMaskable = false) {
  const padding = isMaskable ? size * 0.1 : 0;
  const innerSize = size - padding * 2;
  const fontSize = innerSize * 0.35;
  const subFontSize = innerSize * 0.12;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#2563eb"/>
  <text x="${size/2}" y="${size * 0.45}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="white" text-anchor="middle">TPP</text>
  <text x="${size/2}" y="${size * 0.68}" font-family="Arial, sans-serif" font-size="${subFontSize}" fill="rgba(255,255,255,0.9)" text-anchor="middle">税務記帳</text>
</svg>`;
}

// 需要生成的图标尺寸
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const maskableSizes = [192, 512];

async function generateIcons() {
  console.log('Generating PWA icons...');

  // 生成标准图标
  for (const size of sizes) {
    const svg = Buffer.from(createSVG(size));
    await sharp(svg)
      .png()
      .toFile(path.join(iconsDir, `icon-${size}.png`));
    console.log(`Created icon-${size}.png`);
  }

  // 生成 maskable 图标（带安全区）
  for (const size of maskableSizes) {
    const svg = Buffer.from(createSVG(size, true));
    await sharp(svg)
      .png()
      .toFile(path.join(iconsDir, `icon-maskable-${size}.png`));
    console.log(`Created icon-maskable-${size}.png`);
  }

  console.log('Done!');
}

generateIcons().catch(console.error);
