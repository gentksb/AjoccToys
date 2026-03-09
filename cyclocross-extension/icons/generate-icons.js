// アイコン生成スクリプト (sharp 使用)
// 使い方: node generate-icons.js
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const svgPath = path.join(__dirname, "icon.svg");
const svg = fs.readFileSync(svgPath);

const sizes = [16, 48, 128];

Promise.all(
  sizes.map((size) => {
    const outPath = path.join(__dirname, `icon${size}.png`);
    return sharp(svg)
      .resize(size, size)
      .png()
      .toFile(outPath)
      .then(() => console.log(`✓ icon${size}.png を生成しました`))
      .catch((err) => console.error(`✗ icon${size}.png 失敗:`, err.message));
  })
);
