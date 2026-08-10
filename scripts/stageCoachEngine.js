// Copies the coach engine executable into build/coach, ready to be packaged.
//
// The engine is built from a separate repository, so the packaging step reads
// from a directory in this one rather than reaching across into a sibling
// checkout that may not be there -- a build machine without it should still
// produce an app, not fail on a missing path.
//
//   node scripts/stageCoachEngine.js [path-to-coach-repo]

const {copyFileSync, existsSync, mkdirSync, statSync} = require('fs')
const {basename, join, resolve} = require('path')

const executableName =
  process.platform === 'win32' ? 'thai-go-coach.exe' : 'thai-go-coach'

const source = resolve(
  process.argv[2] ?? join(__dirname, '..', '..', 'Project_Thai_Go_AI_Coach'),
  'dist',
  executableName,
)

const targetDirectory = resolve(__dirname, '..', 'build', 'coach')
const target = join(targetDirectory, basename(source))

if (!existsSync(source)) {
  console.error(`ไม่พบไฟล์โค้ชที่ ${source}`)
  console.error('สร้างก่อนด้วย: python scripts/build_exe.py (ในรีโปของโค้ช)')
  process.exitCode = 1
} else {
  mkdirSync(targetDirectory, {recursive: true})
  copyFileSync(source, target)

  console.log(`${target} — ${(statSync(target).size / 1e6).toFixed(1)} MB`)
}
