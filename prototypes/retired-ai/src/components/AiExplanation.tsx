import { useEffect, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import type { AnalysisResult, CartItem } from '../analysis/types'
import { assistantQuestions } from '../assistant/types'
import type { AssistantReply, AssistantRequest } from '../assistant/types'

type Props = { analysis: AnalysisResult; previousCart: CartItem[]; onReport?: () => void }
export function AiExplanation(props: Props) {
  // A changed composition gets an entirely new request state and cancels stale work.
  return <ExplanationSession key={props.analysis.fingerprint + JSON.stringify(props.previousCart)} {...props} />
}
function ExplanationSession({ analysis, previousCart, onReport }: Props) {
  const [question, setQuestion] = useState('')
  const [reply, setReply] = useState<AssistantReply | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const controller = useRef<AbortController | null>(null)
  const mounted = useRef(true)
  const responseAnchor = useRef<HTMLDivElement>(null)
  const disabled = analysis.products.length < 2 || analysis.products.length > 10
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort() } }, [])
  useEffect(() => {
    if (reply || error) responseAnchor.current?.scrollIntoView({ block: 'center', behavior: 'instant' })
  }, [reply, error])
  async function ask(value: string) {
    if (busy || disabled || !value.trim()) return
    const abort = new AbortController()
    controller.current = abort
    setBusy(true); setError(''); setReply(null)
    const timeout = window.setTimeout(() => abort.abort(), 22000)
    let feedback = 'AI 설명에 연결하지 못했어요. 기존 규칙 분석은 계속 확인할 수 있어요.'
    try {
      const body: AssistantRequest = { cart: analysis.products.map(product => ({ productId: product.productId, quantity: product.quantity })), question: value.trim(), fingerprint: analysis.fingerprint, ...(previousCart.length ? { previousCart } : {}) }
      const response = await fetch('/api/explain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body), signal: abort.signal })
      const result = await response.json()
      if (!response.ok) { if (typeof result.message === 'string' && result.message.length <= 200) feedback = result.message; throw new Error('API_ERROR') }
      if (result.fingerprint !== analysis.fingerprint || !['ai', 'rules'].includes(result.kind) || !Array.isArray(result.segments) || !Array.isArray(result.evidence)) throw new Error('현재 분석의 AI 응답을 확인하지 못했어요.')
      if (!abort.signal.aborted && mounted.current) setReply(result)
    } catch {
      if (mounted.current) setError(abort.signal.aborted ? 'AI 요청을 마치지 못했어요. 기존 분석 결과를 확인해주세요.' : feedback)
    } finally { window.clearTimeout(timeout); if (mounted.current) setBusy(false) }
  }
  return <section className="ai-explanation" aria-label="AI 분석 설명">
    <div className="section-heading"><h2>AI 분석 설명</h2><span className="eyebrow">요청 시 연결</span></div>
    <p className="ai-intro">현재 분석에 대해 질문해보세요. AI 생성 설명은 별도로 표시해요.</p>
    <div className="ai-questions">{assistantQuestions.map((value, index) => <button className={index === 0 ? 'ai-summary-button' : ''} key={value} disabled={disabled || busy} onClick={() => { setQuestion(value); void ask(value) }}>{index === 0 ? 'AI 요약 생성' : value}</button>)}</div>
    <form className="ai-question-form" onSubmit={event => { event.preventDefault(); void ask(question) }}><label className="sr-only" htmlFor="ai-question">분석 결과에 질문하기</label><input id="ai-question" placeholder="분석 결과에 질문하기" maxLength={200} value={question} disabled={disabled || busy} onChange={event => setQuestion(event.target.value)} /><button type="submit" disabled={disabled || busy || !question.trim()} aria-label="AI에게 질문하기"><ArrowRight size={19} /></button></form>
    {disabled && <p className="ai-status">AI 설명은 서로 다른 제품 2~10개를 지원해요. 전체 규칙 분석은 계속 사용할 수 있어요.</p>}
    {busy && <p className="ai-status" role="status">분석 설명을 요청하고 있어요.</p>}
    {error && <div ref={responseAnchor} className="ai-error" role="status"><strong>규칙 기반 안내 · AI 생성 아님</strong><p>{error}</p></div>}
    {reply && <div ref={responseAnchor} className="ai-reply" aria-live="polite"><strong className="ai-origin">{reply.kind === 'ai' ? `AI 생성 설명${reply.cached ? ' · 저장된 응답 재사용' : ''}` : '정보 부족 · 규칙 기반 안내 (AI 생성 아님)'}</strong>{reply.segments.map((segment, index) => <p key={index}>{segment.text}</p>)}
      {reply.evidence.length > 0 && <details className="ai-evidence"><summary>설명에 사용한 분석 근거</summary>{reply.evidence.map(fact => <article key={fact.id}><p>{fact.text}</p>{fact.ruleIds.length > 0 && <span>매칭 규칙 {fact.ruleIds.join(', ')}</span>}<div className="evidence-links">{fact.sourceUrls.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer">등록 출처 {index + 1} ↗</a>)}</div></article>)}</details>}
    </div>}
    <p className="ai-footnote">요청 시 제품 구성과 분석 근거가 OpenAI로 전송돼요. 설명은 원본 근거와 함께 확인해주세요. 개인별 복용량·안전성은 판단하지 않아요.</p>
    {onReport && <button className="inline-link" onClick={onReport}>원본 분석 리포트 확인 <ArrowRight size={16} /></button>}
  </section>
}
