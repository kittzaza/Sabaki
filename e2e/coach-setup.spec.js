const {expect} = require('@playwright/test')
const {test} = require('./fixtures/electron-app')
const {waitForRender} = require('./helpers')
const {existsSync, readFileSync} = require('fs')
const {join} = require('path')

// The first-run setup screen. Every run gets a fresh user data directory from
// the fixture, so this is the real first launch on a machine that has never had
// the coach set up.
//
// The KataGo install on the development machine stands in for one the user
// already has; the download path cannot be exercised here without pulling
// nearly 200 MB, and is left to a manual run.
const EXISTING_KATAGO = 'C:/Users/ACER/Downloads/ClaudeAI/katago'

test.describe('coach setup', () => {
  test('opens by itself when the coach has never been set up', async ({
    page,
  }) => {
    await page.waitForFunction(
      () => window.__sabaki.state.openDrawer === 'coachsetup',
      undefined,
      {timeout: 10000},
    )
    await waitForRender(page)

    const text = await page.textContent('#coachsetup')
    expect(text).toMatch(/[฀-๿]/)

    // The one question that cannot be worked out for the learner.
    const levels = await page.locator('#coachsetup .levels .level').count()
    expect(levels).toBe(3)
  })

  test('reports that KataGo is missing before anything is downloaded', async ({
    page,
  }) => {
    const status = await page.evaluate(() => window.sabaki.coach.getStatus())

    expect(status.ready).toBe(false)
    expect(status.katagoPath).toBeNull()
    expect(status.level).toBeNull()
  })

  test('writes a working config from a level and an existing KataGo folder', async ({
    page,
  }) => {
    test.skip(
      !existsSync(join(EXISTING_KATAGO, 'katago.exe')),
      'no local KataGo to point at',
    )

    const configPath = await page.evaluate(
      (directory) => window.sabaki.coach.write({level: 'advanced', directory}),
      EXISTING_KATAGO,
    )

    expect(existsSync(configPath)).toBe(true)
    const config = JSON.parse(readFileSync(configPath, 'utf8'))

    // The level has to reach both places it means something: the coach's
    // grading thresholds, and the rank the human model imitates.
    expect(config.coach.criteria_profile).toBe('advanced')
    expect(config.coach.human_profile).toBe('rank_1d')
    expect(existsSync(config.backend.command)).toBe(true)

    // -model and -config are what KataGo cannot start without.
    const modelIndex = config.backend.args.indexOf('-model')
    expect(modelIndex).toBeGreaterThan(-1)
    expect(existsSync(config.backend.args[modelIndex + 1])).toBe(true)

    const gtpIndex = config.backend.args.indexOf('-config')
    const gtpConfig = readFileSync(config.backend.args[gtpIndex + 1], 'utf8')
    expect(gtpConfig).toMatch(/maxVisits = 800/)
    expect(gtpConfig).toMatch(/humanSLProfile = rank_1d/)

    const status = await page.evaluate(() => window.sabaki.coach.getStatus())
    expect(status.ready).toBe(true)
    expect(status.level).toBe('advanced')
  })

  test('refuses to write a config pointing at a folder without KataGo', async ({
    page,
  }) => {
    // A config written anyway would start an engine that dies later with a
    // stranger error than "there is no KataGo here".
    const error = await page.evaluate(async () => {
      try {
        await window.sabaki.coach.write({
          level: 'beginner',
          directory: 'C:/definitely/not/katago',
        })
        return null
      } catch (err) {
        return err.message
      }
    })

    expect(error).not.toBeNull()
    expect(error).toContain('KataGo')
  })
})
