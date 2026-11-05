import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

const screens = ['home', 'explore', 'cart', 'result', 'optimize', 'saved']
async function ready(page: Page, screen: string) {
  await expect(page.locator('main > section')).toHaveClass(new RegExp(`\\b${screen}-screen\\b`))
  await expect(page.locator('main')).toHaveCSS('opacity', '1')
}
async function horizontalDrag(page: Page, target: string) {
  const bounds = await page.locator(target).first().boundingBox()
  if (!bounds) return
  const x = bounds.x + bounds.width * .65, y = Math.max(100, Math.min(bounds.y + bounds.height * .45, page.viewportSize()!.height - 160))
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(Math.max(5, bounds.x + 4), y + 2, { steps: 14 })
  await page.mouse.up()
}
async function touchSwipe(page: Page, from: [number, number], to: [number, number]) {
  const session = await page.context().newCDPSession(page)
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from[0], y: from[1] }] })
  for (let i = 1; i <= 10; i++) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from[0] + (to[0] - from[0]) * i / 10, y: from[1] + (to[1] - from[1]) * i / 10 }] })
    // This interval is the actual gesture speed, not an application loading wait.
    await page.waitForTimeout(18)
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await session.detach()
}
async function assertBounds(page: Page) {
  const geometry = await page.evaluate(() => {
    const shell = document.querySelector('.app-shell')!.getBoundingClientRect()
    const fixed = [...document.querySelectorAll('.bottom-nav, .cart-bottom-action, .detail-bottom-action')].map(element => {
      const box = element.getBoundingClientRect()
      const transformedAncestors: string[] = []
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        if (getComputedStyle(parent).transform !== 'none') transformedAncestors.push(parent.tagName)
      }
      return { x: box.x, right: box.right, bottom: box.bottom, transformedAncestors }
    })
    return { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollX, shellX: shell.x, shellRight: shell.right, fixed }
  })
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width)
  expect(geometry.scrollX).toBe(0)
  expect(geometry.shellX).toBeGreaterThanOrEqual(0)
  expect(geometry.shellRight).toBeLessThanOrEqual(geometry.width)
  for (const item of geometry.fixed) {
    expect(item.x).toBeGreaterThanOrEqual(geometry.shellX - 1)
    expect(item.right).toBeLessThanOrEqual(geometry.shellRight + 1)
    expect(item.bottom).toBeLessThanOrEqual(geometry.height + 1)
    expect(item.transformedAncestors).toEqual([])
  }
}

for (const viewport of [{ width: 390, height: 844 }, { width: 375, height: 667 }, { width: 320, height: 568 }, { width: 1440, height: 900 }]) {
  test.describe(`드래그·스와이프 ${viewport.width}x${viewport.height}`, () => {
    const mobile = viewport.width < 600
    test.use({ viewport, isMobile: mobile, hasTouch: mobile })
    test('화면별 마우스 드래그, 실제 터치, 세로 스크롤과 전환 안정성', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      await page.addInitScript(() => localStorage.setItem('fitmate.cart.v1', JSON.stringify(['P01', 'P06', 'P08'].map(productId => ({ productId, quantity: 1 })))))
      await page.addInitScript(() => localStorage.setItem('fitmate.intro.seen.v1', 'true'))
      await page.goto('/')
      for (const screen of screens) {
        await page.goto('/#' + screen)
        await ready(page, screen)
        await assertBounds(page)
        if (screen === 'home') {
          const button = await page.locator('.recommendation').first().boundingBox()
          const nav = await page.locator('.bottom-nav').boundingBox()
          expect(button!.y).toBeLessThan(nav!.y)
        }
        const shell = await page.locator('.app-shell').boundingBox()
        await horizontalDrag(page, screen === 'home' ? '.recommendation img' : 'main h1')
        if (await page.locator('.product-image img').count()) await horizontalDrag(page, '.product-image img')
        await expect(page.getByRole('dialog')).toHaveCount(0)
        if (mobile) {
          await touchSwipe(page, [viewport.width - 35, 240], [25, 243])
          await touchSwipe(page, [25, 240], [viewport.width - 35, 243])
        } else {
          await page.mouse.move(shell!.x + shell!.width / 2, 300)
          await page.mouse.wheel(320, 0)
        }
        await assertBounds(page)
        // A real vertical gesture must still scroll longer screens.
        if (screen === 'explore' || screen === 'result' || screen === 'optimize') {
          const canScroll = await page.evaluate(() => {
            const element = matchMedia('(min-width: 600px)').matches ? document.querySelector('.app-shell')! : document.documentElement
            return element.scrollHeight > element.clientHeight
          })
          if (mobile) await touchSwipe(page, [viewport.width / 2, viewport.height - 180], [viewport.width / 2, 170])
          else {
            // End the preceding horizontal trackpad gesture before starting a
            // distinct vertical gesture; Chromium otherwise keeps its wheel axis latch.
            await page.waitForTimeout(500)
            await page.mouse.move(shell!.x + shell!.width / 2, 450)
            await page.mouse.wheel(0, 400)
          }
          if (canScroll) await expect.poll(() => page.evaluate(() => matchMedia('(min-width: 600px)').matches ? document.querySelector('.app-shell')!.scrollTop : scrollY)).toBeGreaterThan(0)
          await assertBounds(page)
        }
      }
      await page.goto('/#explore')
      await ready(page, 'explore')
      if (mobile) {
        const chips = page.locator('.category-list')
        const box = await chips.boundingBox()
        const canScroll = await chips.evaluate(element => element.scrollWidth > element.clientWidth)
        if (canScroll) {
          await touchSwipe(page, [viewport.width - 40, box!.y + box!.height / 2], [30, box!.y + box!.height / 2])
          await expect.poll(() => chips.evaluate(element => element.scrollLeft)).toBeGreaterThan(0)
        }
      }
      await assertBounds(page)
      await page.getByRole('navigation').getByRole('button', { name: /조합함/ }).click()
      await ready(page, 'cart')
      // Observe every animation frame, including the short screen entry window.
      const frames = await page.evaluate(async () => {
        const samples: { transform: string; bottom: number }[] = []
        location.hash = 'optimize'
        const started = performance.now()
        while (performance.now() - started < 600) {
          await new Promise(requestAnimationFrame)
          const footer = document.querySelector('.detail-bottom-action')
          if (footer) samples.push({ transform: getComputedStyle(document.querySelector('main')!).transform, bottom: footer.getBoundingClientRect().bottom })
        }
        return samples
      })
      expect(frames.length).toBeGreaterThan(0)
      expect(frames.every(frame => frame.transform === 'none' && frame.bottom <= viewport.height + 1)).toBe(true)
      await ready(page, 'optimize')
      await assertBounds(page)
      await page.screenshot({ path: `docs/qa/layout-${viewport.width}x${viewport.height}.png` })
      expect(errors).toEqual([])
    })
  })
}

test('제품 이미지는 HTML 기본 드래그를 시작하지 않음', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('fitmate.intro.seen.v1', 'true'))
  await page.goto('/')
  await expect(page.locator('.recommendation img').first()).toHaveAttribute('draggable', 'false')
  await page.goto('/#explore')
  await expect(page.locator('.product-image img').first()).toHaveAttribute('draggable', 'false')
})
