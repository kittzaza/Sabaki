// What choosing a level actually sets, and where KataGo comes from.
//
// Kept free of any electron import so it can be tested directly: these values
// have to agree with the coach engine's own profiles in coach.py, and nothing
// but a test will notice when they stop agreeing.

/**
 * `criteria` picks the coach's grading thresholds -- a 1 point loss is nothing
 * to a beginner and a clear mistake to a dan player. `humanRank` picks the rank
 * KataGo's human model imitates when answering "where do players at your level
 * play". `visits` is search depth: the advanced thresholds are finer than the
 * error of a shallow search, so that level has to search deeper to mean
 * anything at all (measured; see PLAN-C.md in the coach engine repository).
 */
exports.levelPresets = {
  beginner: {
    criteria: 'beginner',
    humanRank: 'rank_10k',
    visits: 200,
    label: 'ผู้เริ่มต้น',
    hint: '20 คิว – 10 คิว',
  },
  intermediate: {
    criteria: 'intermediate',
    humanRank: 'rank_5k',
    visits: 300,
    label: 'ระดับกลาง',
    hint: '9 คิว – 1 ดั้ง',
  },
  advanced: {
    criteria: 'advanced',
    humanRank: 'rank_1d',
    visits: 800,
    label: 'ระดับสูง',
    hint: '2 ดั้ง ขึ้นไป',
  },
}

exports.defaultLevel = 'intermediate'

// Downloaded on first run rather than shipped: together these are some 190 MB,
// most of it a neural network updated independently of this app.
//
// OpenCL rather than TensorRT, because TensorRT needs CUDA installed as well;
// v1.17.1 rather than the newest, because 1.17.2 is a TensorRT-only bugfix and
// ships no OpenCL build at all.
exports.downloads = [
  {
    name: 'KataGo',
    url: 'https://github.com/lightvector/KataGo/releases/download/v1.17.1/katago-v1.17.1-opencl-windows-x64.zip',
    file: 'katago.zip',
    extract: true,
    platform: 'win32',
    approximateBytes: 5.3e6,
  },
  {
    name: 'โมเดลวิเคราะห์',
    url: 'https://media.katagotraining.org/uploaded/networks/models/kata1/kata1-b18c384nbt-s9191485440-d4104563973.bin.gz',
    file: 'models/kata1-b18c384nbt.bin.gz',
    approximateBytes: 93e6,
  },
  {
    // Everything else works without this one, but it is what lets the coach
    // separate a mistake the whole rank makes from a slip of one player.
    name: 'โมเดลผู้เล่นระดับต่าง ๆ',
    url: 'https://github.com/lightvector/KataGo/releases/download/v1.15.0/b18c384nbt-humanv0.bin.gz',
    file: 'models/b18c384nbt-humanv0.bin.gz',
    approximateBytes: 95e6,
  },
]

/**
 * The KataGo .cfg, generated rather than shipped.
 *
 * KataGo does not default these: it refuses to start with "Could not find key
 * ... in config file" for any of them that is missing, so the list is the
 * minimum that actually runs rather than only the settings we care about.
 * Everything level-dependent is at the bottom.
 */
exports.gtpConfigContents = function (level) {
  let preset = exports.levelPresets[level] ?? exports.levelPresets.intermediate

  return [
    '# สร้างโดย Coach Go — แก้ได้ แต่จะถูกเขียนทับเมื่อตั้งระดับใหม่',
    '',
    'logDir = gtp_logs',
    'logAllGTPCommunication = true',
    'logSearchInfo = true',
    'logSearchInfoForChosenMove = false',
    'logToStderr = false',
    '',
    'rules = japanese',
    'allowResignation = true',
    'resignThreshold = -0.90',
    'resignConsecTurns = 3',
    '',
    'ponderingEnabled = false',
    'maxTimePondering = 60.0',
    'lagBuffer = 1.0',
    'searchFactorAfterOnePass = 0.50',
    'searchFactorAfterTwoPass = 0.25',
    'searchFactorWhenWinning = 0.40',
    'searchFactorWhenWinningThreshold = 0.95',
    '',
    `# ความลึกของการค้น ตั้งตามระดับ ${preset.label}`,
    `maxVisits = ${preset.visits}`,
    'numSearchThreads = 8',
    '',
    '# ระดับฝีมือที่โมเดล HumanSL เลียนแบบ',
    `humanSLProfile = ${preset.humanRank}`,
    '',
  ].join('\n')
}
