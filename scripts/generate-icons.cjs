/**
 * Reproducible Multi-Resolution Icon Generator for Dice Chaos Connections
 *
 * Design: Gold-Core Pure Wireframe D20 (orthographic regular icosahedron front hemisphere
 * formed out of mind-map connection presets + 9 concentric Entity-Node port rings).
 *
 * Run via: npm run icons
 */
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')

const APP_ROOT = path.resolve(__dirname, '..')
const BUILD_DIR = path.join(APP_ROOT, 'build')
const RESOURCES_DIR = path.join(APP_ROOT, 'resources')
const FAVICON_PATH = path.join(APP_ROOT, 'src', 'renderer', 'src', 'assets', 'favicon.svg')

function polar(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180
  return [+(cx + r * Math.cos(rad)).toFixed(2), +(cy + r * Math.sin(rad)).toFixed(2)]
}

function buildD20Geometry(cx = 256, cy = 258, R = 176, r = 107) {
  const H = [
    polar(cx, cy, R, -90), // H0 Top
    polar(cx, cy, R, -30), // H1 Top-Right
    polar(cx, cy, R, 30), // H2 Bottom-Right
    polar(cx, cy, R, 90), // H3 Bottom
    polar(cx, cy, R, 150), // H4 Bottom-Left
    polar(cx, cy, R, -150) // H5 Top-Left
  ]
  const T = [
    polar(cx, cy, r, -90), // T0 Top-Inner
    polar(cx, cy, r, 30), // T1 Bottom-Right-Inner
    polar(cx, cy, r, 150) // T2 Bottom-Left-Inner
  ]
  return { H, T }
}

function trimSegment(p1, p2, trimStart, trimEnd) {
  const dx = p2[0] - p1[0]
  const dy = p2[1] - p1[1]
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  return [
    [+(p1[0] + ux * trimStart).toFixed(2), +(p1[1] + uy * trimStart).toFixed(2)],
    [+(p2[0] - ux * trimEnd).toFixed(2), +(p2[1] - uy * trimEnd).toFixed(2)]
  ]
}

function arrowPolygon(from, to, tipTrim, length = 19, halfWidth = 8.8) {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const px = -uy
  const py = ux
  const tip = [to[0] - ux * tipTrim, to[1] - uy * tipTrim]
  const base = [tip[0] - ux * length, tip[1] - uy * length]
  const left = [base[0] + px * halfWidth, base[1] + py * halfWidth]
  const right = [base[0] - px * halfWidth, base[1] - py * halfWidth]
  const indent = [tip[0] - ux * (length * 0.78), tip[1] - uy * (length * 0.78)]
  return `${tip[0].toFixed(1)},${tip[1].toFixed(1)} ${left[0].toFixed(1)},${left[1].toFixed(1)} ${indent[0].toFixed(1)},${indent[1].toFixed(1)} ${right[0].toFixed(1)},${right[1].toFixed(1)}`
}

function buildD20IconSvg(opticalMode = 'hero') {
  const isSmall = opticalMode === 'small'
  const { H, T } = buildD20Geometry(256, 258, isSmall ? 192 : 176, isSmall ? 116 : 107)
  const wScale = isSmall ? 1.55 : 1

  const P = {
    bgStart: '#1b2440',
    bgMid: '#0d1426',
    bgEnd: '#060a14',
    border: '#3b4f70',
    innerGlow: '#fbbf24',
    grid: 'rgba(148, 163, 184, 0.08)',
    facetFillCenter: 'rgba(251, 191, 36, 0.08)',
    facetFillSide: 'rgba(56, 189, 248, 0.045)',
    nodeBg: '#0a1020',
    gold: '#fbbf24',
    goldBright: '#fde68a',
    emerald: '#10b981',
    sky: '#38bdf8',
    crimson: '#f87171',
    violet: '#a78bfa'
  }

  const outerR = isSmall ? 18 : 13.5
  const innerR = isSmall ? 20 : 15.5

  const edges = [
    // Outer hexagon
    { a: H[5], b: H[0], ra: outerR, rb: outerR, color: P.emerald, width: 6.5 * wScale, dash: '' },
    { a: H[0], b: H[1], ra: outerR, rb: outerR, color: P.crimson, width: 6.5 * wScale, dash: '', arrowTo: !isSmall },
    { a: H[1], b: H[2], ra: outerR, rb: outerR, color: P.sky, width: 6.5 * wScale, dash: '' },
    { a: H[2], b: H[3], ra: outerR, rb: outerR, color: P.gold, width: 6.5 * wScale, dash: isSmall ? '' : '3 11', cap: 'round' },
    { a: H[3], b: H[4], ra: outerR, rb: outerR, color: P.emerald, width: 6.5 * wScale, dash: '' },
    { a: H[4], b: H[5], ra: outerR, rb: outerR, color: P.violet, width: 6.5 * wScale, dash: isSmall ? '' : '12 9' },

    // Diagonal facet chords
    { a: H[5], b: T[0], ra: outerR, rb: innerR, color: P.emerald, width: 5.5 * wScale, dash: '' },
    { a: H[1], b: T[0], ra: outerR, rb: innerR, color: P.crimson, width: 5.5 * wScale, dash: '' },
    { a: H[1], b: T[1], ra: outerR, rb: innerR, color: P.sky, width: 5.5 * wScale, dash: '', arrowTo: !isSmall },
    { a: H[3], b: T[1], ra: outerR, rb: innerR, color: P.gold, width: 5.5 * wScale, dash: '' },
    { a: H[3], b: T[2], ra: outerR, rb: innerR, color: P.sky, width: 5.5 * wScale, dash: isSmall ? '' : '12 9' },
    { a: H[5], b: T[2], ra: outerR, rb: innerR, color: P.violet, width: 5.5 * wScale, dash: isSmall ? '' : '12 9', arrowTo: !isSmall },

    // Radial spokes
    { a: H[0], b: T[0], ra: outerR, rb: innerR, color: P.gold, width: 6.5 * wScale, dash: '' },
    { a: H[2], b: T[1], ra: outerR, rb: innerR, color: P.sky, width: 6.5 * wScale, dash: '' },
    { a: H[4], b: T[2], ra: outerR, rb: innerR, color: P.emerald, width: 6.5 * wScale, dash: '' },

    // Hero Gold Middle Triangle
    { a: T[0], b: T[1], ra: innerR, rb: innerR, color: P.goldBright, width: 8.5 * wScale, dash: '' },
    { a: T[1], b: T[2], ra: innerR, rb: innerR, color: P.goldBright, width: 8.5 * wScale, dash: '' },
    { a: T[2], b: T[0], ra: innerR, rb: innerR, color: P.goldBright, width: 8.5 * wScale, dash: '' }
  ]

  const edgeSvg = edges
    .map((e) => {
      const extraEnd = e.arrowTo ? 13 : 0
      const [p1, p2] = trimSegment(e.a, e.b, e.ra + 2, e.rb + 2 + extraEnd)
      const line = `<line x1="${p1[0]}" y1="${p1[1]}" x2="${p2[0]}" y2="${p2[1]}" stroke="${e.color}" stroke-width="${e.width.toFixed(1)}" stroke-linecap="${e.cap || 'round'}" ${e.dash ? `stroke-dasharray="${e.dash}"` : ''} />`
      const arrow = e.arrowTo
        ? `<polygon points="${arrowPolygon(e.a, e.b, e.rb + 3, 19, 8.8)}" fill="${e.color}" />`
        : ''
      return line + arrow
    })
    .join('\n    ')

  const nodes = [
    { p: H[0], r: outerR, color: P.gold },
    { p: H[1], r: outerR, color: P.crimson },
    { p: H[2], r: outerR, color: P.sky },
    { p: H[3], r: outerR, color: P.gold },
    { p: H[4], r: outerR, color: P.emerald },
    { p: H[5], r: outerR, color: P.violet },
    { p: T[0], r: innerR, color: P.goldBright, hero: true },
    { p: T[1], r: innerR, color: P.goldBright, hero: true },
    { p: T[2], r: innerR, color: P.goldBright, hero: true }
  ]

  const nodeSvg = nodes
    .map((n) => {
      const ringW = (n.hero ? 5.2 : 4.4) * (isSmall ? 1.25 : 1)
      const pipR = n.hero ? 5.2 : 4.0
      return `<g>
      <circle cx="${n.p[0]}" cy="${n.p[1]}" r="${(n.r + 2).toFixed(1)}" fill="${P.nodeBg}" />
      <circle cx="${n.p[0]}" cy="${n.p[1]}" r="${(n.r - ringW / 2).toFixed(1)}" fill="${P.nodeBg}" stroke="${n.color}" stroke-width="${ringW.toFixed(1)}" />
      <circle cx="${n.p[0]}" cy="${n.p[1]}" r="${pipR.toFixed(1)}" fill="${n.color}" />
    </g>`
    })
    .join('\n    ')

  const gridLines = isSmall
    ? ''
    : [116, 186, 256, 326, 396]
        .map(
          (v) =>
            `<line x1="${v}" y1="30" x2="${v}" y2="482" stroke="${P.grid}" stroke-width="1.5" />` +
            `<line x1="30" y1="${v}" x2="482" y2="${v}" stroke="${P.grid}" stroke-width="1.5" />`
        )
        .join('\n    ')

  const hexPts = H.map((p) => p.join(',')).join(' ')
  const triPts = T.map((p) => p.join(',')).join(' ')
  const idSuffix = opticalMode

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="dcc-bg-${idSuffix}" cx="50%" cy="42%" r="65%">
      <stop offset="0%" stop-color="${P.bgStart}" />
      <stop offset="58%" stop-color="${P.bgMid}" />
      <stop offset="100%" stop-color="${P.bgEnd}" />
    </radialGradient>
    <radialGradient id="dcc-halo-${idSuffix}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${P.innerGlow}" stop-opacity="0.16" />
      <stop offset="65%" stop-color="${P.innerGlow}" stop-opacity="0.05" />
      <stop offset="100%" stop-color="${P.innerGlow}" stop-opacity="0" />
    </radialGradient>
    <clipPath id="dcc-squircle-${idSuffix}">
      <rect x="20" y="20" width="472" height="472" rx="108" />
    </clipPath>
    <filter id="dcc-glow-${idSuffix}" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="${isSmall ? '2' : '5'}" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <g clip-path="url(#dcc-squircle-${idSuffix})">
    <rect x="20" y="20" width="472" height="472" fill="url(#dcc-bg-${idSuffix})" />
    ${gridLines}
    <circle cx="256" cy="258" r="225" fill="url(#dcc-halo-${idSuffix})" />
  </g>
  <rect x="23" y="23" width="466" height="466" rx="105" fill="none" stroke="${P.border}" stroke-width="6" stroke-opacity="0.82" />
  <rect x="29" y="29" width="454" height="454" rx="100" fill="none" stroke="${P.gold}" stroke-width="1.5" stroke-opacity="0.26" />

  <polygon points="${hexPts}" fill="${P.facetFillSide}" />
  <polygon points="${triPts}" fill="${P.facetFillCenter}" />

  <g filter="url(#dcc-glow-${idSuffix})">
    ${edgeSvg}
  </g>

  ${nodeSvg}
</svg>
`
}

/**
 * Encodes straight-alpha top-down RGBA [R, G, B, A] into a Windows ICO 32-bit BGRA DIB
 * (BITMAPINFOHEADER + bottom-up BGRA XOR bitmap + DWORD-aligned 1-bpp AND mask).
 */
function encodeRgbaToIcoDib(rgba, size) {
  const xorSize = size * size * 4
  const andRowBytes = Math.ceil(size / 32) * 4
  const andSize = andRowBytes * size
  const buf = Buffer.alloc(40 + xorSize + andSize, 0)

  // BITMAPINFOHEADER (40 bytes)
  buf.writeUInt32LE(40, 0) // biSize
  buf.writeInt32LE(size, 4) // biWidth
  buf.writeInt32LE(size * 2, 8) // biHeight (XOR + AND combined height)
  buf.writeUInt16LE(1, 12) // biPlanes
  buf.writeUInt16LE(32, 14) // biBitCount
  buf.writeUInt32LE(0, 16) // biCompression (BI_RGB)
  buf.writeUInt32LE(xorSize + andSize, 20) // biSizeImage

  const xorStart = 40
  const andStart = 40 + xorSize

  for (let y = 0; y < size; y++) {
    const srcRow = (size - 1 - y) * size * 4 // bottom-up
    const dstXorRow = xorStart + y * size * 4
    const dstAndRow = andStart + y * andRowBytes

    for (let x = 0; x < size; x++) {
      const si = srcRow + x * 4
      const di = dstXorRow + x * 4
      const r = rgba[si]
      const g = rgba[si + 1]
      const b = rgba[si + 2]
      const a = rgba[si + 3]

      buf[di] = b
      buf[di + 1] = g
      buf[di + 2] = r
      buf[di + 3] = a

      if (a === 0) {
        const byteIndex = dstAndRow + (x >> 3)
        const bitMask = 1 << (7 - (x & 7))
        buf[byteIndex] |= bitMask
      }
    }
  }

  return buf
}

/**
 * Builds a multi-resolution Windows .ico file:
 * - < 256px frames stored as 32-bit BGRA DIB (required by NSIS makensis.exe)
 * - 256px frame stored as lossless PNG
 */
function buildIcoBuffer(frames) {
  const count = frames.length
  const header = Buffer.alloc(6 + count * 16)
  header.writeUInt16LE(0, 0) // Reserved
  header.writeUInt16LE(1, 2) // Type = 1 (Icon)
  header.writeUInt16LE(count, 4)

  const payloads = frames.map((f) =>
    f.size >= 256 ? f.pngBuffer : encodeRgbaToIcoDib(f.rgbaBuffer, f.size)
  )

  let offset = header.length
  for (let i = 0; i < count; i++) {
    const size = frames[i].size
    const payload = payloads[i]
    const entryOff = 6 + i * 16
    header[entryOff] = size >= 256 ? 0 : size
    header[entryOff + 1] = size >= 256 ? 0 : size
    header[entryOff + 2] = 0
    header[entryOff + 3] = 0
    header.writeUInt16LE(1, entryOff + 4) // Color planes
    header.writeUInt16LE(32, entryOff + 6) // Bits per pixel
    header.writeUInt32LE(payload.length, entryOff + 8)
    header.writeUInt32LE(offset, entryOff + 12)
    offset += payload.length
  }

  return Buffer.concat([header, ...payloads])
}

/**
 * Builds a multi-resolution Apple .icns file using PNG-encoded OSType chunks.
 */
function buildIcnsBuffer(chunks) {
  const parts = chunks.map(({ osType, pngBuffer }) => {
    const chunkHeader = Buffer.alloc(8)
    chunkHeader.write(osType, 0, 4, 'ascii')
    chunkHeader.writeUInt32BE(8 + pngBuffer.length, 4)
    return Buffer.concat([chunkHeader, pngBuffer])
  })
  const totalLen = 8 + parts.reduce((sum, p) => sum + p.length, 0)
  const fileHeader = Buffer.alloc(8)
  fileHeader.write('icns', 0, 4, 'ascii')
  fileHeader.writeUInt32BE(totalLen, 4)
  return Buffer.concat([fileHeader, ...parts])
}

async function rasterizeSvgFrame(win, svgMarkup, size) {
  const svgDataUrl = 'data:image/svg+xml;base64,' + Buffer.from(svgMarkup, 'utf-8').toString('base64')
  const result = await win.webContents.executeJavaScript(`
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = ${size};
        canvas.height = ${size};
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.clearRect(0, 0, ${size}, ${size});
        ctx.drawImage(img, 0, 0, ${size}, ${size});
        const pngBase64 = canvas.toDataURL('image/png').split(',')[1];
        const rgba = ctx.getImageData(0, 0, ${size}, ${size}).data;
        // Convert Uint8ClampedArray to base64 safely
        let binary = '';
        const chunk = 0x8000;
        for (let i = 0; i < rgba.length; i += chunk) {
          binary += String.fromCharCode.apply(null, rgba.subarray(i, i + chunk));
        }
        resolve({ pngBase64, rgbaBase64: btoa(binary) });
      };
      img.onerror = (err) => reject(new Error('Failed to load SVG at size ${size}: ' + err));
      img.src = ${JSON.stringify(svgDataUrl)};
    })
  `)
  return {
    size,
    pngBuffer: Buffer.from(result.pngBase64, 'base64'),
    rgbaBuffer: Buffer.from(result.rgbaBase64, 'base64')
  }
}

app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  try {
    fs.mkdirSync(BUILD_DIR, { recursive: true })
    fs.mkdirSync(RESOURCES_DIR, { recursive: true })
    fs.mkdirSync(path.dirname(FAVICON_PATH), { recursive: true })

    const heroSvg = buildD20IconSvg('hero')
    const smallSvg = buildD20IconSvg('small')

    fs.writeFileSync(path.join(BUILD_DIR, 'icon.svg'), heroSvg, 'utf-8')
    fs.writeFileSync(FAVICON_PATH, smallSvg, 'utf-8')

    const win = new BrowserWindow({
      width: 128,
      height: 128,
      show: false,
      webPreferences: { offscreen: true }
    })
    await win.loadURL('data:text/html;charset=utf-8,<!doctype html><html><body></body></html>')

    const allSizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024]
    const rendered = new Map()
    for (const sz of allSizes) {
      const svg = sz <= 32 ? smallSvg : heroSvg
      rendered.set(sz, await rasterizeSvgFrame(win, svg, sz))
    }

    // 1. Master 512x512 PNGs
    const png512 = rendered.get(512).pngBuffer
    fs.writeFileSync(path.join(BUILD_DIR, 'icon.png'), png512)
    fs.writeFileSync(path.join(RESOURCES_DIR, 'icon.png'), png512)

    // 2. Multi-resolution Windows .ico (16, 24, 32, 48, 64, 128, 256)
    const icoFrames = [16, 24, 32, 48, 64, 128, 256].map((sz) => rendered.get(sz))
    const icoBuf = buildIcoBuffer(icoFrames)
    fs.writeFileSync(path.join(BUILD_DIR, 'icon.ico'), icoBuf)
    fs.writeFileSync(path.join(RESOURCES_DIR, 'icon.ico'), icoBuf)

    // 3. Multi-resolution macOS .icns (16..1024)
    const icnsBuf = buildIcnsBuffer([
      { osType: 'icp4', pngBuffer: rendered.get(16).pngBuffer },
      { osType: 'icp5', pngBuffer: rendered.get(32).pngBuffer },
      { osType: 'icp6', pngBuffer: rendered.get(64).pngBuffer },
      { osType: 'ic07', pngBuffer: rendered.get(128).pngBuffer },
      { osType: 'ic08', pngBuffer: rendered.get(256).pngBuffer },
      { osType: 'ic09', pngBuffer: rendered.get(512).pngBuffer },
      { osType: 'ic10', pngBuffer: rendered.get(1024).pngBuffer }
    ])
    fs.writeFileSync(path.join(BUILD_DIR, 'icon.icns'), icnsBuf)

    console.log(
      `Generated D20 icons -> icon.png (${png512.length} B), icon.ico (${icoBuf.length} B), icon.icns (${icnsBuf.length} B)`
    )
    win.destroy()
    app.quit()
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
})
