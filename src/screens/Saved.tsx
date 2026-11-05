import { ArrowRight, Bookmark, Trash2 } from 'lucide-react'
import { ProductImage } from '../components/ProductImage'
import { productById } from '../lib/catalog'
import type { SavedCombination } from '../lib/saved'
import { SCORING_POLICY } from '../analysis/scoring'

export function Saved({ combinations, onLoad, onRemove, onExplore }: { combinations: SavedCombination[]; onLoad: (combination: SavedCombination) => void; onRemove: (id: string) => void; onExplore: () => void }) {
  return <section className="screen saved-screen" aria-labelledby="saved-heading">
    <h1 className="page-heading" id="saved-heading">내 정보</h1><p className="saved-intro">나의 조합 기록과 서비스 안내</p>
    <div className="saved-section-heading"><h2>저장한 조합 <span>{combinations.length}</span></h2><p>조합함은 현재 편집 중인 구성, 저장한 조합은 따로 보관한 기록이에요. 불러오면 현재 조합을 바꾸고 다시 분석해요.</p></div>
    {combinations.length === 0 ? <div className="empty-state"><Bookmark /><h2>아직 보관한 조합이 없어요</h2><p>조합함에서 구성을 저장하면<br />여기에서 다시 불러올 수 있어요.</p><button className="primary-button" onClick={onExplore}>제품 둘러보기 <ArrowRight /></button></div> : <div className="saved-list">{combinations.map((combination, index) => <article className="saved-row" key={combination.id}>
      <div className="saved-row-heading"><div><h2>나의 조합 {combinations.length - index}</h2><span>{new Date(combination.createdAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })} · {combination.items.length}개 제품</span></div><button className="icon-button" aria-label={`나의 조합 ${combinations.length - index} 삭제`} onClick={() => onRemove(combination.id)}><Trash2 size={17} /></button></div>
      <div className="saved-products">{combination.items.slice(0, 3).map(item => <ProductImage key={item.productId} product={productById.get(item.productId)!} small />)}</div>
      <p>{combination.items.map(item => productById.get(item.productId)?.name).join(' · ')}</p>
      <button className="saved-load" onClick={() => onLoad(combination)}>조합 불러오기 <ArrowRight size={15} /></button>
    </article>)}</div>}
    <div className="service-information">
      <details><summary>현재 서비스 안내</summary><div><p>Fitmate는 등록된 성분 관계를 비교하는 시연 서비스예요. 제품과 패키지는 가상 구성이며 실제 구매 기능은 제공하지 않아요.</p><p>조합함과 저장한 조합은 이 브라우저에만 저장돼요. 브라우저 데이터를 지우면 기록이 사라지고, 다른 기기와 동기화되지 않아요.</p><p>실제 섭취량·복용 시간·개인 상태·유당 함량은 확인하지 않아 정량·독성·알레르기 판정과 시너지 분석은 지원하지 않아요.</p></div></details>
      <details><summary>점수 계산 방식</summary><div><p>시연용 조합 비교 지표이며 의학적 안전성 평가가 아니에요. 100점도 안전·효능을 보장하지 않아요.</p><p>기준 {SCORING_POLICY.baseline}에서 고유 성분 관계별로 info {SCORING_POLICY.weights.info}점, caution {SCORING_POLICY.weights.caution}점, high {SCORING_POLICY.weights.high}점을 한 번씩 차감해요. 최저 지표는 0점이에요.</p><p>비교 가능한 제품 쌍이 없거나 필수 규칙을 평가하지 못하면 숫자 대신 정보 부족으로 표시해요. 수량은 용기 개수이며 섭취량으로 계산하지 않아요.</p><p>정책 {SCORING_POLICY.version} · 전문가 검증이 필요해요. 각 조합의 상세 정보에서 계산 근거와 원본 출처를 볼 수 있어요.</p></div></details>
    </div>
  </section>
}
