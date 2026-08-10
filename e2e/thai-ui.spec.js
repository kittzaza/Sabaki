const {expect} = require('@playwright/test')
const {test} = require('./fixtures/electron-app')
const {waitForRender} = require('./helpers')

// The interface of this fork opens in Thai. The language file itself is checked
// key by key in test/i18nThTests.js; what that cannot show is whether the
// strings reach the screen -- a language registered but never loaded, or a key
// written with its '&' accelerator still attached, leaves the interface
// silently in English with every unit test still passing.

const THAI = /[฀-๿]/

async function openDrawer(page, name) {
  await page.evaluate((drawer) => {
    window.__sabaki.setState({openDrawer: drawer})
  }, name)
  await waitForRender(page)
}

async function closeDrawer(page) {
  await page.evaluate(() => window.__sabaki.closeDrawer())
  await waitForRender(page)
}

test.describe('Thai interface', () => {
  test('opens in Thai without anything being selected first', async ({
    page,
  }) => {
    const lang = await page.evaluate(() =>
      window.sabaki.setting.get('app.lang'),
    )
    expect(lang).toBe('th')

    // The bar under the board is the one piece of interface always on screen.
    const barText = await page.textContent('#bar')
    expect(barText).toMatch(THAI)
    expect(barText).not.toMatch(/\b(Pass|Resign|Score|Edit|Find)\b/)
  })

  // Menu labels are the largest group of strings and the only ones written with
  // an accelerator marker ('&File'). The marker is stripped before lookup, so a
  // language file that kept it would leave the whole menu bar in English -- and
  // the menu lives in the main process, where no renderer assertion can see it.
  test('builds the menu bar in Thai', async ({electronApp}) => {
    const labels = await electronApp.evaluate(({Menu}) => {
      const menu = Menu.getApplicationMenu()
      if (menu == null) return null

      const collect = (items) =>
        items.flatMap((item) => [
          item.label,
          ...(item.submenu ? collect(item.submenu.items) : []),
        ])

      return collect(menu.items).filter(Boolean)
    })

    expect(labels).not.toBeNull()
    expect(labels).toContain('ไฟล์')
    expect(labels).toContain('ผ่านตา')
    expect(labels).toContain('แสดงแผงโค้ช')
    expect(
      labels.filter((label) => /^(File|Edit|View|Help)$/.test(label)),
    ).toEqual([])
  })

  test('interpolates parameterised strings instead of printing the pattern', async ({
    page,
  }) => {
    await openDrawer(page, 'info')

    const options = await page.locator('#info select option').allTextContents()
    const handicap = options.filter((text) => /\d/.test(text))

    expect(handicap.some((text) => text.includes('หมาก'))).toBe(true)
    expect(options.every((text) => !text.includes('${'))).toBe(true)

    await closeDrawer(page)
  })

  test('offers Thai in the preferences alongside the packaged languages', async ({
    page,
  }) => {
    await openDrawer(page, 'preferences')

    const options = await page
      .locator('#preferences select option')
      .allTextContents()
    expect(options.some((text) => text.includes('ไทย'))).toBe(true)

    // Labels in the same drawer come from the language file too.
    const drawerText = await page.textContent('#preferences')
    expect(drawerText).toMatch(THAI)

    await closeDrawer(page)
  })
})
