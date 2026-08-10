// Draws the Coach Go application icon.
//
// The app is a fork, and shipping Sabaki's logo under another name would tell
// the user they installed Sabaki. Rather than carry a binary nobody can edit,
// the icon is generated: a board corner with the two stones of a shape, which
// is what the coach talks about.
//
// electron-builder derives the .ico and .icns from a single square PNG of at
// least 512px, so one file covers every platform.
//
//   node ci/makeIcon.js

const {deflateSync} = require('zlib')
const {writeFileSync} = require('fs')
const {join} = require('path')

const SIZE = 512
const SS = 3 // supersampling factor, enough to keep the circles smooth

const BOARD = [0xdc, 0xb3, 0x5c]
const LINE = [0x6b, 0x4a, 0x24]
const BLACK = [0x1a, 0x1a, 0x1a]
const WHITE = [0xf7, 0xf5, 0xef]

// A 3x3 corner of a board: lines run from the two edges that face the centre
// and stop where the board would continue, so it reads as a corner rather than
// as a whole tiny board.
const MARGIN = 78
const STEP = (SIZE - MARGIN * 2) / 2
const at = (i) => MARGIN + i * STEP

const shapes = []

const line = (x1, y1, x2, y2, width) =>
  shapes.push({kind: 'line', x1, y1, x2, y2, r: width / 2, color: LINE})

for (let i = 0; i < 3; i++) {
  line(at(i), MARGIN, at(i), SIZE - MARGIN, 9)
  line(MARGIN, at(i), SIZE - MARGIN, at(i), 9)
}

// Black plays the corner point, White answers on the diagonal: the smallest
// arrangement that is recognisably a position and not decoration.
shapes.push({kind: 'disc', cx: at(1), cy: at(1), r: 62, color: BLACK})
shapes.push({kind: 'disc', cx: at(2), cy: at(0), r: 62, color: WHITE})
shapes.push({
  kind: 'ring',
  cx: at(2),
  cy: at(0),
  r: 62,
  width: 7,
  color: [0x9a, 0x93, 0x86],
})

function coverage(shape, x, y) {
  if (shape.kind === 'disc' || shape.kind === 'ring') {
    let d = Math.hypot(x - shape.cx, y - shape.cy)
    if (shape.kind === 'disc') return d <= shape.r ? 1 : 0
    return d <= shape.r && d >= shape.r - shape.width ? 1 : 0
  }

  // Distance from the point to the segment, so line ends are rounded.
  let dx = shape.x2 - shape.x1
  let dy = shape.y2 - shape.y1
  let len2 = dx * dx + dy * dy
  let t =
    len2 === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((x - shape.x1) * dx + (y - shape.y1) * dy) / len2),
        )

  return Math.hypot(x - (shape.x1 + t * dx), y - (shape.y1 + t * dy)) <= shape.r
    ? 1
    : 0
}

// Rounded outer square, so the icon does not sit as a hard rectangle in a dock.
const RADIUS = 96
function insideBoard(x, y) {
  let cx = Math.min(Math.max(x, RADIUS), SIZE - RADIUS)
  let cy = Math.min(Math.max(y, RADIUS), SIZE - RADIUS)
  return Math.hypot(x - cx, y - cy) <= RADIUS
}

const pixels = Buffer.alloc(SIZE * SIZE * 4)

for (let py = 0; py < SIZE; py++) {
  for (let px = 0; px < SIZE; px++) {
    let acc = [0, 0, 0, 0]

    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        let x = px + (sx + 0.5) / SS
        let y = py + (sy + 0.5) / SS

        if (!insideBoard(x, y)) continue

        let color = BOARD
        for (let shape of shapes) {
          if (coverage(shape, x, y) > 0) color = shape.color
        }

        acc[0] += color[0]
        acc[1] += color[1]
        acc[2] += color[2]
        acc[3] += 255
      }
    }

    let samples = SS * SS
    let alpha = acc[3] / samples
    let offset = (py * SIZE + px) * 4

    // Premultiplied averaging would darken the edge against transparency, so
    // the colour is averaged over the covered samples only.
    let covered = acc[3] / 255 || 1
    pixels[offset] = Math.round(acc[0] / covered)
    pixels[offset + 1] = Math.round(acc[1] / covered)
    pixels[offset + 2] = Math.round(acc[2] / covered)
    pixels[offset + 3] = Math.round(alpha)
  }
}

// --- minimal PNG encoder -----------------------------------------------------

const crcTable = Array.from({length: 256}, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buffer) {
  let c = 0xffffffff
  for (let byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  let head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'ascii')

  let crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0)

  return Buffer.concat([head, data, crc])
}

let raw = Buffer.alloc(SIZE * (SIZE * 4 + 1))
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0 // filter type: none
  pixels.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4)
}

let ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0)
ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 6 // colour type: RGBA

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, {level: 9})),
  chunk('IEND', Buffer.alloc(0)),
])

const target = join(__dirname, '..', 'build', 'icon.png')
writeFileSync(target, png)
console.log(`${target} — ${SIZE}x${SIZE}, ${(png.length / 1024).toFixed(1)} KB`)
