/* eslint-disable @typescript-eslint/no-require-imports */
const sharp = require('sharp');

async function processLogo() {
  console.log("Reading original generated logo...");
  const sourcePath = "/Users/aniketmishra/.gemini/antigravity/brain/7071c8b4-efe1-412a-93fb-c0ed2bd259f6/xreso_neon_logo_1776019998558.png";
  
  const { data, info } = await sharp(sourcePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixelArray = new Uint8Array(data.length);
  const channels = info.channels;
  
  // Background is approx R=26, G=26, B=46 (#1A1A2E)
  const bgR = 26;
  const bgG = 26;
  const bgB = 46;

  for (let i = 0; i < data.length; i += channels) {
    let r = data[i];
    let g = data[i+1];
    let b = data[i+2];

    // Distance from the background color
    let dist = Math.sqrt(Math.pow(r - bgR, 2) + Math.pow(g - bgG, 2) + Math.pow(b - bgB, 2));

    // Glow threshold
    // If distance is small (close to bg color), it's transparent.
    // If distance is large (bright neon), it's opaque.
    // Max distance is roughly 440
    let alpha = 255;
    
    // We map a distance 0 to 60 as fading from 0 to 255.
    if (dist < 15) {
      alpha = 0;
    } else if (dist < 80) {
      alpha = Math.floor(((dist - 15) / 65) * 255);
    }
    
    // Boost the colors slightly to compensate for lost luminance in transparency
    if (alpha > 0 && alpha < 255) {
       r = Math.min(255, r + 20);
       g = Math.min(255, g + 20);
       b = Math.min(255, b + 20);
    }

    pixelArray[i] = r;
    pixelArray[i+1] = g;
    pixelArray[i+2] = b;
    pixelArray[i+3] = alpha;
  }

  await sharp(pixelArray, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    }
  })
  .resize(512, 512) // Optimize size
  .png()
  .toFile('./public/logo.png');

  console.log("Successfully extracted neon logo to true transparent PNG!");
}

processLogo().catch(console.error);
