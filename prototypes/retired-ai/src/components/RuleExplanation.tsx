import { useId, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import type { AnalysisResult } from '../analysis/types'

const questions = [
  { id: 'score', label: '점수 계산 과정을 알려주세요' },
  { id: 'duplicates', label: '겹친 성분을 확인하고 싶어요' },
  { id: 'limits', label: '어떤 정보가 더 필요한가요?' },
] as const

export function RuleExplanation({ analysis }: { analysis: AnalysisResult }) {
  return <Explanation key={analysis.fingerprint} analysis={analysis} />
}
function Explanation({ analysis }: { analysis: AnalysisResult }) {
  const [selected, setSelected] = useState<(typeof questions)[number]['id'] | null>(null)
  const answerId = useId()
  const reduced = useReducedMotion()
  const answer = selected === 'score'
    ? analysis.score.value === null ? '비교할 제품 정보가 부족해 숫자 점수를 계산하지 않았어요.' : `기준 ${analysis.score.baseline}점에서 고유한 성분 관계 ${analysis.score.deductions.length}가지의 감점 ${analysis.score.rawDeduction}점을 반영해 ${analysis.score.value}점이에요. 같은 원인은 가장 큰 감점 한 번만 반영하며, 임상 위험도를 뜻하지 않아요.`
    : selected === 'duplicates'
      ? analysis.duplicates.length ? `${analysis.duplicates.map(item => `${item.name} (${item.productIds.length}개 제품)`).join(', ')}이 겹쳐요. 함량과 실제 섭취량이 없어 과다 여부는 판단하지 않았어요.` : '현재 등록 성분에서 중복은 확인되지 않았어요. 실제 제품의 미등록 성분까지 확인한 결과는 아니에요.'
      : `성분 함량 ${analysis.coverage.unknownAmounts}건이 미확인이며, 별도 조건부 규칙 ${analysis.deferredRules.length}개는 보류 중이에요. 복용 시간·제형·개인 조건을 확인해야 해요.`
  return <section className="rule-explanation" aria-label="규칙 기반 분석 가이드">
    <div className="section-heading"><h2>분석을 쉽게 이해하기</h2><span className="demo-badge">규칙 기반</span></div>
    <p>현재 분석 결과를 설명해요. AI가 생성한 답변이 아니에요.</p>
    <div className="rule-questions">{questions.map(question => <button key={question.id} aria-pressed={selected === question.id} aria-controls={answerId} onClick={() => setSelected(question.id)}>{question.label}<ArrowRight size={17} /></button>)}</div>
    <div id={answerId} aria-live="polite">{selected && <motion.div key={selected} className="rule-answer" initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : .3 }}><strong>규칙 기반 안내 · AI 생성 아님</strong><p>{answer}</p><span>{selected === 'score' && analysis.score.deductions.length ? `근거: ${[...new Set(analysis.score.deductions.flatMap(item => item.ruleIds))].join(', ')}` : '근거: 현재 조합의 등록 성분과 분석 범위'}</span></motion.div>}</div>
  </section>
}
