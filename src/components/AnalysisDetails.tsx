import type { AnalysisResult, Finding } from '../analysis/types'
import { displayProductName } from '../lib/presentation'

const severityLabel = { high: '우선 확인', caution: '주의 확인', info: '정보' }

export function FindingList({ findings }: { findings: Finding[] }) {
  const ordered = [...findings].sort((a, b) => ({ high: 0, caution: 1, info: 2 }[a.severity] - { high: 0, caution: 1, info: 2 }[b.severity]))
  return <>{ordered.map(finding => <article className="rule-detail" key={finding.key}>
    <div className="rule-tags"><span className="evidence-tag">{finding.kind === 'duplicate' ? '성분 중복 정보' : finding.medicationRelated ? '복용약 병용 확인' : '성분 관계 확인'} · {finding.ruleId}</span><span className="severity-tag" data-severity={finding.severity}>{finding.severity} · {severityLabel[finding.severity]}</span></div>
    <h3>{finding.title}</h3>
    <p className="rule-products">{finding.productIds.map(id => displayProductName(id)).join(' + ')}</p>
    <p>{finding.message}</p>
    <p className="rule-limitation">{finding.triggerMeaning}</p>
    {finding.detailedEvaluation.status !== 'met' && <p className="rule-limitation">상세 판정 보류: {finding.detailedEvaluation.reason}</p>}
    <span className="evidence-label">원본 근거 수준: {finding.evidenceLevel ?? '미등록'}</span>
    <div className="evidence-links">{finding.sourceUrls.length ? finding.sourceUrls.map((url, index) => <a href={url} key={url} target="_blank" rel="noreferrer">등록 출처 {index + 1} ↗</a>) : <span>원본에 출처 URL이 등록되지 않았어요.</span>}</div>
  </article>)}</>
}

export function ProductAndScoreDetails({ analysis }: { analysis: AnalysisResult }) {
  return <>
    <h2 className="detail-section-heading">분석에 사용한 제품</h2>
    {analysis.products.map(product => <div className="ingredient-detail" key={product.productId}>
      <strong>{displayProductName(product.productId, product.displayName)} · {product.quantity}용기</strong>
      {product.ingredients.length ? <ul>{product.ingredients.map((ingredient, index) => <li key={`${ingredient.id}:${index}`}>{ingredient.name} · {ingredient.amount === null ? '함량 미등록' : `${ingredient.amount} ${ingredient.unit}`}{!ingredient.registered && ' · 미등록 ID'}</li>)}</ul> : <p>성분 목록 없음 · 확인하지 못한 제품이에요.</p>}
    </div>)}
    <h2 className="detail-section-heading">점수 계산 근거</h2>
    <p>기준 100 − 고유 성분 관계별 감점. info 3점, caution 12점, high 25점을 적용하는 시연 정책이에요.</p>
    <ul className="deduction-list">{analysis.score.deductions.map(item => <li key={item.causeKey}><span>{[...new Set(item.ingredientNames)].join(' + ')}<small>{item.ruleIds.join(' · ')} · {item.productPairs.length}개 제품 쌍, 한 번만 감점</small></span><strong>−{item.points}</strong></li>)}</ul>
    {!analysis.score.deductions.length && <p>적용할 감점 규칙이 없어요. 안전성을 뜻하지 않아요.</p>}
    <p>합계 감점 {analysis.score.rawDeduction}점{analysis.score.rawDeduction > 100 && ' · 최저 지표는 0점'}. {analysis.score.value === null ? '필수 정보가 부족해 숫자 지표를 제공하지 않아요.' : `계산한 비교 지표 ${analysis.score.value}/100.`}</p>
    <p className="rule-limitation">정책 {analysis.score.policyVersion} · 전문가 검증 필요. 용기는 섭취량으로 환산하지 않아요.</p>
  </>
}

export function AnalysisLimitations({ analysis }: { analysis: AnalysisResult }) {
  const coverage = analysis.coverage
  return <details className="analysis-limitations">
    <summary>정보 부족·분석 범위 확인</summary>
    <div className="limitation-content">
      <p>등록 제품 쌍 {coverage.evaluatedPairs}/{coverage.totalPairs}개 확인 · 함량/단위 미확인 {coverage.unknownAmounts}/{coverage.ingredientEntries}개.</p>
      <p>성분 목록 없는 제품 {coverage.missingIngredientProducts}개 · 미등록 성분 {coverage.unregisteredIngredients}개 · 적용하지 못한 필수 규칙 {coverage.skippedRules}개.</p>
      {analysis.issues.filter(issue => issue.code !== 'unknown_amount').map((issue, index) => <p key={`${issue.code}:${index}`}>{issue.message}</p>)}
      <p>실제 섭취량·복용 시간·제형·개인 상태를 확인하지 않았어요. 함량 미등록은 0을 의미하지 않으며, 일일 섭취량·과다·독성은 계산하지 않아요.</p>
      <p>선택 상세 조건의 당일 섭취, 복용 간격, 제품 범위와 섭취 변경 이력은 미평가예요. 성분 쌍 경고와 실제 조건 충족 판정은 구분돼요.</p>
      <details className="deferred-rule-details"><summary>추가 조건 {analysis.deferredRules.length}개 적용 보류</summary>{analysis.deferredRules.map(rule => <div className="deferred-rule" key={rule.id}><strong>{rule.id} · {rule.type}</strong><p>{rule.reason}</p><div className="evidence-links">{rule.sourceUrls.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer">원본 출처 {index + 1} ↗</a>)}</div></div>)}</details>
      <p>약물 계열·제품명·WPC/WPI·유당 함유 여부를 추정해 매핑하지 않아요. 유당불내증과 우유 단백질 알레르기는 별도 특성이에요.</p>
      <p>복용약의 중단·용량 변경은 약사 또는 처방 의료진과 확인하세요. 확인된 규칙만으로 안전성을 보장할 수 없어요.</p>
    </div>
  </details>
}
