const nativeRequire = eval('require')

const {readFileSync} = require('fs')
const path = require('path')
const {load: dolmLoad, getKey: dolmGetKey} = require('dolm')
const languages = require('@sabaki/i18n')

// Thai ships with this fork rather than with @sabaki/i18n, so it is registered
// here instead of coming from the package index. It is required directly rather
// than read from disk like the packaged languages: a static require is resolved
// by webpack in the renderer and by Node in the main process, which spares us
// from working out where the file ended up in either.
const localLanguages = {
  th: {
    name: 'Thai',
    nativeName: 'ไทย',
    strings: require('../i18n/th.i18n.js'),
  },
}

for (let lang in localLanguages) {
  let count = Object.values(localLanguages[lang].strings).reduce(
    (sum, category) => sum + Object.keys(category).length,
    0,
  )

  // Reported as complete because test/i18nThTests.js fails the build if any
  // interface string is missing from the file.
  localLanguages[lang].stats = {
    totalStringsCount: count,
    translatedStringsCount: count,
    progress: 1,
    unusedFlags: 0,
  }
}

const allLanguages = Object.assign({}, languages, localLanguages)

const isElectron = process.versions.electron != null
const isRenderer = typeof window !== 'undefined' && window.sabaki != null

// Only require electron in Electron environment
let ipcMain = null
if (isElectron && !isRenderer) {
  try {
    ipcMain = require('electron').ipcMain
  } catch (e) {
    // Not in Electron environment
  }
}

const setting = isRenderer
  ? {get: (key) => window.sabaki.setting.get(key)}
  : isElectron
    ? nativeRequire('./setting')
    : null

function getKey(input, params = {}) {
  let key = dolmGetKey(input, params)
  return key.replace(/&(?=\w)/g, '')
}

const dolm = dolmLoad({}, getKey)

let appLang = setting == null ? undefined : setting.get('app.lang')

exports.getKey = getKey
exports.t = dolm.t
exports.context = dolm.context

exports.formatNumber = function (num) {
  return new Intl.NumberFormat(appLang).format(num)
}

exports.formatMonth = function (month) {
  let date = new Date()
  date.setMonth(month)
  return date.toLocaleString(appLang, {month: 'long'})
}

exports.formatWeekday = function (weekday) {
  let date = new Date(2020, 2, 1 + (weekday % 7))
  return date.toLocaleString(appLang, {weekday: 'long'})
}

exports.formatWeekdayShort = function (weekday) {
  let date = new Date(2020, 2, 1 + (weekday % 7))
  return date.toLocaleString(appLang, {weekday: 'short'})
}

function loadStrings(strings) {
  dolm.load(strings)

  if (isElectron && !isRenderer && ipcMain) {
    ipcMain.emit('build-menu')
  }
}

exports.loadFile = function (filename) {
  try {
    loadStrings(
      Function(`
        "use strict"

        let exports = {}
        let module = {exports}

        ;(() => (${readFileSync(filename, 'utf8')}))()

        return module.exports
      `)(),
    )
  } catch (err) {
    loadStrings({})
  }
}

exports.loadLang = function (lang) {
  appLang = lang

  let local = localLanguages[lang]
  if (local != null) {
    loadStrings(local.strings)
    return
  }

  exports.loadFile(languages[lang].filename)
}

exports.getLanguages = function () {
  return allLanguages
}

if (appLang != null) {
  exports.loadLang(appLang)
}
