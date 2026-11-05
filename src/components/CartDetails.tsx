import { ArrowRight } from 'lucide-react'
import { Sheet } from './Sheet'
import { AnalysisLimitations, FindingList, ProductAndScoreDetails } from './AnalysisDetails'
import type { AnalysisResult } from '../analysis/types'
import { displayProductName } from '../lib/presentation'

export function CartDetails({ analysis, onClose, onReport, onOptimize }: { analysis: AnalysisResult; onClose: () => void; onReport: () => void; onOptimize: () => void }) {
  const interactions = analysis.findings.filter(item => item.kind === 'interaction')
  const duplicates = analysis.findings.filter(item => item.kind === 'duplicate')
  return <Sheet title="조합 상세 정보" onClose={onClose}>
    <p className="sheet-intro">현재 조합의 등록 성분 관계를 확인해요. 시연용 비교 지표이며 의학적 안전성 평가가 아니에요.</p>
    <h3 className="detail-section-heading">확인된 상호작용 · {interactions.length}건</h3>
    {interactions.length ? <FindingList findings={interactions} /> : <p>확인된 규칙에서 주의 관계가 발견되지 않았어요. 미등록 관계와 실제 복용 조건은 확인할 수 없어요.</p>}
    <h3 className="detail-section-heading">중복 성분 관찰 · {analysis.duplicates.length}개</h3>
    <FindingList findings={duplicates} />
    {analysis.duplicates.length ? analysis.duplicates.map(item => <p className="duplicate-summary" key={item.ingredientId}><strong>{item.name}</strong> · {item.productIds.map(id => displayProductName(id)).join(', ')}{!item.ruleIds.length && ' · 등록된 감점 규칙 없음'}</p>) : <p>등록 성분에서 중복이 관찰되지 않았어요.</p>}
    <p className="rule-limitation">함량·실제 섭취량 없이 중복을 과다 섭취로 판정하지 않아요.</p>
    <h3 className="detail-section-heading">개선 제안</h3>
    <p>공통 등록 성분이 있는 제품으로 교체 전후 지표와 주의 관계를 비교할 수 있어요. 효능이나 안전성 개선을 보장하지 않아요.</p>
    <button className="inline-link" disabled={analysis.products.length < 2} onClick={onOptimize}>제품 교체 비교 <ArrowRight size={17} /></button>
    <h3 className="detail-section-heading">시너지 정보</h3><p>검증된 긍정적 상호작용 규칙이 등록되지 않아 시너지 분석을 제공하지 않아요.</p>
    <AnalysisLimitations analysis={analysis} />
    <details className="score-policy-details"><summary>점수 계산 기준</summary><ProductAndScoreDetails analysis={analysis} /></details>
    <button className="secondary-button report-link" disabled={analysis.products.length < 2} onClick={onReport}>전체 분석 리포트 보기 <ArrowRight size={17} /></button>
  </Sheet>
}
