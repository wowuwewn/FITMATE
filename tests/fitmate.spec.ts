import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import dataset from '../src/data/cart_interactions_dataset.json' with { type: 'json' }

const demo = ['P01', 'P06', 'P08'].map(productId => ({ productId, quantity: 1 }))

async function seed(page: Page, items = demo) {
  await page.addInitScript(cart => { if (localStorage.getItem('fitmate.cart.v1') === null) localStorage.setItem('fitmate.cart.v1', JSON.stringify(cart)) }, items)
}
async function openReport(page: Page) {
  await page.getByRole('button', { name: '상세 정보 확인' }).click()
  await page.getByRole('button', { name: '전체 분석 리포트 보기' }).click()
}
async function settled(page: Page) {
  const screen = new URL(page.url()).hash.slice(1) || 'home'
  await expect(page.locator('main > section')).toHaveClass(new RegExp(`\\b${screen}-screen\\b`))
  await expect(page.locator('main')).toHaveCSS('opacity', '1')
  await page.evaluate(() => document.fonts.ready)
  await page.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode().catch(() => undefined))))
}
async function shot(page: Page, name: string) {
  await settled(page)
  await page.screenshot({ path: `docs/qa/${name}.png` })
}

test('홈과 실제 탭 전환, 검색, 카테고리, 정렬, 이미지 필터', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '건너뛰기' }).click()
  await expect(page.getByRole('heading', { name: '나의 영양 루틴, 조합부터 살펴봐요.' })).toBeVisible()
  await shot(page, '01-home')
  await page.getByRole('button', { name: '검색하기' }).click()
  await expect(page.locator('.product-row')).toHaveCount(dataset.products.filter(product => product.category === 'supplement').length)
  await shot(page, '02-explore')
  await page.getByRole('button', { name: '프로틴', exact: true }).click()
  await expect(page.locator('.product-row')).toHaveCount(3)
  await page.getByRole('button', { name: '전체', exact: true }).click()
  await page.getByRole('searchbox').fill('비타민 D')
  await expect(page.locator('.product-row')).toHaveCount(2)
  await page.getByRole('searchbox').fill('not-a-product')
  await expect(page.getByRole('heading', { name: '검색 결과가 없어요' })).toBeVisible()
  await page.getByRole('button', { name: '필터 초기화' }).click()
  await page.getByRole('button', { name: '목록 정렬 및 필터' }).click()
  await page.getByLabel('시연 이미지가 있는 제품만').check()
  await expect(page.locator('.product-row')).toHaveCount(10)
  await page.getByRole('combobox', { name: '정렬', exact: true }).selectOption('name')
  await expect(page.locator('.product-row h2').first()).toHaveText('마그네슘제')
  await page.goBack()
  await expect(page.getByRole('heading', { name: /나의 영양 루틴/ })).toBeVisible()
})

test('제품 추가, 수량, localStorage 지속, 선택 삭제', async ({ page }) => {
  await page.goto('/#explore')
  await page.getByRole('button', { name: /^프로틴 A 조합함에 추가/ }).click({ clickCount: 1 })
  await page.getByRole('button', { name: /^프로틴 A 조합함에 추가/ }).click()
  await expect(page.getByRole('navigation').getByRole('button', { name: '조합함 제품 2개' })).toBeVisible()
  await page.getByRole('navigation').getByRole('button', { name: /조합함/ }).click()
  await expect(page.locator('.cart-row')).toHaveCount(1)
  await page.getByRole('button', { name: '프로틴 A 수량 줄이기' }).click()
  await expect(page.getByRole('button', { name: '프로틴 A 수량 줄이기' })).toBeDisabled()
  await expect(page.getByRole('button', { name: '조합 저장하기' })).toBeDisabled()
  await page.getByRole('button', { name: '프로틴 A 수량 늘리기' }).click()
  await page.reload()
  await expect(page.locator('.quantity-control > span')).toHaveText('2')
  await page.getByRole('button', { name: '선택삭제' }).click()
  await page.getByRole('checkbox', { name: '전체 선택' }).check()
  await page.getByRole('button', { name: '선택한 1개 삭제' }).click()
  await expect(page.getByRole('heading', { name: '어떤 조합을 먹고 있나요?' })).toBeVisible()
})

test('즉시 분석, 예시 점수, 상세 정보와 교체 적용', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await seed(page)
  await page.goto('/#cart')
  await shot(page, '03-cart')
  await expect(page.locator('.score-value > span').first()).toHaveText('100')
  await openReport(page)
  await expect(page.getByRole('heading', { name: '조합 분석 결과' })).toBeVisible()
  await expect(page.locator('.score-value > span').first()).toHaveText('100')
  await expect(page.getByText(/100점도 안전성을 보장하지 않아요/)).toBeVisible()
  await shot(page, '04-result')
  await page.getByRole('button', { name: /^분석 제품과 점수 근거/ }).click()
  await expect(page.locator('.ingredient-detail')).toHaveCount(3)
  await page.getByRole('button', { name: /^주의할 점/ }).click()
  await expect(page.locator('#caution-details')).toContainText('안전하다는 의미가 아니며')
  await page.getByRole('button', { name: /^제품 교체 비교/ }).click()
  await expect(page.getByRole('heading', { name: '최적화 제안' })).toBeVisible()
  await expect(page.getByRole('button', { name: '분석 결과로 돌아가기' })).toBeVisible()
  await expect(page.getByLabel('변경할 제품')).toHaveValue('P02')
  await expect(page.locator('.comparison-panel--proposed')).toHaveCSS('opacity', '1')
  await shot(page, '05-optimize')
  await page.getByRole('button', { name: '변경 후 조합 확인하기' }).click()
  await expect(page.getByRole('heading', { name: '조합 분석 결과' })).toBeVisible()
  await expect(page.locator('.result-product-summary')).toContainText('프로틴 B')
  await expect(page.locator('.score-value > span').first()).toHaveText('100')
  await page.getByRole('button', { name: '조합함으로 돌아가기' }).click()
  await expect(page.getByRole('heading', { name: '조합함' })).toBeVisible()
  await expect(page.locator('.cart-row h2').first()).toHaveText('프로틴 B')
  await expect(page.locator('.cart-row')).toHaveCount(3)
  expect(errors).toEqual([])
})

for (const example of dataset.demo_carts) {
  test(`원본 데이터 성분 쌍 검증: ${example.product_ids.join(' + ')}`, async ({ page }) => {
    // Reverse the pair to verify the matching contract is symmetric.
    await seed(page, [...example.product_ids].reverse().map(productId => ({ productId, quantity: 1 })))
    await page.goto('/#result')
    await page.getByRole('button', { name: /^주의할 점/ }).click()
    await expect(page.locator('.rule-detail')).toHaveCount(example.expected_rule_ids.length)
    const tags = await page.locator('.evidence-tag').allTextContents()
    const ids = tags.map(tag => tag.split(' · ')[1]).sort()
    expect(ids).toEqual([...example.expected_rule_ids].sort())
    if (ids.length) {
      await expect(page.locator('.evidence-links a').first()).toHaveAttribute('href', /^https:\/\//)
      await expect(page.locator('#caution-details')).toContainText('실제 섭취량·복용 시간·개인별 상태가 반영되지 않았어요')
    }
  })
}

test('같은 제품의 용기 수량으로 성분 중복 관계를 만들지 않음', async ({ page }) => {
  await seed(page, [{ productId: 'P04', quantity: 2 }, { productId: 'P01', quantity: 1 }])
  await page.goto('/#result')
  await page.getByRole('button', { name: /^주의할 점/ }).click()
  await expect(page.locator('.rule-detail')).toHaveCount(0)
})

test('교체 시 복용약 유지, 수량 보존, 대안이 없는 경우', async ({ page }) => {
  await seed(page, [{ productId: 'P02', quantity: 3 }, { productId: 'M02', quantity: 1 }])
  await page.goto('/#optimize')
  await expect(page.getByLabel('교체할 제품').locator('option')).toHaveCount(1)
  await expect(page.getByLabel('교체할 제품')).toHaveValue('P02')
  await page.getByRole('button', { name: '변경 후 조합 확인하기' }).click()
  await expect(page.getByRole('heading', { name: '조합 분석 결과' })).toBeVisible()
  await expect(page.locator('.score-value > span').first()).toHaveText('100')
  await page.getByRole('button', { name: '조합함으로 돌아가기' }).click()
  await expect(page.locator('.cart-row h2')).toHaveText(['프로틴 A', '레보티록신 경구제'])
  await expect(page.locator('.quantity-control > span').first()).toHaveText('3')
})

test('복용약만 담은 조합에서는 교체 비활성화', async ({ page }) => {
  await seed(page, [{ productId: 'M01', quantity: 1 }, { productId: 'M02', quantity: 1 }])
  await page.goto('/#optimize')
  await expect(page.getByRole('button', { name: '변경 후 조합 확인하기' })).toBeDisabled()
  await expect(page.getByLabel('교체할 제품')).toBeDisabled()
})

test('보관함 저장, 중복 방지, 새로고침 후 불러오기와 삭제', async ({ page }) => {
  await seed(page)
  await page.goto('/#result')
  await page.getByRole('button', { name: '이 조합 저장하기' }).click()
  await expect(page.getByRole('button', { name: '내 정보에 저장됨' })).toBeVisible()
  await page.getByRole('button', { name: '내 정보에 저장됨' }).click()
  await page.goto('/#saved')
  await expect(page.locator('.saved-row')).toHaveCount(1)
  await page.reload()
  await expect(page.locator('.saved-row')).toHaveCount(1)
  await page.getByRole('button', { name: '조합 불러오기' }).click()
  await expect(page.locator('.cart-row')).toHaveCount(3)
  await page.getByRole('navigation').getByRole('button', { name: '내 정보' }).click()
  await page.getByRole('button', { name: '나의 조합 1 삭제' }).click()
  await expect(page.getByRole('heading', { name: '아직 보관한 조합이 없어요' })).toBeVisible()
})

test('손상된 저장 데이터와 이미지 로딩 실패 처리', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fitmate.cart.v1', JSON.stringify([{ productId: 'unknown', quantity: 2 }, { productId: 'P01', quantity: -3 }, { productId: 'P06', quantity: 500 }]))
    localStorage.setItem('fitmate.saved.v1', '{broken-json')
  })
  await page.route('**/images/white-jar-demo.png', route => route.abort())
  await page.goto('/#cart')
  await expect(page.locator('.cart-row')).toHaveCount(1)
  await expect(page.locator('.quantity-control > span')).toHaveText('99')
  await expect(page.getByRole('button', { name: '마그네슘제 수량 늘리기' })).toBeDisabled()
  await page.getByRole('navigation').getByRole('button', { name: '탐색' }).click()
  await expect(page.locator('.product-row').first().getByText('이미지 없음')).toBeVisible()
})

test('저장소를 사용할 수 없어도 조합 추가와 화면 전환 유지', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Blocked', 'SecurityError') }
  })
  await page.goto('/#explore')
  await page.getByRole('button', { name: /^프로틴 A 조합함에 추가/ }).click()
  await expect(page.locator('.storage-notice')).toBeVisible()
  await page.getByRole('navigation').getByRole('button', { name: /조합함/ }).click()
  await expect(page.locator('.cart-row')).toHaveCount(1)
})

test('모션 감소 환경과 빈 결과 링크의 안전한 처리', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' })
  await page.goto('/#result')
  await expect(page.getByRole('heading', { name: '조합함' })).toBeVisible()
  await page.getByRole('button', { name: '시연 조합 담아보기' }).click()
  await openReport(page)
  await expect(page.locator('.score-value > span').first()).toHaveText('100', { timeout: 1200 })
  await expect(page.locator('.app-shell')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
})

for (const viewport of [{ width: 320, height: 640 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 768, height: 1024 }, { width: 1440, height: 1000 }]) {
  test(`반응형 ${viewport.width} × ${viewport.height}: 5개 화면 가로 넘침과 CTA 겹침`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await seed(page)
    for (const screen of ['home', 'explore', 'cart', 'result', 'optimize']) {
      await page.goto('/#' + screen)
      await settled(page)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      const primary = page.locator('.primary-button')
      if (await primary.count()) {
        await primary.scrollIntoViewIfNeeded()
        const button = await primary.boundingBox()
        const nav = await page.locator('.bottom-nav').count() ? await page.locator('.bottom-nav').boundingBox() : null
        expect(button!.x).toBeGreaterThanOrEqual(0)
        expect(button!.x + button!.width).toBeLessThanOrEqual(viewport.width)
        if (nav) expect(button!.y + button!.height).toBeLessThanOrEqual(nav.y + 1)
      }
    }
    if (viewport.width === 1440) {
      await page.goto('/#home')
      await shot(page, '06-desktop')
      const shell = await page.locator('.app-shell').boundingBox()
      expect(shell!.width).toBeLessThanOrEqual(430)
    }
    if (viewport.width === 320) {
      await page.goto('/#home')
      await shot(page, '07-mobile-320')
    }
  })
}
