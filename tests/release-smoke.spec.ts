import { expect, test, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const captureDirectory = process.env.PLAYWRIGHT_BASE_URL ? 'artifacts/release/production' : 'artifacts/release/local'

async function screenshot(page: Page, name: string) {
  await ready(page)
  await mkdir(captureDirectory, { recursive: true })
  await page.screenshot({ path: `${captureDirectory}/${name}.png` })
}

async function ready(page: Page) {
  await expect(page.locator('main')).toHaveCSS('opacity', '1')
  await page.evaluate(() => document.fonts.ready)
}

test('A–D: 실제 탐색 → 88/R06 → 규칙 설명 → P01 교체/100 → 저장·복원', async ({ page }) => {
  const errors: string[] = []
  let apiCalls = 0
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/explain', route => { apiCalls++; return route.abort() })
  await page.goto('/')
  await expect(page.locator('.intro-overlay')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => localStorage.getItem('fitmate.intro.seen.v1'))).toBe('true')
  await ready(page)
  await screenshot(page, 'home-390x844')
  await page.getByRole('searchbox', { name: '홈 제품 또는 성분 검색' }).fill('프로틴 B')
  await page.getByRole('button', { name: '검색하기', exact: true }).click()
  await expect(page.locator('.category-list button')).toHaveCount(9)
  await page.getByRole('button', { name: /^프로틴 B 조합함에 추가/ }).click()
  await page.getByRole('button', { name: '복용약 확인', exact: true }).click()
  await page.getByRole('searchbox').fill('레보티록신')
  await page.getByRole('button', { name: /^레보티록신 경구제 조합함에 추가/ }).click()
  await page.getByRole('navigation').getByRole('button', { name: /조합함/ }).click()
  await expect(page.locator('.score-value > span').first()).toHaveText('88')
  await expect(page.locator('.cart-score-facts')).toContainText('1건')
  await screenshot(page, 'cart-88-390x844')
  await page.getByRole('button', { name: '상세 정보 확인', exact: true }).click()
  const details = page.getByRole('dialog', { name: '조합 상세 정보' })
  await expect(details.locator('.rule-detail')).toContainText('R06')
  await expect(details.locator('.evidence-links a').first()).toHaveAttribute('href', /^https:/)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: '점수 계산 과정을 알려주세요' }).click()
  await expect(page.locator('.rule-answer')).toContainText('88점')
  await expect(page.locator('.rule-answer')).toContainText('AI 생성 아님')
  await expect(page.locator('.rule-answer')).toContainText('R06')
  expect(apiCalls).toBe(0)
  await page.getByRole('button', { name: '최적화 분석', exact: true }).click()
  await expect(page.getByTestId('before-score')).toHaveText('88점')
  await page.getByLabel('변경할 제품', { exact: true }).selectOption('P01')
  await expect(page.getByTestId('after-score')).toHaveText('100점')
  await screenshot(page, 'optimize-390x844')
  await page.getByRole('button', { name: '변경 후 조합 확인하기' }).click()
  await expect(page.locator('.score-value > span').first()).toHaveText('100')
  await expect(page.locator('.change-confirmation')).toContainText('프로틴 B → 프로틴 A')
  await page.getByRole('button', { name: '변경한 조합 저장하기' }).click()
  await page.getByRole('button', { name: '조합함으로 돌아가기' }).click()
  await page.getByRole('navigation').getByRole('button', { name: '내 정보', exact: true }).click()
  await expect(page.locator('.saved-row')).toHaveCount(1)
  await screenshot(page, 'saved-390x844')
  await page.getByRole('button', { name: '조합 불러오기' }).click()
  await page.reload()
  await expect(page.locator('.cart-row h2')).toHaveText(['프로틴 A', '레보티록신 경구제'])
  await expect(page.locator('.score-value > span').first()).toHaveText('100')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('fitmate.cart.v1')!))).toEqual([
    { productId: 'P01', quantity: 1 }, { productId: 'M02', quantity: 1 },
  ])
  expect(errors).toEqual([])
})

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test.describe(`레이아웃 ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 })
    test('6개 화면·이미지·고정 버튼·드래그·감소 모션', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      await page.addInitScript(() => {
        localStorage.setItem('fitmate.intro.seen.v1', 'true')
        localStorage.setItem('fitmate.cart.v1', JSON.stringify([{ productId: 'P02', quantity: 1 }, { productId: 'M02', quantity: 1 }]))
      })
      for (const screen of ['home', 'explore', 'cart', 'result', 'optimize', 'saved']) {
        await page.goto('/#' + screen)
        await expect(page.locator(`.${screen}-screen`)).toBeVisible()
        await ready(page)
        const geometry = await page.evaluate(() => {
          const nav = document.querySelector('.bottom-nav')?.getBoundingClientRect()
          const fixed = [...document.querySelectorAll('.cart-bottom-action, .detail-bottom-action')].map(el => {
            const r = el.getBoundingClientRect()
            return { left: r.left, right: r.right, bottom: r.bottom }
          })
          return { overflow: document.documentElement.scrollWidth > innerWidth, x: scrollX, navTop: nav?.top, fixed }
        })
        expect(geometry.overflow).toBe(false)
        expect(geometry.x).toBe(0)
        for (const box of geometry.fixed) {
          expect(box.left).toBeGreaterThanOrEqual(0)
          expect(box.right).toBeLessThanOrEqual(viewport.width)
          expect(box.bottom).toBeLessThanOrEqual(geometry.navTop ?? viewport.height)
        }
        await expect(page.locator('main')).toHaveCSS('transform', 'none')
        await expect.poll(() => page.locator('img').evaluateAll(images => images.every(img => img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0))).toBe(true)
        if (screen === 'explore') {
          const image = page.locator('.product-image-button').first()
          const box = (await image.boundingBox())!
          await page.mouse.move(box.x + box.width * .8, box.y + box.height / 2)
          await page.mouse.down()
          await page.mouse.move(box.x + 3, box.y + box.height / 2, { steps: 10 })
          await page.mouse.up()
          await expect(page.getByRole('dialog')).toHaveCount(0)
          if (viewport.width < 600) {
            const session = await page.context().newCDPSession(page)
            const chips = (await page.locator('.category-list').boundingBox())!
            const y = chips.y + chips.height / 2
            await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 345, y }] })
            for (let i = 1; i <= 10; i++) {
              await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 345 - i * 28, y }] })
              await page.waitForTimeout(18)
            }
            await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
            await session.detach()
            await expect.poll(() => page.locator('.category-list').evaluate(el => el.scrollLeft)).toBeGreaterThan(0)
            expect(await page.evaluate(() => scrollX)).toBe(0)
          }
        }
        await screenshot(page, `${screen}-${viewport.width}x${viewport.height}`)
      }
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto('/#optimize')
      await expect(page.getByTestId('after-score')).toHaveText('100점')
      expect(errors).toEqual([])
    })
  })
}
