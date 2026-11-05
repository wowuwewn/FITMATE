import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

const viewports = [{ width: 320, height: 568 }, { width: 375, height: 667 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]
async function seed(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('fitmate.intro.seen.v1', 'true')
    if (!localStorage.getItem('fitmate.cart.v1')) localStorage.setItem('fitmate.cart.v1', JSON.stringify([{ productId: 'P02', quantity: 1 }, { productId: 'M02', quantity: 1 }]))
  })
}
async function geometry(page: Page) {
  expect(await page.evaluate(() => {
    const shell = document.querySelector('.app-shell')!
    return document.documentElement.scrollWidth <= innerWidth && shell.scrollWidth === shell.clientWidth && scrollX === 0
  })).toBe(true)
}
async function capture(page: Page, screen: string, path: string) {
  await expect(page.locator(`main > .${screen}-screen`)).toBeVisible()
  await expect(page.locator('main')).toHaveCSS('opacity', '1')
  await page.evaluate(() => document.fonts.ready)
  await page.locator('main img').evaluateAll(images => Promise.all(images.map(image => (image as HTMLImageElement).decode().catch(() => undefined))))
  await page.screenshot({ path })
}

test('최초 방문 인트로 자동 종료, 재방문 생략', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('dialog', { name: 'Fitmate 시작 안내' })).toBeVisible()
  await page.screenshot({ path: 'docs/qa/v3-intro.png' })
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 2500 })
  await expect(page.getByRole('heading', { name: /나의 영양 루틴/ })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('fitmate.intro.seen.v1'))).toBe('true')
  await page.reload()
  await expect(page.getByRole('heading', { name: /나의 영양 루틴/ })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('인트로를 즉시 건너뛰고 탐색할 수 있다', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '건너뛰기' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('searchbox').fill('칼슘')
  await page.getByRole('button', { name: '검색하기' }).click()
  await expect(page.getByRole('searchbox')).toHaveValue('칼슘')
  await expect(page.locator('.product-row h2')).toHaveText(['프로틴 B'])
  await page.getByRole('button', { name: '프로틴 B 상세 보기', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '제품 상세' })
  await expect(dialog).toContainText('칼슘')
  await expect(dialog).toContainText('함량 미등록')
  await dialog.getByRole('button', { name: '조합함에 추가', exact: true }).click()
  await expect(dialog.getByRole('button', { name: '조합함에 추가 · 현재 1개' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('navigation').getByRole('button', { name: /조합함/ }).click()
  await expect(page.locator('.cart-row h2')).toHaveText(['프로틴 B'])
  await expect(page.locator('.score-value > span').first()).toHaveText('—')
})

test('9개 카테고리의 실제 데이터, 빈 목록, 약물 분리 및 모든 목업 이미지', async ({ page }) => {
  await page.goto('/#explore')
  await expect(page.locator('.category-chip')).toHaveCount(9)
  const expected: [string, number][] = [['전체', 10], ['프로틴', 3], ['프로틴 스낵&식품', 0], ['크레아틴', 0], ['비타민&미네랄', 5], ['다이어트&커팅', 0], ['유산균', 0], ['지방산&오일', 0], ['식물&기능성 추출물', 0]]
  for (const [category, count] of expected) {
    await page.locator('.category-list').getByRole('button', { name: category, exact: true }).click()
    await expect(page.locator('.category-chip.active')).toHaveText(category)
    await expect(page.locator('.product-row')).toHaveCount(count)
    if (!count) await expect(page.getByRole('heading', { name: '아직 등록된 제품이 없어요' })).toBeVisible()
    await geometry(page)
  }
  await page.getByRole('button', { name: '전체', exact: true }).click()
  await page.locator('.product-row img, .category-image img').evaluateAll(images => Promise.all(images.map(image => (image as HTMLImageElement).decode())))
  expect(await page.locator('.product-row img, .category-image img').evaluateAll(images => images.every(image => (image as HTMLImageElement).naturalWidth > 0))).toBe(true)
  await expect(page.locator('.product-row img')).toHaveCount(10)
  await expect(page.locator('.missing-image')).toHaveCount(0)
  await page.getByRole('button', { name: '복용약 확인', exact: true }).click()
  await expect(page.locator('.category-list')).toHaveCount(0)
  await expect(page.locator('.product-row')).toHaveCount(7)
  await page.locator('.product-row img').evaluateAll(images => Promise.all(images.map(image => (image as HTMLImageElement).decode())))
  await expect(page.locator('.product-row img')).toHaveCount(7)
  await page.getByRole('searchbox').fill('레보티록신')
  await page.getByRole('button', { name: /^레보티록신 경구제 조합함에 추가/ }).click()
  await page.getByRole('navigation').getByRole('button', { name: /조합함/ }).click()
  await expect(page.locator('.cart-row h2')).toHaveText(['레보티록신 경구제'])
})

test('모션 감소 환경에서는 인트로 대기 없이 실제 점수를 표시한다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await seed(page)
  await page.goto('/#cart')
  await expect(page.getByRole('img', { name: /시연용 조합 비교 지표 88점/ })).toBeVisible()
  await expect(page.locator('.score-value > span').first()).toHaveText('88')
  await expect(page.locator('.analysis-overlay')).toHaveCount(0)
})

for (const viewport of viewports) {
  test.describe(`3차 UX ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 })
    test('홈 예시 → 즉시 분석 → 저장 → 내 정보 복원과 관리', async ({ page }) => {
      await seed(page)
      await page.goto('/#home')
      await page.getByRole('button', { name: '중복 성분 확인하기, 조합함에 적용' }).click()
      await expect(page.locator('.cart-row h2')).toHaveText(['종합비타민', '비타민 D'])
      await expect(page.locator('.score-value > span').first()).toHaveText('97')
      await expect(page.locator('.cart-score-facts')).toContainText('중복 성분 1개')
      await page.getByRole('button', { name: '조합 저장하기' }).click()
      await expect(page.getByRole('button', { name: '저장한 조합', exact: true })).toBeDisabled()
      await page.getByRole('button', { name: '종합비타민 삭제', exact: true }).click()
      await expect(page.locator('.score-value > span').first()).toHaveText('—')
      await page.getByRole('navigation').getByRole('button', { name: '내 정보' }).click()
      await expect(page.getByRole('heading', { name: '내 정보', exact: true })).toBeVisible()
      await expect(page.locator('.saved-row')).toHaveCount(1)
      await page.getByRole('button', { name: '조합 불러오기' }).click()
      await expect(page.locator('.score-value > span').first()).toHaveText('97')
      await page.reload()
      await expect(page.locator('.cart-row h2')).toHaveText(['종합비타민', '비타민 D'])
      await expect(page.locator('.score-value > span').first()).toHaveText('97')
      await geometry(page)
      await capture(page, 'cart', `docs/qa/v3-cart-${viewport.width}x${viewport.height}.png`)
      await page.getByRole('navigation').getByRole('button', { name: '내 정보' }).click()
      await page.getByText('점수 계산 방식', { exact: true }).click()
      await expect(page.locator('.service-information')).toContainText('demo-comparison-v1')
      await capture(page, 'saved', `docs/qa/v3-my-info-${viewport.width}x${viewport.height}.png`)
      await page.getByRole('button', { name: '나의 조합 1 삭제' }).click()
      await expect(page.locator('.saved-row')).toHaveCount(0)
    })

    test('점수 자동 갱신, 상세 근거, 패널 스크롤·닫기와 포커스 복원', async ({ page }) => {
      await seed(page)
      await page.goto('/#cart')
      await expect(page.locator('.score-value > span').first()).toHaveText('88')
      await page.getByRole('button', { name: '프로틴 B 수량 늘리기' }).click()
      await expect(page.locator('.cart-analysis-summary')).toContainText('3용기')
      await expect(page.locator('.score-value > span').first()).toHaveText('88')
      await page.getByRole('button', { name: '상세 정보 확인' }).click()
      const dialog = page.getByRole('dialog', { name: '조합 상세 정보' })
      await expect(dialog.locator('.rule-detail')).toContainText('R06')
      await expect(dialog.locator('.evidence-links a').first()).toHaveAttribute('href', /^https:/)
      await expect(dialog).toContainText('긍정적 상호작용 규칙이 등록되지 않아')
      const scrollBefore = await page.evaluate(() => ({ body: scrollY, shell: document.querySelector('.app-shell')!.scrollTop }))
      await dialog.locator('.sheet-content').evaluate(element => element.scrollTo(0, element.scrollHeight))
      await expect.poll(() => dialog.locator('.sheet-content').evaluate(element => element.scrollTop)).toBeGreaterThan(0)
      expect(await page.evaluate(() => ({ body: scrollY, shell: document.querySelector('.app-shell')!.scrollTop }))).toEqual(scrollBefore)
      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
      await expect(page.getByRole('button', { name: '상세 정보 확인' })).toBeFocused()
      await page.getByRole('button', { name: '상세 정보 확인' }).click()
      await dialog.getByRole('button', { name: '조합 상세 정보 닫기' }).click()
      await expect(dialog).toHaveCount(0)
      await page.getByRole('button', { name: '다른 제품 추가하기' }).click()
      await page.getByRole('searchbox').fill('철분')
      await page.getByRole('button', { name: /^철분제 조합함에 추가/ }).click()
      await page.getByRole('navigation').getByRole('button', { name: /조합함/ }).click()
      await expect(page.locator('.score-value > span').first()).toHaveText('76')
      await page.getByRole('button', { name: '프로틴 B 삭제', exact: true }).click()
      await expect(page.locator('.score-value > span').first()).toHaveText('88')
      await geometry(page)
      await page.getByRole('navigation').getByRole('button', { name: '홈', exact: true }).click()
      await capture(page, 'home', `docs/qa/v3-home-${viewport.width}x${viewport.height}.png`)
      await page.getByRole('navigation').getByRole('button', { name: '탐색', exact: true }).click()
      await capture(page, 'explore', `docs/qa/v3-explore-${viewport.width}x${viewport.height}.png`)
    })
  })
}
