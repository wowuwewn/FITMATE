import { useId, useState } from 'react'
import { ArrowRight, Info } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import type { AnalysisResult } from '../analysis/types'
import { displayProductName } from '../lib/presentation'
import { FindingList } from './AnalysisDetails'
import { Sheet } from './Sheet'

export function IngredientRelations({ analysis }: { analysis: AnalysisResult }) {
  const [chosen, setChosen] = useState<string | null>(null)
  const [evidence, setEvidence] = useState(false)
  const titleId = useId()
  const reduced = useReducedMotion()
  const deduction = analysis.score.deductions.find(item => item.causeKey === chosen) ?? analysis.score.deductions[0]
  const finding = deduction && analysis.findings.find(item => item.causeKey === deduction.causeKey)
  if (!finding) return null
  const firstProduct = analysis.products.find(item => item.productId === finding.productIds[0])
  const leftIndex = firstProduct?.ingredients.some(item => item.id === finding.ingredientIds[0]) ? 0 : 1
  const names = [finding.ingredientNames[leftIndex], finding.ingredientNames[1 - leftIndex]]
  return <section className="ingredient-relations" aria-label="등록 규칙의 성분 관계">
    <div className="section-heading"><h2>확인할 성분 관계</h2><span>{analysis.score.deductions.length}가지 원인</span></div>
    {analysis.score.deductions.length > 1 && <div className="cause-tabs" aria-label="확인할 관계 선택">{analysis.score.deductions.map(item => <button key={item.causeKey} aria-pressed={item.causeKey === deduction.causeKey} onClick={() => setChosen(item.causeKey)}>{[...new Set(item.ingredientNames)].join(' · ')}</button>)}</div>}
    <div className="relation-spotlight" data-severity={finding.severity}>
      <div className="relation-heading"><span>{finding.medicationRelated ? '복용약 관련' : finding.kind === 'duplicate' ? '성분 중복' : '성분 관계'} · {finding.ruleId}</span><strong>−{deduction.points}<small>점</small></strong></div>
      <figure key={finding.key} className="relation-figure">
        <svg viewBox="0 0 346 116" role="img" aria-labelledby={titleId}>
          <title id={titleId}>{finding.ruleId} · {names.join('와 ')}의 {finding.kind === 'duplicate' ? '중복' : '검토'} 관계</title>
          <path className="relation-track" d="M118 58H228" />
          <motion.path className="relation-edge" d="M118 58H228" initial={{ pathLength: reduced ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduced ? 0 : .65, ease: [.2, .75, .25, 1] }} />
          <circle className="relation-indicator" cx="173" cy="58" r="16" />
          <text className="relation-symbol" x="173" y="64" textAnchor="middle">{finding.kind === 'duplicate' ? '=' : '!'}</text>
          {[0, 1].map(index => <g key={index}><rect className="relation-node" x={index === 0 ? 0 : 228} y="24" width="118" height="68" rx="14" /><text className="relation-name" x={index === 0 ? 59 : 287} y={names[index].length > 7 ? 53 : 64} textAnchor="middle">{names[index].length > 7 ? <><tspan x={index === 0 ? 59 : 287}>{names[index].slice(0, 7)}</tspan><tspan x={index === 0 ? 59 : 287} dy="20">{names[index].slice(7)}</tspan></> : names[index]}</text></g>)}
        </svg>
        <div className="relation-products">{finding.productIds.map(id => <span key={id}>{displayProductName(id)}</span>)}</div>
        <figcaption>등록된 관계를 연결한 선이며 발생 확률을 뜻하지 않아요.</figcaption>
      </figure>
      <h3>{finding.title}</h3><p className="relation-message">{finding.message}</p>
      <p className="relation-condition"><Info size={17} /><span>상세 조건 {finding.detailedEvaluation.status === 'met' ? '확인' : '미확인'} · {finding.detailedEvaluation.reason}</span></p>
      <button className="relation-evidence" onClick={() => setEvidence(true)}>이 관계의 출처와 적용 범위 <ArrowRight size={18} /></button>
    </div>
    {evidence && <Sheet title="성분 관계 근거" onClose={() => setEvidence(false)}><FindingList findings={analysis.findings.filter(item => item.causeKey === deduction.causeKey)} /><p className="sheet-intro">점수는 성분 관계를 비교한 값이에요. 개인별 복용 지침은 의료진·약사와 확인해주세요.</p></Sheet>}
  </section>
}
