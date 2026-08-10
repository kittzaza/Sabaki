const path = require('path')
const {spawnSync} = require('child_process')
const {readFileSync, writeFileSync} = require('fs')
const dolmTools = require('dolm/tools')
const boardmatcherLibrary = require('@sabaki/boardmatcher/library')

let codeGlobs = ['src/**/*.js']
let getKeyPath = path.resolve(__dirname, './dolmGetKey.js')
let defaultPath = path.resolve(__dirname, '../i18n/en.i18n.js')
let templatePath = path.resolve(__dirname, '../i18n/template.i18n.js')

// dolm is run through Node directly rather than through npx: spawnSync could
// not resolve npx.cmd on Windows, and since the result was never checked the
// script carried on and died later on a file dolm had never written.
let dolmCli = require.resolve('dolm/tools/cli/main.js')

let spawnDolmGen = (args) => {
  let result = spawnSync(
    process.execPath,
    [
      dolmCli,
      'gen',
      '--dolm-identifier',
      'i18n',
      '--get-key',
      getKeyPath,
      ...args,
    ],
    {
      stdio: 'inherit',
    },
  )

  if (result.error != null || result.status !== 0) {
    throw new Error(
      `dolm gen failed (${result.error ?? `exit ${result.status}`})`,
    )
  }

  return result
}

let boardmatcherStringsArr = [
  ...boardmatcherLibrary.map((pattern) => pattern.name),
  'Pass',
  'Take',
  'Atari',
  'Suicide',
  'Fill',
  'Connect',
  'Tengen',
  'Hoshi',
]

let boardmatcherStrings = {
  boardmatcher: Object.assign(
    {},
    ...boardmatcherStringsArr.map((str) => ({[str]: str})),
  ),
}

let boardmatcherStringsTemplate = {
  boardmatcher: Object.assign(
    {},
    ...boardmatcherStringsArr.map((str) => ({[str]: null})),
  ),
}

// Create default i18n file

spawnDolmGen(['-o', defaultPath, ...codeGlobs])

let defaultStrings = dolmTools.mergeStrings([
  dolmTools.safeModuleEval(readFileSync(defaultPath, 'utf8')),
  boardmatcherStrings,
])

writeFileSync(
  defaultPath,
  'module.exports = ' + dolmTools.serializeStrings(defaultStrings),
)

// Create template i18n file

spawnDolmGen(['-t', '-o', templatePath, ...codeGlobs])

let templateStrings = dolmTools.mergeStrings([
  dolmTools.safeModuleEval(readFileSync(templatePath, 'utf8')),
  boardmatcherStringsTemplate,
])

writeFileSync(
  templatePath,
  'module.exports = ' + dolmTools.serializeStrings(templateStrings),
)
