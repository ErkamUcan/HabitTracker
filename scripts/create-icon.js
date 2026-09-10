// node scripts/create-icon.js
// Creates a minimal valid 256x256 ICO file with PNG image data.
const fs   = require('fs')
const path = require('path')
const zlib = require('zlib')

const W = 256, H = 256

// Build a minimal PNG for a 256x256 image
function makePNG(w, h, pixelFn) {
  const rawRows = []
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(w * 3)
    for (let x = 0; x < w; x++) {
      const [r, g, b] = pixelFn(x, y)
      row[x * 3 + 0] = r
      row[x * 3 + 1] = g
      row[x * 3 + 2] = b
    }
    // PNG filter byte 0 (None) before each row
    rawRows.push(Buffer.concat([Buffer.from([0]), row]))
  }

  const raw = Buffer.concat(rawRows)
  const compressed = zlib.deflateSync(raw, { level: 6 })

  function chunk(type, data) {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length, 0)
    const typeB = Buffer.from(type, 'ascii')
    const body  = Buffer.concat([typeB, data])
    let crc = 0xffffffff
    for (const byte of body) {
      crc ^= byte
      for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
    crc = (~crc) >>> 0
    const crcB = Buffer.alloc(4)
    crcB.writeUInt32BE(crc, 0)
    return Buffer.concat([len, typeB, data, crcB])
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8]  = 8   // bit depth
  ihdr[9]  = 2   // color type: RGB
  ihdr[10] = 0   // compression
  ihdr[11] = 0   // filter
  ihdr[12] = 0   // interlace

  const sig    = Buffer.from([137,80,78,71,13,10,26,10])
  const chIHDR = chunk('IHDR', ihdr)
  const chIDAT = chunk('IDAT', compressed)
  const chIEND = chunk('IEND', Buffer.alloc(0))

  return Buffer.concat([sig, chIHDR, chIDAT, chIEND])
}

function pixelFn(x, y) {
  const cx = W / 2, cy = H / 2
  const rx = (W * 0.40), ry = (H * 0.40)
  // Outer background: warm paper
  const bg = [0xfa, 0xf6, 0xf0]
  // Accent circle: #8b6355
  const accent = [0x8b, 0x63, 0x55]
  // Letter T inner: white
  const white = [0xff, 0xff, 0xff]

  const dx = (x - cx) / rx, dy = (y - cy) / ry
  const inCircle = dx * dx + dy * dy <= 1.0

  if (!inCircle) return bg

  // Simple "T" shape inside circle
  const nx = (x - cx) / W, ny = (y - cy) / H
  const barH = Math.abs(ny) < 0.05 && Math.abs(nx) < 0.20  // horizontal bar
  const stem = ny > 0 && ny < 0.22 && Math.abs(nx) < 0.07  // vertical stem

  if (barH || stem) return white
  return accent
}

const png = makePNG(W, H, pixelFn)

// Wrap in ICO container
const iconDir  = Buffer.alloc(6)  // ICONDIR
iconDir.writeUInt16LE(0, 0)  // reserved
iconDir.writeUInt16LE(1, 2)  // type=1 (ICO)
iconDir.writeUInt16LE(1, 4)  // count=1

const entry = Buffer.alloc(16)
entry[0] = 0          // width: 0 means 256
entry[1] = 0          // height: 0 means 256
entry[2] = 0          // colorCount: 0 for 32bpp
entry[3] = 0          // reserved
entry.writeUInt16LE(0, 4)               // planes: 0 for PNG
entry.writeUInt16LE(32, 6)              // bitCount: 32
entry.writeUInt32LE(png.length, 8)      // bytesInRes
entry.writeUInt32LE(6 + 16, 12)         // imageOffset (after header + 1 entry)

const assetsDir = path.join(__dirname, '..', 'assets')
fs.mkdirSync(assetsDir, { recursive: true })
fs.writeFileSync(path.join(assetsDir, 'icon.ico'), Buffer.concat([iconDir, entry, png]))
console.log(`Icon written (${png.length + 22} bytes)`)
