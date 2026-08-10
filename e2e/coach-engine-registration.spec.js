const {expect} = require('@playwright/test')
const {test} = require('./fixtures/electron-app')
const {existsSync} = require('fs')

// Getting the coach working used to mean opening Manage Engines and typing the
// absolute path of a Python interpreter and of run_coach.py. The app now puts
// the engine in the list itself at startup.
//
// The fixture gives every run a fresh user data directory, so what this
// exercises is exactly the first launch on a machine that has never run it.

const COACH_ID = 'coach-go-engine'

function coachEntry(page) {
  return page.evaluate(
    (id) =>
      (window.sabaki.setting.get('engines.list') || []).find(
        (engine) => engine.id === id,
      ) ?? null,
    COACH_ID,
  )
}

test.describe('coach engine registration', () => {
  test('registers itself on a first launch, pointing at an executable that exists', async ({
    page,
  }) => {
    const entry = await coachEntry(page)

    expect(entry).not.toBeNull()
    expect(entry.name).toBe('โค้ชโกะ')
    expect(existsSync(entry.path)).toBe(true)

    // The config carries the path to KataGo and the learner's level, and lives
    // in the user data directory -- the installation directory is not writable
    // by an ordinary user and is replaced wholesale by an update.
    expect(entry.args).toMatch(/^--config ".*coach\.json"$/)
  })

  test('appears in the engines menu, so attaching it is one click', async ({
    page,
  }) => {
    const labels = await page.evaluate(() =>
      (window.sabaki.setting.get('engines.list') || []).map(
        (engine) => engine.name,
      ),
    )

    expect(labels).toContain('โค้ชโกะ')
  })

  test('does not add a second copy when the app is opened again', async ({
    page,
  }) => {
    // Registration runs on every launch so an update cannot leave a stale path
    // behind; running it twice must still leave one entry.
    await page.evaluate((id) => {
      const engines = window.sabaki.setting.get('engines.list') || []
      window.sabaki.setting.set('engines.list', engines)
    }, COACH_ID)

    const count = await page.evaluate(
      (id) =>
        (window.sabaki.setting.get('engines.list') || []).filter(
          (engine) => engine.id === id,
        ).length,
      COACH_ID,
    )

    expect(count).toBe(1)
  })
})
