import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { ProductImage } from '../components/ProductImage'
import { FindingList } from '../components/AnalysisDetails'
import { displayProductName } from '../lib/presentation'
import { productById } from '../lib/catalog'
import { analysisDataset } from '../analysis/data'
import { getReplacementCandidates } from '../analysis/optimization'
import type { AnalysisResult, CartItem } from '../analysis/types'

type Props = { cart: CartItem[]; before: AnalysisResult; onBack: () => void; onApply: (sourceId: string, targetId: string) => void }
function ComparisonNumber({ value, from }: { value: number | null; from: number | null }) {
  const reduced = useReducedMotion()
  const number = useMotionValue(from ?? value ?? 0)
  const rounded = useTransform(number, current => Math.round(current))
  useEffect(() => {
    const control = animate(number, value ?? 0, { duration: reduced ? 0 : .6, ease: [.2, .75, .25, 1] })
    return () => control.stop()
  }, [number, value, reduced])
  return value === null ? <span>—</span> : <motion.span>{rounded}</motion.span>
}
export function Optimize({ cart, before, onBack, onApply }: Props) {
  const supplements = cart.filter(item => productById.get(item.productId)?.category === 'supplement')
  const [chosenSource, setChosenSource] = useState(supplements[0]?.productId ?? '')
  const [targetId, setTargetId] = useState('')
  const sourceId = supplements.some(item => item.productId === chosenSource) ? chosenSource : supplements[0]?.productId ?? ''
  const candidates = getReplacementCandidates(cart, sourceId, analysisDataset)
  const target = candidates.find(candidate => candidate.product.product_id === targetId) ?? candidates[0]
  const comparison = target?.comparison
  const delta = comparison?.scoreDelta
  const reduced = useReducedMotion()
  const sourceProduct = productById.get(sourceId)
  const targetProduct = target && productById.get(target.product.product_id)
  const recommendationReason = !supplements.length ? '복용약은 교체 대상이 아니에요.'
    : before.coverage.missingIngredientProducts || before.coverage.unregisteredIngredients || before.coverage.skippedRules ? '조합의 성분·필수 조건 정보가 부족해 비교 후보를 선정할 수 없어요.'
      : !target ? '등록 성분이 겹치는 비교 후보가 없어 추천할 수 없어요.'
        : delta === null ? '분석 정보가 부족해 점수로 비교할 수 없어요.'
          : delta === 0 ? '등록된 규칙에서 지표 개선 차이를 확인하지 못했어요.'
            : delta! < 0 ? '비교 지표가 낮아졌어요. 새로 확인할 관계를 살펴보세요.'
              : '등록된 규칙에 매칭되는 관계가 줄어드는 구성이에요.'
  const addedKeys = new Set(comparison?.addedCauses.map(item => item.causeKey) ?? [])
  const retained = cart.filter(item => item.productId !== sourceId)
  return <section className="screen detail-screen optimize-screen" aria-labelledby="optimize-heading">
    <header className="detail-header"><button className="icon-button" aria-label="분석 결과로 돌아가기" onClick={onBack}><ArrowLeft /></button><h1 className="page-heading" id="optimize-heading">최적화 제안</h1></header>
    <p className="optimization-intro">같은 분석 규칙으로 교체 전후를 비교해요.</p>
    <div className="replacement-fields">
      <label>교체할 제품<select aria-label="교체할 제품" value={sourceId} disabled={!supplements.length} onChange={event => { setChosenSource(event.target.value); setTargetId('') }}>{supplements.length ? supplements.map(item => <option key={item.productId} value={item.productId}>{displayProductName(item.productId)}</option>) : <option value="">교체 가능한 보충제 없음</option>}</select></label>
      <ArrowRight size={16} aria-hidden="true" />
      <label>변경할 제품<select aria-label="변경할 제품" value={target?.product.product_id ?? ''} disabled={!target} onChange={event => setTargetId(event.target.value)}>{candidates.length ? candidates.map(candidate => <option key={candidate.product.product_id} value={candidate.product.product_id}>{displayProductName(candidate.product.product_id)}</option>) : <option value="">공통 성분 후보 없음</option>}</select></label>
    </div>
    <div className="comparison-panel comparison-compact">
      <div className="comparison-score-row"><div className="comparison-column"><div className="comparison-heading"><h2>현재 조합</h2><span data-testid="before-score">{before.score.value ?? '—'}<small>점</small></span></div></div><ArrowRight className="comparison-direction" size={34} />
        <motion.div className="comparison-column comparison-panel--proposed" initial={{ opacity: reduced ? 1 : 0 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : .24 }}><div className="comparison-heading"><h2>변경 조합</h2><span data-testid="after-score"><ComparisonNumber value={comparison?.after.score.value ?? null} from={before.score.value} /><small>점</small></span></div></motion.div>
      </div>
      <div className="comparison-subline"><span className="comparison-score-note">시연용 조합 비교 지표</span>{typeof delta === 'number' && <span className="demo-score-delta">{delta === 0 ? '변화 없음' : (delta > 0 ? '+' : '') + delta + '점'}</span>}</div>
      <div className="replacement-products">{sourceProduct ? <div className="replacement-product"><ProductImage product={sourceProduct} /><strong>{sourceProduct.name}</strong><p>{sourceProduct.subtitle}</p></div> : <p>교체 가능한 보충제가 없어요.</p>}<ArrowRight size={22} />
        {targetProduct ? <motion.div key={targetProduct.product_id} className="replacement-product replacement-product--next" initial={{ opacity: reduced ? 1 : 0, x: reduced ? 0 : 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: reduced ? 0 : .45 }}><ProductImage product={targetProduct} /><strong>{targetProduct.name}</strong><p>{targetProduct.subtitle}</p></motion.div> : <p>비교 후보가 없어요.</p>}
      </div><p className="comparison-limit">함량·효능의 동등성이나 안전성을 비교한 값이 아니에요.</p>
    </div>
    <p className="comparison-product-names">그대로 유지: {retained.map(item => displayProductName(item.productId) + ' ×' + item.quantity).join(' · ') || '없음'}</p>
    {comparison && <details className="comparison-changes"><summary>주의 관계 {comparison.removedCauses.length}개 감소 · {comparison.addedCauses.length}개 새로 확인</summary><div>
      <h2 className="detail-section-heading">줄어든 확인 항목</h2>{comparison.removedCauses.length ? comparison.removedCauses.map(item => <p key={item.causeKey}>{[...new Set(item.ingredientNames)].join(' + ')} · {item.ruleIds.join(', ')}</p>) : <p>해소된 성분 관계는 없어요.</p>}
      <h2 className="detail-section-heading">새로 확인할 항목</h2>{comparison.addedCauses.length ? <FindingList findings={comparison.after.findings.filter(finding => addedKeys.has(finding.causeKey))} /> : <p>확인된 규칙에서 새 관계가 발견되지 않았어요.</p>}
      <p>변경 후에도 함량 {comparison.after.coverage.unknownAmounts}건과 개인 복용 조건은 미확인이에요. 100점도 의학적 안전성을 보장하지 않아요.</p>
    </div></details>}
    <p className="replacement-note" role="status">{recommendationReason}<br />용기 수량과 복용약은 유지돼요. 변경 후 결과를 확인하고 별도로 저장할 수 있어요.</p>
    <div className="detail-bottom-action"><button className="primary-button" disabled={!target} onClick={() => target && onApply(sourceId, target.product.product_id)}>변경 후 조합 확인하기 <ArrowRight /></button></div>
  </section>
}
