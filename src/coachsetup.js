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

const {existsSync, writeFileSync} = require('fs')
const {join} = require('path')

const setting = require('./setting')
const {coachConfigPath} = require('./coachengine')
const {defaultLevel, gtpConfigContents, levelPresets} = require('./coachlevels')
const {downloadKataGo} = require('./coachdownload')

const katagoDirectory = join(setting.userDataDirectory, 'katago')

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

/**
 * Fetches KataGo and its networks into the app's own directory.
 *
 * The fetching itself lives in coachdownload.js, which knows nothing about
 * electron and so can be run against the real URLs without launching the app.
 */
exports.downloadKataGo = function (onProgress) {
  return downloadKataGo(katagoDirectory, onProgress)
}
