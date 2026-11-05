import { createHash } from 'node:crypto'
import type { AssistantReply } from '../src/assistant/types'
import { assistantQuestions } from '../src/assistant/types'
import { buildContext, canonicalCart, questionIndex, validateCart } from './context'
import { assistantInstructions, outputSchema, validateOutput } from './guard'

type Options = {
  env: Record<string, string | undefined>
  fetch?: typeof fetch
  now?: () => number
  distributedLimit?: (request: Request) => Promise<boolean>
  requireDistributedLimit?: boolean
}
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } })
const error = (code: string, message: string, status: number, headers?: Record<string, string>) => json({ kind: 'unavailable', code, message }, status, headers)

export async function boundedText(request: Request | Response, limit: number) {
  if (!request.body) return ''
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > limit) { await reader.cancel(); throw new Error('TOO_LARGE') }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  return Buffer.concat(chunks).toString('utf8')
}

export function createAssistantHandler(options: Options) {
  const { env, distributedLimit } = options
  const call = options.fetch ?? fetch
  const now = options.now ?? Date.now
  const cache = new Map<string, { until: number; reply: AssistantReply }>()
  const pending = new Map<string, Promise<AssistantReply>>()
  const budgets = new Map<string, { minute: number; minuteCount: number; day: number; dayCount: number }>()
  function allow(request: Request) {
    const timestamp = now(), minute = Math.floor(timestamp / 60000), day = Math.floor(timestamp / 86400000)
    for (const [key, value] of budgets) if (value.day < day) budgets.delete(key)
    // Local protection only. Vercel requests also require the external WAF below.
    const identity = createHash('sha256').update(request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'local').digest('hex')
    if (!budgets.has(identity) && budgets.size >= 2000) return false
    const value = budgets.get(identity) ?? { minute, minuteCount: 0, day, dayCount: 0 }
    if (value.minute !== minute) { value.minute = minute; value.minuteCount = 0 }
    if (value.minuteCount >= 5 || value.dayCount >= 30) return false
    value.minuteCount++; value.dayCount++; budgets.set(identity, value)
    return true
  }
  return async function handle(request: Request): Promise<Response> {
    if (request.method !== 'POST') return error('METHOD_NOT_ALLOWED', 'POST 요청만 지원해요.', 405, { Allow: 'POST' })
    const allowedOrigins = (env.AI_ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean)
    const origin = request.headers.get('origin')
    if (!origin || !allowedOrigins.includes(origin)) return error('ORIGIN_NOT_ALLOWED', '허용된 앱에서만 요청할 수 있어요.', 403)
    if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') return error('INVALID_CONTENT_TYPE', 'JSON 요청만 지원해요.', 415)
    if (!allow(request)) return error('RATE_LIMITED', '호출 한도에 도달했어요. 잠시 후 다시 확인해주세요.', 429, { 'Retry-After': '60' })
    let data: Record<string, unknown>
    let context: ReturnType<typeof buildContext>
    let index: number
    let requestKey: string
    try {
      data = JSON.parse(await boundedText(request, 8192))
      if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).some(key => !['cart', 'previousCart', 'question', 'fingerprint'].includes(key)) || typeof data.question !== 'string' || !data.question.trim() || data.question.length > 200 || typeof data.fingerprint !== 'string' || data.fingerprint.length > 2000) throw new Error('INVALID_INPUT')
      const cart = validateCart(data.cart)
      const previous = data.previousCart === undefined ? undefined : validateCart(data.previousCart)
      context = buildContext(cart, previous)
      if (context.analysis.fingerprint !== data.fingerprint) return error('STALE_ANALYSIS', '조합이 바뀌었어요. 현재 구성으로 다시 요청해주세요.', 409)
      index = questionIndex(data.question)
      requestKey = createHash('sha256').update(canonicalCart(cart) + (previous ? canonicalCart(previous) : '') + index + context.analysis.fingerprint).digest('hex')
      if (index < 0 || (index === 3 && !previous) || context.analysis.score.value === null) {
        return json({ kind: 'rules', fingerprint: context.analysis.fingerprint, segments: [{ text: index === 3 && !previous ? '이전 제품 교체 기록이 없어 달라진 점을 확인할 정보가 부족해요.' : '현재 등록된 분석 정보만으로는 이 질문을 확인할 수 없어 정보가 부족해요. 감점 이유·매칭 성분·제품 교체 비교 질문을 이용해주세요.', factIds: [] }], evidence: [] } satisfies AssistantReply)
      }
      if (JSON.stringify(context.facts).length > 14000) return error('CONTEXT_LIMIT', '분석 근거가 많아 AI 설명 범위를 넘었어요. 전체 리포트를 확인해주세요.', 422)
    } catch (cause) {
      return error('INVALID_INPUT', cause instanceof Error && cause.message === 'TOO_LARGE' ? '요청 크기를 초과했어요.' : '등록된 제품 2~10개와 올바른 분석 정보를 보내주세요.', cause instanceof Error && cause.message === 'TOO_LARGE' ? 413 : 400)
    }
    if (env.AI_ENABLED !== 'true' || !env.OPENAI_API_KEY) return error('AI_NOT_CONFIGURED', 'AI가 아직 연결되지 않았어요. 기존 규칙 분석과 상세 근거는 그대로 확인할 수 있어요.', 503)
    const model = env.OPENAI_MODEL ?? 'gpt-5.4-mini'
    if (model !== 'gpt-5.4-mini') return error('MODEL_NOT_ALLOWED', '서버의 AI 모델 설정을 확인해주세요.', 503)
    if (options.requireDistributedLimit || env.VERCEL === '1') {
      if (!env.AI_GLOBAL_LIMIT_ID || !distributedLimit) return error('LIMITER_NOT_CONFIGURED', 'AI 호출 제한 설정이 준비되지 않았어요. 규칙 분석을 확인해주세요.', 503)
      try {
        if (!await distributedLimit(request)) return error('RATE_LIMITED', 'AI 호출 한도에 도달했어요. 기존 분석 결과를 확인해주세요.', 429, { 'Retry-After': '60' })
      } catch { return error('LIMITER_UNAVAILABLE', '호출 제한을 확인할 수 없어 AI 연결을 보류했어요.', 503) }
    }
    const saved = cache.get(requestKey)
    if (saved && saved.until > now()) return json({ ...saved.reply, cached: true })
    try {
      let generation = pending.get(requestKey)
      if (!generation) {
        generation = (async () => {
          const response = await call('https://api.openai.com/v1/responses', {
            method: 'POST', headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
            signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
            body: JSON.stringify({ model, store: false, max_output_tokens: 700, reasoning: { effort: 'none' }, instructions: assistantInstructions,
              input: JSON.stringify({ question: assistantQuestions[index], facts: context.facts }), text: { format: { type: 'json_schema', name: 'fitmate_explanation', strict: true, schema: outputSchema(context.facts) } } }),
          })
          if (!response.ok) throw new Error('PROVIDER_ERROR')
          const result = JSON.parse(await boundedText(response, 48000))
          if (result.status !== 'completed' || !Array.isArray(result.output)) throw new Error('INCOMPLETE')
          const text = result.output.flatMap((item: { type?: string; content?: { type?: string; text?: string }[] }) => item.type === 'message' ? item.content?.filter(content => content.type === 'output_text').map(content => content.text ?? '') ?? [] : []).join('')
          const segments = validateOutput(JSON.parse(text), context.facts)
          const referenced = new Set(segments.flatMap(item => item.factIds))
          return { kind: 'ai', fingerprint: context.analysis.fingerprint, model, segments, evidence: context.facts.filter(fact => referenced.has(fact.id)) } satisfies AssistantReply
        })()
        pending.set(requestKey, generation)
      }
      const reply = await generation
      if (cache.size >= 100) cache.delete(cache.keys().next().value!)
      cache.set(requestKey, { until: now() + 600000, reply })
      return json(reply)
    } catch {
      return error('AI_UNAVAILABLE', 'AI 설명을 불러오거나 근거를 검증하지 못했어요. 아래 규칙 분석 결과는 정상이에요.', 502)
    } finally { pending.delete(requestKey) }
  }
}
