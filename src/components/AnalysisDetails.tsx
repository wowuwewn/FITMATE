import type { AnalysisResult, Finding } from '../analysis/types'
import { displayProductName } from '../lib/presentation'
import { SCORING_POLICY } from '../analysis/scoring'

const severityLabel = { high: '우선 확인', caution: '주의', info: '참고' }
const priority = { high: 0, caution: 1, info: 2 }

export function FindingList({ findings }: { findings: Finding[] }) {
  const groups = new Map<string, Finding[]>()
  for (const finding of [...findings].sort((a, b) => priority[a.severity] - priority[b.severity])) {
    groups.set(finding.causeKey, [...(groups.get(finding.causeKey) ?? []), finding])
  }
  return <>{[...groups.entries()].map(([key, related]) => {
    const finding = related[0]
    const products = [...new Set(related.flatMap(item => item.productIds))]
    const messages = [...new Set(related.map(item => item.message))].filter(text => text !== finding.title)
    const sources = [...new Set(related.flatMap(item => item.sourceUrls))]
    const conditions = [...new Set(related.filter(item => item.detailedEvaluation.status !== 'met').map(item => item.detailedEvaluation.reason))]
    return <article className="rule-detail" key={key}>
      <div className="rule-tags"><span className="severity-tag" data-severity={finding.severity}>{severityLabel[finding.severity]}</span></div>
      <h3>{finding.title}</h3>
      <p className="rule-products">{products.map(productId => displayProductName(productId)).join(' · ')}</p>
      {messages.map(message => <p key={message}>{message}</p>)}
      <details className="finding-evidence"><summary>근거와 출처</summary>
        <p>관련 규칙 {related.map(item => item.ruleId).filter((id, index, ids) => ids.indexOf(id) === index).join(' · ')}</p>
        <p>근거 수준: {[...new Set(related.map(item => item.evidenceLevel ?? '정보 없음'))].join(' · ')}</p>
        {conditions.map(reason => <p className="rule-limitation" key={reason}>{reason}</p>)}
        <div className="evidence-links">{sources.length ? sources.map((url, index) => <a href={url} key={url} target="_blank" rel="noreferrer">출처 {index + 1} ↗</a>) : <span>연결된 출처가 없어요.</span>}</div>
      </details>
    </article>
  })}</>
}

export function ProductAndScoreDetails({ analysis }: { analysis: AnalysisResult }) {
  return <>
    <p>{analysis.score.value === null ? '비교할 정보가 부족해 점수를 계산하지 않았어요.' : `${analysis.score.baseline}점 − 감점 ${analysis.score.rawDeduction}점 = ${analysis.score.value}점${analysis.score.rawDeduction > 100 ? ' (최저 0점)' : ''}`}</p>
    <p>성분 관계에 따라 참고 {SCORING_POLICY.weights.info}점, 주의 {SCORING_POLICY.weights.caution}점, 우선 확인 {SCORING_POLICY.weights.high}점을 차감해요. 같은 원인은 한 번만 반영해요.</p>
  </>
}

export function AnalysisLimitations({ analysis }: { analysis: AnalysisResult }) {
  const coverage = analysis.coverage
  return <details className="analysis-limitations">
    <summary>분석 기준</summary>
    <div className="limitation-content">
      <ProductAndScoreDetails analysis={analysis} />
      <p>함량 미확인 {coverage.unknownAmounts}개 · 추가 조건 {analysis.deferredRules.length}개 미평가. 실제 섭취량·복용 시간·개인 상태는 반영하지 않았어요.</p>
      {(coverage.missingIngredientProducts > 0 || coverage.unregisteredIngredients > 0 || coverage.skippedRules > 0) && <p>성분 정보가 없는 제품 {coverage.missingIngredientProducts}개 · 미등록 성분 {coverage.unregisteredIngredients}개 · 평가하지 못한 규칙 {coverage.skippedRules}개.</p>}
      <p>점수는 성분 관계의 비교값이며 의학적 안전성을 보장하지 않아요. 복용약 변경은 의료진·약사와 확인하세요.</p>
    </div>
  </details>
}
