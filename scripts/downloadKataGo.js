// Runs the first-run download for real, without launching the app.
//
// Some 190 MB over two hosts, both of which redirect to signed URLs, followed
// by unpacking a zip with whatever `tar` the machine has. None of that can be
// established by reading the code, and it is the step every new user hits
// first.
//
//   node scripts/downloadKataGo.js [directory]
//
// Existing files are left alone, so an interrupted run resumes.

const {existsSync, statSync} = require('fs')
const {join, resolve} = require('path')

const {downloadKataGo, stepsFor} = require('../src/coachdownload')

const directory = resolve(process.argv[2] ?? join(process.cwd(), 'katago-test'))

let lastReported = ''

// Keyed on the step and the ten-percent bucket, not on the whole line: the
// megabyte count changes with every chunk, so including it would print a line
// per chunk.
function report(key, text) {
  if (key === lastReported) return
  lastReported = key
  process.stdout.write(`${text}\n`)
}

async function main() {
  console.log(`ปลายทาง: ${directory}`)
  console.log(`ขั้นตอน: ${stepsFor().length}`)

  let started = Date.now()

  await downloadKataGo(directory, ({step, steps, name, received, total}) => {
    let percent = total > 0 ? Math.floor((received / total) * 100) : 0
    let bucket = Math.floor(percent / 10) * 10

    report(
      `${step}:${bucket}`,
      `[${step}/${steps}] ${name} ${bucket}% (${(received / 1e6).toFixed(1)} MB)`,
    )
  })

  console.log(
    `\nใช้เวลา ${((Date.now() - started) / 1000).toFixed(0)} วินาที\n`,
  )

  // What matters is not that files arrived but that the ones the coach engine
  // will be told to run are there.
  let expected = [
    process.platform === 'win32' ? 'katago.exe' : 'katago',
    join('models', 'kata1-b18c384nbt.bin.gz'),
    join('models', 'b18c384nbt-humanv0.bin.gz'),
  ]

  let missing = []

  for (let relative of expected) {
    let path = join(directory, relative)

    if (!existsSync(path)) {
      missing.push(relative)
      console.log(`  ไม่พบ  ${relative}`)
    } else {
      console.log(
        `  พบแล้ว ${relative} (${(statSync(path).size / 1e6).toFixed(1)} MB)`,
      )
    }
  }

  if (missing.length > 0) {
    console.error(`\nขาด ${missing.length} ไฟล์`)
    process.exitCode = 1
  } else {
    console.log('\nครบทุกไฟล์ที่โค้ชต้องใช้')
  }
}

main().catch((err) => {
  console.error(`\nล้มเหลว: ${err.message}`)
  process.exitCode = 1
})
