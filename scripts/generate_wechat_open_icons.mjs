import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const projectRoot = path.resolve(import.meta.dirname, '..')
const outputDir = path.join(projectRoot, 'assets', 'wechat-open-platform')

const makeSvg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffce47"/>
      <stop offset="48%" stop-color="#ff8a3d"/>
      <stop offset="100%" stop-color="#ff5d73"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="${size * 0.025}" stdDeviation="${size * 0.035}" flood-color="#a73616" flood-opacity="0.28"/>
    </filter>
  </defs>
  <rect x="0" y="0" width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#bg)"/>
  <circle cx="${size * 0.27}" cy="${size * 0.25}" r="${size * 0.11}" fill="#fff6d8" opacity="0.45"/>
  <circle cx="${size * 0.80}" cy="${size * 0.20}" r="${size * 0.06}" fill="#ffffff" opacity="0.38"/>
  <g filter="url(#shadow)">
    <path d="M ${size * 0.29} ${size * 0.38}
      C ${size * 0.20} ${size * 0.45}, ${size * 0.20} ${size * 0.61}, ${size * 0.32} ${size * 0.69}
      C ${size * 0.45} ${size * 0.78}, ${size * 0.65} ${size * 0.73}, ${size * 0.73} ${size * 0.60}
      C ${size * 0.81} ${size * 0.47}, ${size * 0.73} ${size * 0.34}, ${size * 0.58} ${size * 0.31}
      C ${size * 0.47} ${size * 0.29}, ${size * 0.37} ${size * 0.32}, ${size * 0.29} ${size * 0.38} Z"
      fill="#fffdf3"/>
    <path d="M ${size * 0.34} ${size * 0.49}
      C ${size * 0.44} ${size * 0.38}, ${size * 0.61} ${size * 0.39}, ${size * 0.69} ${size * 0.50}"
      fill="none" stroke="#c95121" stroke-width="${Math.max(2, size * 0.055)}" stroke-linecap="round"/>
    <circle cx="${size * 0.43}" cy="${size * 0.58}" r="${Math.max(1.4, size * 0.035)}" fill="#ff7b2f"/>
    <circle cx="${size * 0.58}" cy="${size * 0.58}" r="${Math.max(1.4, size * 0.035)}" fill="#ff7b2f"/>
  </g>
  <text x="50%" y="${size * 0.88}" text-anchor="middle"
    font-size="${size * 0.18}" font-weight="800"
    font-family="Microsoft YaHei, SimHei, Arial, sans-serif"
    fill="#fffdf7">好今</text>
</svg>`

await fs.mkdir(outputDir, { recursive: true })

for (const size of [28, 108]) {
  const target = path.join(outputDir, `haochidejintian-wechat-open-${size}.png`)
  await sharp(Buffer.from(makeSvg(size)))
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(target)
  const stat = await fs.stat(target)
  console.log(`${target} ${(stat.size / 1024).toFixed(1)}KB`)
}
