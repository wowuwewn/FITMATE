import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowLeft, Bookmark, Check, ChevronRight, CircleAlert, Info, Share } from 'lucide-react'
import { ScoreGauge } from '../components/ScoreGauge'
import { AnalysisLimitations, FindingList, ProductAndScoreDetails } from '../components/AnalysisDetails'
import { displayProductName } from '../lib/presentation'
import type { AnalysisResult } from '../analysis/types'
import type { CartItem } from '../analysis/types'
import { AiExplanation } from '../components/AiExplanation'
import { RuleExplanation } from '../components/RuleExplanation'
import { IngredientRelations } from '../components/IngredientRelations'

export type AppliedReplacement = { fromName: string; toName: string }
type Props = { analysis: AnalysisResult; previousCart: CartItem[]; replacement: AppliedReplacement | null; onBack: () => void; onOptimize: () => void; onSave: () => void; onCopy: () => void; saved: boolean }

export function Result({ analysis, previousCart, replacement, onBack, onOptimize, onSave, onCopy, saved }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const reducedMotion = useReducedMotion()
  const toggle = (id: string) => setExpanded(current => current === id ? null : id)
  const entry = (index: number) => ({ initial: { opacity: 0, y: reducedMotion ? 0 : 8 }, animate: { opacity: 1, y: 0 }, transition: { delay: reducedMotion ? 0 : .1 + index * .07, duration: reducedMotion ? 0 : .24 } })
  const interactions = analysis.findings.filter(finding => finding.kind === 'interaction')
  const duplicates = analysis.findings.filter(finding => finding.kind === 'duplicate')
  const medication = analysis.findings.filter(finding => finding.medicationRelated)
  const supplement = analysis.findings.filter(finding => !finding.medicationRelated)
  const incomplete = analysis.coverage.skippedRules > 0 || analysis.coverage.evaluatedPairs < analysis.coverage.totalPairs

  return (
    <section className="screen detail-screen result-screen" aria-labelledby="result-heading">
      <header className="detail-header"><button className="icon-button" aria-label="조합함으로 돌아가기" onClick={onBack}><ArrowLeft /></button><h1 className="page-heading" id="result-heading">조합 분석 결과</h1><button className="icon-button" aria-label="분석 요약 복사" onClick={onCopy}><Share size={21} /></button></header>
      {replacement && <p className="change-confirmation" role="status"><Check size={16} />{replacement.fromName} → {replacement.toName} 변경 반영</p>}
      <ScoreGauge value={analysis.score.value} />
      <motion.div className="result-summary" {...entry(0)}>
        <p>{interactions.length ? <>등록된 주의 관계 <strong>{interactions.length}건</strong>을 확인했어요.</> : incomplete ? '일부 조합의 성분·필수 조건을 확인하지 못했어요.' : '확인된 규칙 내에서 충돌이 발견되지 않았습니다.'}{duplicates.length > 0 && <> 성분 중복 알림 <strong>{duplicates.length}건</strong>이 있어요.</>}</p>
        <p className="result-product-summary">{analysis.products.map(product => displayProductName(product.productId, product.displayName) + ' ×' + product.quantity).join(' · ')}</p>
        <span>시연용 비교 지표 · 100점도 안전성을 보장하지 않아요.</span>
        <p className="analysis-scope-note">함량 미확인 {analysis.coverage.unknownAmounts}/{analysis.coverage.ingredientEntries}개 · 추가 조건 {analysis.deferredRules.length}개 보류</p>
      </motion.div>
      <IngredientRelations key={analysis.fingerprint} analysis={analysis} />
      <div className="result-sections">
        <motion.div className="analysis-panel" {...entry(1)}>
          <button className="analysis-row" aria-expanded={expanded === 'ingredients'} aria-controls="ingredient-details" onClick={() => toggle('ingredients')}>
            <span className="analysis-icon"><Check size={13} /></span><span><strong>분석 제품과 점수 근거</strong><span>{analysis.products.length}개 제품 · {analysis.score.deductions.length}개 고유 원인</span></span><ChevronRight className={expanded === 'ingredients' ? 'rotated' : ''} size={17} />
          </button>
          {expanded === 'ingredients' && <div className="analysis-details" id="ingredient-details"><ProductAndScoreDetails analysis={analysis} /></div>}
        </motion.div>
        <motion.div className="analysis-panel" {...entry(2)}>
          <button className="analysis-row" aria-expanded={expanded === 'cautions'} aria-controls="caution-details" onClick={() => toggle('cautions')}>
            <span className="analysis-icon analysis-icon--warning"><CircleAlert size={14} /></span><span><strong>주의할 점</strong><span>{analysis.findings.length ? '주의·중복 규칙 ' + analysis.findings.length + '건 · 상세 확인' : '정보 부족과 규칙의 확인 범위를 살펴보세요.'}</span></span><ChevronRight className={expanded === 'cautions' ? 'rotated' : ''} size={17} />
          </button>
          {expanded === 'cautions' && <div className="analysis-details" id="caution-details">
            {medication.length > 0 && <><h2 className="detail-section-heading">복용약 병용 확인</h2><FindingList findings={medication} /></>}
            {supplement.length > 0 && <><h2 className="detail-section-heading">보충제·성분 확인</h2><FindingList findings={supplement} /></>}
            {!analysis.findings.length && <p>{incomplete ? '일부 성분·필수 조건을 확인하지 못해 전체 조합의 규칙 매칭을 완료하지 못했어요.' : '확인된 규칙 내에서 충돌이 발견되지 않았습니다.'} 이는 안전하다는 의미가 아니며, 등록되지 않은 관계와 미평가 조건은 확인할 수 없어요.</p>}
            {analysis.duplicates.length > 0 && <div className="duplicate-observations"><h2 className="detail-section-heading">같은 성분 포함</h2>{analysis.duplicates.map(item => <p key={item.ingredientId}><strong>{item.name}</strong> · {item.productIds.map(id => displayProductName(id)).join(', ')}{!item.ruleIds.length && ' · 등록된 감점 규칙 없음'}</p>)}<p>등록된 중복 정보이며 함량·실제 섭취량 없이 과다 섭취로 판정하지 않아요.</p></div>}
            <p>실제 섭취량·복용 시간·개인별 상태가 반영되지 않았어요. 복용약의 중단이나 용량 변경은 약사 또는 처방 의료진과 확인하세요.</p>
          </div>}
        </motion.div>
        <motion.button className="analysis-panel analysis-row optimization-link" onClick={onOptimize} {...entry(3)}>
          <span className="analysis-icon"><Info size={14} /></span><span><strong>제품 교체 비교</strong><span>등록 성분으로 변경 전후를 비교해요.</span></span><ChevronRight size={17} />
        </motion.button>
      </div>
      <RuleExplanation analysis={analysis} />
      <AiExplanation analysis={analysis} previousCart={previousCart} />
      <AnalysisLimitations analysis={analysis} />
      <button className={replacement ? 'primary-button save-confirmed-combination' : 'save-combination' + (saved ? ' is-saved' : '')} onClick={onSave}><Bookmark size={17} fill={saved ? 'currentColor' : 'none'} />{saved ? '내 정보에 저장됨' : replacement ? '변경한 조합 저장하기' : '이 조합 저장하기'}</button>
      <p className="result-footnote">조합은 자동 반영됐으며, 보관은 별도로 선택할 수 있어요.</p>
    </section>
  )
}
