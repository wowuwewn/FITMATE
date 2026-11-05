import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { if (!localStorage.getItem('fitmate.cart.v1')) localStorage.setItem('fitmate.cart.v1', JSON.stringify([{ productId: 'P02', quantity: 1 }, { productId: 'M02', quantity: 1 }])) })
})

test('키 없는 실제 로컬 API도 기존 분석을 유지하고 생성 문구로 위장하지 않는다', async ({ page }) => {
  await page.goto('/#cart')
  await expect(page.locator('.score-value > span').first()).toHaveText('88')
  const response = page.waitForResponse('**/api/explain')
  await page.getByRole('button', { name: 'AI 요약 생성' }).click()
  expect((await response).status()).toBe(503)
  await expect(page.locator('.ai-error')).toContainText('AI 생성 아님')
  await expect(page.locator('.ai-reply')).toHaveCount(0)
  const note = await page.locator('.ai-error').boundingBox()
  const footer = await page.locator('.cart-bottom-action').boundingBox()
  expect(note!.y).toBeGreaterThanOrEqual(0)
  expect(note!.y + note!.height).toBeLessThan(footer!.y)
  await expect(page.locator('.score-value > span').first()).toHaveText('88')
  await page.getByRole('button', { name: '상세 정보 확인' }).click()
  await expect(page.getByRole('dialog').locator('.rule-detail')).toContainText('R06')
})

test('검증된 API 응답을 실제 AI 설명으로 표시하고 등록 근거를 연결한다 (제공자 응답 모킹)', async ({ page }) => {
  let calls = 0
  await page.route('**/api/explain', async route => {
    calls++
    const input = route.request().postDataJSON()
    expect(input.cart).toEqual([{ productId: 'M02', quantity: 1 }, { productId: 'P02', quantity: 1 }])
    await route.fulfill({ json: { kind: 'ai', model: 'gpt-5.4-mini', fingerprint: input.fingerprint, segments: [{ text: '칼슘과 레보티록신 관계가 R06에 매칭되어 12점이 차감됐어요.', factIds: ['current-0'] }], evidence: [{ id: 'current-0', text: 'R06 · caution · 12점', ruleIds: ['R06'], productIds: ['P02', 'M02'], sourceUrls: ['https://ods.od.nih.gov/factsheets/calcium-HealthProfessional/'] }] } })
  })
  await page.goto('/#cart')
  expect(calls).toBe(0)
  await page.getByRole('button', { name: '왜 감점됐나요?' }).click()
  await expect(page.locator('.ai-origin')).toHaveText('AI 생성 설명')
  await expect(page.locator('.ai-reply')).toContainText('12점이 차감')
  await page.locator('.ai-evidence summary').click()
  await expect(page.locator('.ai-evidence a')).toHaveAttribute('href', 'https://ods.od.nih.gov/factsheets/calcium-HealthProfessional/')
  await page.getByRole('button', { name: '원본 분석 리포트 확인' }).click()
  await expect(page.locator('.result-screen .ai-explanation')).toBeVisible()
  await page.getByRole('button', { name: '어떤 성분이 문제인가요?' }).click()
  await expect(page.locator('.ai-origin')).toHaveText('AI 생성 설명')
  expect(calls).toBe(2)
})

test('미지원 질문은 실제 로컬 API에서 정보 부족·규칙 안내로 구분한다', async ({ page }) => {
  await page.goto('/#cart')
  await page.getByRole('textbox', { name: '분석 결과에 질문하기' }).fill('이 조합을 먹으면 안전한가요?')
  await page.getByRole('button', { name: 'AI에게 질문하기' }).click()
  await expect(page.locator('.ai-origin')).toContainText('정보 부족 · 규칙 기반 안내 (AI 생성 아님)')
  await expect(page.locator('.score-value > span').first()).toHaveText('88')
})

test('429 및 네트워크 실패 후 재시도해도 규칙 분석은 유지된다', async ({ page }) => {
  let count = 0
  await page.route('**/api/explain', route => ++count === 1 ? route.fulfill({ status: 429, json: { message: '호출 한도에 도달했어요.' } }) : route.abort())
  await page.goto('/#cart')
  await page.getByRole('button', { name: 'AI 요약 생성' }).click()
  await expect(page.locator('.ai-error')).toContainText('호출 한도')
  await page.getByRole('button', { name: 'AI 요약 생성' }).click()
  await expect(page.locator('.ai-error')).toBeVisible()
  await expect(page.getByRole('button', { name: 'AI 요약 생성' })).toBeEnabled()
  await expect(page.locator('.score-value > span').first()).toHaveText('88')
})

test('교체 전 구성을 전송하고 새로고침 후에도 비교 기록을 유지한다', async ({ page }) => {
  await page.route('**/api/explain', async route => {
    const input = route.request().postDataJSON()
    expect(input.previousCart).toEqual([{ productId: 'P02', quantity: 1 }, { productId: 'M02', quantity: 1 }])
    expect(input.cart).toEqual([{ productId: 'M02', quantity: 1 }, { productId: 'P01', quantity: 1 }])
    await route.fulfill({ json: { kind: 'ai', fingerprint: input.fingerprint, model: 'gpt-5.4-mini', segments: [{ text: '비교 지표가 88점에서 100점으로 달라졌어요.', factIds: ['change'] }], evidence: [] } })
  })
  await page.goto('/#optimize')
  await page.getByRole('button', { name: '변경 후 조합 확인하기' }).click()
  await page.getByRole('button', { name: '제품 교체 후 무엇이 달라졌나요?' }).click()
  await expect(page.locator('.ai-reply')).toContainText('88점에서 100점')
  await page.reload()
  await page.getByRole('button', { name: '제품 교체 후 무엇이 달라졌나요?' }).click()
  await expect(page.locator('.ai-origin')).toHaveText('AI 생성 설명')
})

test('구성이 바뀌면 이전 AI 설명을 폐기하고 자동 재호출하지 않는다', async ({ page }) => {
  let calls = 0
  await page.route('**/api/explain', async route => {
    calls++
    const input = route.request().postDataJSON()
    await route.fulfill({ json: { kind: 'ai', fingerprint: input.fingerprint, segments: [{ text: '현재 비교 지표는 88점이에요.', factIds: ['score'] }], evidence: [] } })
  })
  await page.goto('/#cart')
  await page.getByRole('button', { name: 'AI 요약 생성' }).click()
  await expect(page.locator('.ai-reply')).toBeVisible()
  await page.getByRole('button', { name: '프로틴 B 수량 늘리기' }).click()
  await expect(page.locator('.ai-reply')).toHaveCount(0)
  expect(calls).toBe(1)
})

test('시간 초과 후에도 다시 질문할 수 있고 기존 점수가 유지된다', async ({ page }) => {
  await page.route('**/api/explain', () => {})
  await page.goto('/#cart')
  await expect(page.locator('main')).toHaveCSS('opacity', '1')
  await page.clock.install()
  await page.getByRole('button', { name: 'AI 요약 생성' }).click()
  await expect(page.getByRole('button', { name: 'AI 요약 생성' })).toBeDisabled()
  await page.clock.fastForward(23000)
  await expect(page.locator('.ai-error')).toContainText('AI 요청을 마치지 못했어요')
  await expect(page.getByRole('button', { name: 'AI 요약 생성' })).toBeEnabled()
  await expect(page.locator('.score-value > span').first()).toHaveText('88')
})
