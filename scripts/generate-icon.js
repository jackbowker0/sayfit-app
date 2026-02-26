// Generate SayFit app icon — dumbbell on dark background
// Run: node scripts/generate-icon.js

const { createCanvas } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

const SIZE = 1024;
const canvas = createCanvas(SIZE, SIZE);
const ctx = canvas.getContext('2d');

// ─── Background ─────────────────────────────────────────────
ctx.fillStyle = '#0A0A0F';
ctx.fillRect(0, 0, SIZE, SIZE);

// Subtle radial glow behind dumbbell
const glow = ctx.createRadialGradient(SIZE / 2, SIZE / 2, 50, SIZE / 2, SIZE / 2, 400);
glow.addColorStop(0, 'rgba(99, 102, 241, 0.12)');
glow.addColorStop(0.5, 'rgba(99, 102, 241, 0.04)');
glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
ctx.fillStyle = glow;
ctx.fillRect(0, 0, SIZE, SIZE);

// ─── Dumbbell ───────────────────────────────────────────────
const cx = SIZE / 2;
const cy = SIZE / 2;

// Colors
const primaryColor = '#6366F1'; // Indigo
const accentColor = '#818CF8';  // Lighter indigo
const highlightColor = '#A5B4FC'; // Even lighter

// Bar (center handle)
const barWidth = 280;
const barHeight = 48;
const barRadius = 24;
ctx.fillStyle = accentColor;
roundRect(ctx, cx - barWidth / 2, cy - barHeight / 2, barWidth, barHeight, barRadius);
ctx.fill();

// Bar highlight
const barGrad = ctx.createLinearGradient(cx - barWidth / 2, cy - barHeight / 2, cx - barWidth / 2, cy + barHeight / 2);
barGrad.addColorStop(0, highlightColor);
barGrad.addColorStop(1, primaryColor);
ctx.fillStyle = barGrad;
roundRect(ctx, cx - barWidth / 2, cy - barHeight / 2, barWidth, barHeight, barRadius);
ctx.fill();

// Inner weight plates (closer to center)
const innerPlateW = 70;
const innerPlateH = 220;
const innerPlateR = 20;
const innerOffset = 160;

// Left inner plate
drawPlate(ctx, cx - innerOffset - innerPlateW / 2, cy, innerPlateW, innerPlateH, innerPlateR, primaryColor, accentColor);
// Right inner plate
drawPlate(ctx, cx + innerOffset - innerPlateW / 2, cy, innerPlateW, innerPlateH, innerPlateR, primaryColor, accentColor);

// Outer weight plates (bigger)
const outerPlateW = 70;
const outerPlateH = 300;
const outerPlateR = 20;
const outerOffset = 240;

// Left outer plate
drawPlate(ctx, cx - outerOffset - outerPlateW / 2, cy, outerPlateW, outerPlateH, outerPlateR, primaryColor, highlightColor);
// Right outer plate
drawPlate(ctx, cx + outerOffset - outerPlateW / 2, cy, outerPlateW, outerPlateH, outerPlateR, primaryColor, highlightColor);

// End caps
const capW = 30;
const capH = 100;
const capR = 10;
const capOffset = 310;

drawPlate(ctx, cx - capOffset - capW / 2, cy, capW, capH, capR, accentColor, highlightColor);
drawPlate(ctx, cx + capOffset - capW / 2, cy, capW, capH, capR, accentColor, highlightColor);

// Glow effect on dumbbell
ctx.shadowColor = primaryColor;
ctx.shadowBlur = 60;
ctx.shadowOffsetX = 0;
ctx.shadowOffsetY = 0;

// ─── "S" text below ─────────────────────────────────────────
ctx.shadowBlur = 0;
ctx.font = 'bold 120px sans-serif';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';

// Text glow
ctx.shadowColor = primaryColor;
ctx.shadowBlur = 30;
ctx.fillStyle = highlightColor;
ctx.fillText('SAYFIT', cx, cy + 230);

// Text again without shadow for crisp text
ctx.shadowBlur = 0;
ctx.fillStyle = highlightColor;
ctx.fillText('SAYFIT', cx, cy + 230);

// ─── Save ───────────────────────────────────────────────────
const assetsDir = path.join(__dirname, '..', 'assets');
const buffer = canvas.toBuffer('image/png');

fs.writeFileSync(path.join(assetsDir, 'icon.png'), buffer);
fs.writeFileSync(path.join(assetsDir, 'adaptive-icon.png'), buffer);

// Splash icon (same but maybe we want it without the text for splash)
fs.writeFileSync(path.join(assetsDir, 'splash-icon.png'), buffer);

console.log('Icons generated: icon.png, adaptive-icon.png, splash-icon.png');

// ─── Helpers ────────────────────────────────────────────────

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawPlate(ctx, x, cy, w, h, r, baseColor, topColor) {
  const grad = ctx.createLinearGradient(x, cy - h / 2, x, cy + h / 2);
  grad.addColorStop(0, topColor);
  grad.addColorStop(0.5, baseColor);
  grad.addColorStop(1, topColor);
  ctx.fillStyle = grad;
  roundRect(ctx, x, cy - h / 2, w, h, r);
  ctx.fill();

  // Subtle border
  ctx.strokeStyle = topColor + '40';
  ctx.lineWidth = 2;
  roundRect(ctx, x, cy - h / 2, w, h, r);
  ctx.stroke();
}
