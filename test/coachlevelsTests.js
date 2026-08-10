import assert from 'assert'
import {existsSync, readFileSync} from 'fs'
import {createRequire} from 'module'
import {dirname, join} from 'path'
import {fileURLToPath} from 'url'

const require = createRequire(import.meta.url)
const {
  levelPresets,
  defaultLevel,
  downloads,
  gtpConfigContents,
} = require('../src/coachlevels.js')

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// The coach engine is a separate program in a sibling checkout, and its grading
// profiles are the thing these presets have to agree with. Read from the source
// rather than copied here, so the two cannot quietly drift apart.
const coachSource = join(
  root,
  '..',
  'Project_Thai_Go_AI_Coach',
  'coach_engine',
  'coach.py',
)

function pythonProfiles() {
  if (!existsSync(coachSource)) return null

  let source = readFileSync(coachSource, 'utf8')
  let profiles = {}

  for (let match of source.matchAll(
    /name="(\w+)",[\s\S]*?min_visits=(\d+),\s*delta_min_visits=(\d+),/g,
  )) {
    profiles[match[1]] = {
      minVisits: Number(match[2]),
      deltaMinVisits: Number(match[3]),
    }
  }

  return Object.keys(profiles).length > 0 ? profiles : null
}

describe('coach level presets', () => {
  it('offers a level for every grading profile the coach engine has', function () {
    let profiles = pythonProfiles()
    if (profiles == null) this.skip()

    assert.deepStrictEqual(
      Object.keys(levelPresets).sort(),
      Object.keys(profiles).sort(),
    )
  })

  it('names a grading profile that exists on the engine side', function () {
    let profiles = pythonProfiles()
    if (profiles == null) this.skip()

    for (let [level, preset] of Object.entries(levelPresets)) {
      assert.ok(
        profiles[preset.criteria] != null,
        `${level} asks for criteria "${preset.criteria}", which the engine does not have`,
      )
    }
  })

  // The coach only judges a move once the search is deep enough to be believed.
  // A search budget below that threshold means the engine can never reach it,
  // and the learner gets a coach that says nothing at all -- which looks like a
  // broken install, not like a setting being wrong.
  it('searches deeper than the depth the engine insists on before judging', function () {
    let profiles = pythonProfiles()
    if (profiles == null) this.skip()

    for (let [level, preset] of Object.entries(levelPresets)) {
      let profile = profiles[preset.criteria]

      assert.ok(
        preset.visits >= profile.deltaMinVisits,
        `${level}: searches ${preset.visits} but ${preset.criteria} needs ${profile.deltaMinVisits}`,
      )
    }
  })

  it('has a default that is one of the levels', () => {
    assert.ok(levelPresets[defaultLevel] != null)
  })
})

describe('generated KataGo config', () => {
  it('sets the search depth and the imitated rank for the chosen level', () => {
    let config = gtpConfigContents('advanced')

    assert.match(config, /maxVisits = 800/)
    assert.match(config, /humanSLProfile = rank_1d/)
  })

  it('falls back to the default level rather than writing a broken file', () => {
    let config = gtpConfigContents('ระดับที่ไม่มีอยู่')
    let preset = levelPresets[defaultLevel]

    assert.match(config, new RegExp(`maxVisits = ${preset.visits}`))
    assert.match(config, new RegExp(`humanSLProfile = ${preset.humanRank}`))
  })
})

describe('KataGo downloads', () => {
  it('fetches over https only', () => {
    for (let step of downloads) {
      assert.ok(step.url.startsWith('https://'), step.url)
    }
  })

  it('gives every download a Thai name and a destination', () => {
    for (let step of downloads) {
      assert.ok(step.name.length > 0, step.url)
      assert.ok(step.file.length > 0, step.url)
      // Relative, so nothing can be written outside the app's own directory.
      assert.ok(!step.file.startsWith('/') && !step.file.includes('..'))
    }
  })
})
