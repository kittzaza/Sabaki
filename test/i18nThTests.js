import assert from 'assert'
import {createRequire} from 'module'

import {translateShape} from '../src/modules/coachshapes.js'

const require = createRequire(import.meta.url)

// i18n/en.i18n.js is extracted from this source tree by `npm run i18n`, and is
// the list of strings the code actually asks for. The @sabaki/i18n package is
// not usable here: it is published from upstream and lags this fork, so
// checking against it passed while 'Analysis data' sat untranslated on screen.
// Regenerate it after adding or changing any interface string.
const en = require('../i18n/en.i18n.js')
const th = require('../i18n/th.i18n.js')
const boardmatcherLibrary = require('@sabaki/boardmatcher/library')

// Left in English on purpose: file format names, proper nouns, and "engine",
// which the coach panel already says in English -- translating it here would
// give the same thing two names in one window.
const keptAsIs = new Set([
  '1-1',
  'Tygem GIB',
  'wBaduk NGF',
  'Smart Game Format (SGF)',
  'PandaNET UGF',
  'Sabaki Themes',
  'GitHub Repository',
  'Homepage',
  'Engine',
  'engine',
])

function sampleParams(key) {
  return Object.fromEntries(
    [...key.matchAll(/\$\{(\w+)\}/g)].map((m) => [m[1], 'X']),
  )
}

describe('Thai language file', () => {
  it('translates every string the interface asks for', () => {
    let missing = []

    for (let category in en) {
      for (let key in en[category]) {
        if (th[category] == null || th[category][key] === undefined) {
          missing.push(`${category} / ${key}`)
        }
      }
    }

    assert.deepStrictEqual(missing, [])
  })

  // A key written with its accelerator ('&Save') never matches, because
  // i18n.getKey strips the marker before looking the string up -- and the
  // failure is silent, showing English where Thai was written.
  it('carries no leftover menu accelerator markers in its keys', () => {
    let withMarker = []

    for (let category in th) {
      for (let key in th[category]) {
        if (key.includes('&')) withMarker.push(`${category} / ${key}`)
      }
    }

    assert.deepStrictEqual(withMarker, [])
  })

  // A string that no longer exists in the code is not harmless: it is a
  // translation nobody will ever see, kept in step with wording that has moved
  // on, and it hides the fact that its replacement may be missing.
  it('has no key that belongs to no part of the interface', () => {
    let extra = []

    for (let category in th) {
      if (category === 'boardmatcher') continue

      for (let key in th[category]) {
        if (en[category] == null || !(key in en[category])) {
          extra.push(`${category} / ${key}`)
        }
      }
    }

    assert.deepStrictEqual(extra, [])
  })

  // Written as a plain string, a parameterised entry would show the user
  // '${appName}' verbatim.
  it('renders every parameterised string as a function', () => {
    let broken = []

    for (let category in th) {
      for (let key in th[category]) {
        if (!key.includes('${')) continue

        let value = th[category][key]
        if (typeof value !== 'function') {
          broken.push(`${category} / ${key}: not a function`)
          continue
        }

        let output = value(sampleParams(key))
        if (typeof output !== 'string' || output.includes('${')) {
          broken.push(`${category} / ${key}: ${output}`)
        }
      }
    }

    assert.deepStrictEqual(broken, [])
  })

  it('leaves nothing sitting in English', () => {
    let untranslated = []

    for (let category in th) {
      for (let key in th[category]) {
        let value = th[category][key]
        if (typeof value !== 'string') continue
        if (keptAsIs.has(value)) continue
        if (!/[ก-๙]/.test(value)) untranslated.push(`${category} / ${key}`)
      }
    }

    assert.deepStrictEqual(untranslated, [])
  })
})

describe('Thai shape names', () => {
  it('names every shape the matcher can report', () => {
    let missing = boardmatcherLibrary
      .map((pattern) => pattern.name)
      .filter((name) => th.boardmatcher[name] === undefined)

    assert.deepStrictEqual([...new Set(missing)], [])
  })

  // The coach panel reads its shape names from coachshapes.js rather than from
  // the language file, because the coach speaks Thai whatever the interface
  // language is -- Thai sentences with English shape names in them would be
  // worse than either. The two therefore have to agree, and nothing but this
  // test would notice if they drifted apart.
  it('agrees with the names the coach panel uses', () => {
    let disagreements = []

    for (let name in th.boardmatcher) {
      let panelName = translateShape(name)
      // Names only the interface knows (Pass, Atari …) never reach the panel.
      if (panelName === name) continue

      if (panelName !== th.boardmatcher[name]) {
        disagreements.push(`${name}: ${panelName} / ${th.boardmatcher[name]}`)
      }
    }

    assert.deepStrictEqual(disagreements, [])
  })
})
