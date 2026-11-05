import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { checkRateLimit } from '@vercel/firewall'
import { analyzeCart } from '../../src/analysis/engine'
import { analysisDataset } from '../../src/analysis/data'

vi.mock('@vercel/firewall', () => ({ checkRateLimit: vi.fn() }))
const cart = [{ productId: 'P02', quantity: 1 }, { productId: 'M02', quantity: 1 }]
beforeEach(() => {
  vi.resetModules()
  vi.mocked(checkRateLimit).mockReset()
  for (const [name, value] of Object.entries({ NODE_ENV: 'production', VERCEL: '1', OPENAI_API_KEY: 'unit-test-sentinel', AI_ENABLED: 'true', AI_ALLOWED_ORIGINS: 'https://fitmate.example', AI_RATE_LIMIT_ID: 'ip-rule', AI_GLOBAL_LIMIT_ID: 'global-rule' })) vi.stubEnv(name, value)
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
async function run() {
  const api = (await import('../../api/explain')).default
  return api.fetch(new Request('https://fitmate.example/api/explain', { method: 'POST', headers: { origin: 'https://fitmate.example', 'content-type': 'application/json' }, body: JSON.stringify({ cart, question: '쉽게 요약해줘', fingerprint: analyzeCart(cart, analysisDataset).fingerprint }) }))
}
it('설정되지 않은 Firewall ID를 허용으로 오인하지 않는다', async () => {
  vi.mocked(checkRateLimit).mockResolvedValue({ rateLimited: false, error: 'not-found' })
  const fetch = vi.fn<typeof globalThis.fetch>()
  vi.stubGlobal('fetch', fetch)
  expect((await run()).status).toBe(503)
  expect(fetch).not.toHaveBeenCalled()
})
it('Firewall IP 제한에 걸리면 OpenAI를 호출하지 않는다', async () => {
  vi.mocked(checkRateLimit).mockResolvedValue({ rateLimited: true })
  const fetch = vi.fn<typeof globalThis.fetch>()
  vi.stubGlobal('fetch', fetch)
  expect((await run()).status).toBe(429)
  expect(fetch).not.toHaveBeenCalled()
})
it('IP 제한과 공통 제한을 모두 확인하고 제한 검사에도 timeout을 적용한다', async () => {
  vi.mocked(checkRateLimit).mockResolvedValue({ rateLimited: false })
  vi.stubGlobal('fetch', vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ segments: [{ text: '현재 비교 지표는 88점이에요.', factIds: ['score'] }] }) }] }] })))
  expect((await run()).status).toBe(200)
  expect(checkRateLimit).toHaveBeenCalledWith('ip-rule', expect.objectContaining({ timeout: 2000 }))
  expect(checkRateLimit).toHaveBeenCalledWith('global-rule', expect.objectContaining({ rateLimitKey: 'fitmate-ai-total', timeout: 2000 }))
})
it('추가 IP 규칙 없이 공통 제한 한 개로도 유료 호출을 보호한다', async () => {
  vi.stubEnv('AI_RATE_LIMIT_ID', '')
  vi.mocked(checkRateLimit).mockResolvedValue({ rateLimited: true })
  const fetch = vi.fn<typeof globalThis.fetch>()
  vi.stubGlobal('fetch', fetch)
  expect((await run()).status).toBe(429)
  expect(checkRateLimit).toHaveBeenCalledTimes(1)
  expect(checkRateLimit).toHaveBeenCalledWith('global-rule', expect.objectContaining({ rateLimitKey: 'fitmate-ai-total' }))
  expect(fetch).not.toHaveBeenCalled()
})
it('시스템 VERCEL 변수가 없어도 API 진입점은 분산 제한을 생략하지 않는다', async () => {
  vi.stubEnv('VERCEL', '')
  vi.stubEnv('AI_GLOBAL_LIMIT_ID', '')
  const fetch = vi.fn<typeof globalThis.fetch>()
  vi.stubGlobal('fetch', fetch)
  expect((await run()).status).toBe(503)
  expect(fetch).not.toHaveBeenCalled()
})
