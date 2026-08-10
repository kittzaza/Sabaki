// Getting the coach ready to run, without the learner assembling it by hand.
//
// The coach needs three things that are not in the installer: KataGo, a neural
// network for it, and a config file tying them together with the learner's
// level. Doing that by hand means a release page, a model repository, a .cfg
// file and a JSON file with absolute paths in it -- which is where every
// would-be user stopped before this.
//
// Main-process module, so it sits at the src root: build.files drops
// src/modules from the package (see test/packagingTests.js).

const {createWriteStream, existsSync, mkdirSync, writeFileSync} = require('fs')
const {spawnSync} = require('child_process')
const {get} = require('https')
const {join} = require('path')

const setting = require('./setting')
const {coachConfigPath} = require('./coachengine')
const {
  defaultLevel,
  downloads,
  gtpConfigContents,
  levelPresets,
} = require('./coachlevels')

const katagoDirectory = join(setting.userDataDirectory, 'katago')
const modelsDirectory = join(katagoDirectory, 'models')

const executableName = process.platform === 'win32' ? 'katago.exe' : 'katago'

exports.katagoDirectory = katagoDirectory

/**
 * Where KataGo is, or null.
 *
 * A directory the user pointed at wins over the downloaded one: someone who
 * already has KataGo tuned for their machine should not be made to fetch a
 * second copy.
 */
exports.findKataGo = function () {
  let chosen = setting.get('coach.katago_directory')

  return (
    [chosen, katagoDirectory]
      .filter((dir) => dir)
      .map((dir) => join(dir, executableName))
      .find((path) => existsSync(path)) ?? null
  )
}

exports.findModel = function (directory) {
  let dir =
    directory ?? setting.get('coach.katago_directory') ?? katagoDirectory

  return (
    [
      join(dir, 'models', 'kata1-b18c384nbt.bin.gz'),
      join(dir, 'kata1-b18c384nbt.bin.gz'),
    ].find((path) => existsSync(path)) ?? null
  )
}

exports.findHumanModel = function (directory) {
  let dir =
    directory ?? setting.get('coach.katago_directory') ?? katagoDirectory
  let path = join(dir, 'models', 'b18c384nbt-humanv0.bin.gz')

  return existsSync(path) ? path : null
}

/**
 * Writes everything the coach engine needs to start, and records the level.
 *
 * Returns the config path so the caller can show it; throws if KataGo or the
 * network are not there, because a config pointing at neither is worse than no
 * config at all -- the engine would start and fail later with a stranger error.
 */
exports.writeCoachSetup = function ({level, directory} = {}) {
  let chosenLevel = levelPresets[level] != null ? level : defaultLevel
  let dir =
    directory ?? setting.get('coach.katago_directory') ?? katagoDirectory
  let executable = join(dir, executableName)
  let model = exports.findModel(dir)

  if (!existsSync(executable)) throw new Error(`ไม่พบ KataGo ที่ ${executable}`)
  if (model == null) throw new Error(`ไม่พบโมเดลวิเคราะห์ในโฟลเดอร์ ${dir}`)

  let gtpConfig = join(dir, 'gtp_coach.cfg')
  writeFileSync(gtpConfig, gtpConfigContents(chosenLevel), 'utf8')

  let humanModel = exports.findHumanModel(dir)
  let args = ['gtp', '-model', model, '-config', gtpConfig]
  if (humanModel != null) args.push('-human-model', humanModel)

  writeFileSync(
    coachConfigPath,
    JSON.stringify(
      {
        _comment: 'สร้างโดย Coach Go จากหน้าตั้งค่าครั้งแรก',
        backend: {command: executable, args, cwd: dir},
        coach: {
          language: 'th',
          criteria_profile: levelPresets[chosenLevel].criteria,
          human_profile: levelPresets[chosenLevel].humanRank,
          quiet: false,
          engine_name: 'โค้ชโกะ',
        },
      },
      null,
      2,
    ),
    'utf8',
  )

  setting.set('coach.level', chosenLevel)
  setting.set('coach.katago_directory', dir)

  return coachConfigPath
}

exports.isSetUp = function () {
  return existsSync(coachConfigPath) && exports.findKataGo() != null
}

function download(url, target, onProgress) {
  return new Promise((resolve, reject) => {
    let request = get(url, (response) => {
      // GitHub and the model host both answer with a redirect to a signed URL.
      if (response.statusCode >= 300 && response.statusCode < 400) {
        response.resume()
        return download(response.headers.location, target, onProgress).then(
          resolve,
          reject,
        )
      }

      if (response.statusCode !== 200) {
        response.resume()
        return reject(new Error(`ดาวน์โหลดไม่สำเร็จ (${response.statusCode})`))
      }

      let total = Number(response.headers['content-length']) || 0
      let received = 0
      // Written to a temporary name so an interrupted download is never
      // mistaken for a finished one on the next launch.
      let partial = `${target}.part`
      let file = createWriteStream(partial)

      response.on('data', (chunk) => {
        received += chunk.length
        onProgress?.({received, total})
      })

      response.pipe(file)
      file.on('error', reject)
      file.on('finish', () => {
        file.close(() => {
          try {
            require('fs').renameSync(partial, target)
            resolve(target)
          } catch (err) {
            reject(err)
          }
        })
      })
    })

    request.on('error', reject)
  })
}

/**
 * Fetches KataGo and its networks into the user data directory.
 *
 * `onProgress` is called with the step being fetched and how far along it is,
 * because these are hundreds of megabytes and a window that simply sits there
 * looks broken.
 */
exports.downloadKataGo = async function (onProgress) {
  mkdirSync(modelsDirectory, {recursive: true})

  let steps = downloads.filter(
    (step) => step.platform == null || step.platform === process.platform,
  )

  for (let [index, step] of steps.entries()) {
    let target = join(katagoDirectory, step.file)
    if (existsSync(target)) continue

    await download(step.url, target, ({received, total}) =>
      onProgress?.({
        step: index + 1,
        steps: steps.length,
        name: step.name,
        received,
        total,
      }),
    )

    if (step.extract) {
      // bsdtar, which ships with Windows 10 and up and with macOS, and reads
      // zip as well as tar. Spawning it beats adding an archive dependency for
      // one file, and it is the only archive this app will ever open.
      let result = spawnSync('tar', ['-xf', target, '-C', katagoDirectory], {
        stdio: 'ignore',
      })

      if (result.error != null || result.status !== 0) {
        throw new Error('แตกไฟล์ KataGo ไม่สำเร็จ')
      }
    }
  }

  return katagoDirectory
}
