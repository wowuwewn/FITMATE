import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Bookmark, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { ProductImage } from '../components/ProductImage'
import { ScoreGauge } from '../components/ScoreGauge'
import { CartDetails } from '../components/CartDetails'
import { AiExplanation } from '../components/AiExplanation'
import { RuleExplanation } from '../components/RuleExplanation'
import { productById } from '../lib/catalog'
import type { CartItem } from '../lib/catalog'
import type { AnalysisResult } from '../analysis/types'

type Props = {
  cart: CartItem[]
  analysis: AnalysisResult
  previousCart: CartItem[]
  onQuantity: (id: string, quantity: number) => void
  onRemove: (ids: string[]) => void
  onExplore: () => void
  onDemo: () => void
  onReport: () => void
  onOptimize: () => void
  onSave: () => void
  saved: boolean
}

export function Cart({ cart, analysis, previousCart, onQuantity, onRemove, onExplore, onDemo, onReport, onOptimize, onSave, saved }: Props) {
  const [editing, setEditing] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [details, setDetails] = useState(false)
  const cautions = analysis.findings.filter(item => item.severity !== 'info').length
  function toggleSelection(id: string) {
    setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  }
  function removeSelection() {
    onRemove(selected)
    setSelected([])
    setEditing(false)
  }
  return (
    <section className={`screen cart-screen ${cart.length ? 'cart-screen--filled' : ''}`} aria-labelledby="cart-heading">
      <header className="cart-heading-row">
        <div><h1 className="page-heading" id="cart-heading">조합함</h1><span className="cart-product-count">{cart.length}개</span></div>
        {cart.length > 0 && <button className="text-button" onClick={() => { setEditing(!editing); setSelected([]) }}>{editing ? '완료' : '선택삭제'}</button>}
      </header>
      <div className="cart-score-card">
        <div className="cart-score-top"><ScoreGauge value={analysis.score.value} /><div className="cart-score-facts"><span className="eyebrow">나의 조합</span><h2>{analysis.score.value === null ? '제품을 더 담아 비교해보세요' : analysis.score.deductions.length ? <>확인할 성분 관계<br /><strong>{analysis.score.deductions.length}가지</strong>가 있어요</> : '등록된 주의 관계가 없어요'}</h2><p>주의사항 <strong>{cautions}건</strong></p><p>중복 성분 <strong>{analysis.duplicates.length}개</strong></p></div></div>
        <p className="cart-analysis-summary" role="status"><span className="sr-only">시연용 조합 비교 지표 {analysis.score.value ?? '—'}{analysis.score.value !== null && '/100'} · 주의·중복 {analysis.findings.length}건. </span><span>{cart.reduce((sum, item) => sum + item.quantity, 0)}용기 · 함량 미확인 {analysis.coverage.unknownAmounts}개<br />의학적 안전성 평가 아님</span></p>
        <div className="cart-analysis-actions"><button className="secondary-button" onClick={() => setDetails(true)}>상세 정보 확인 <ArrowRight size={17} /></button><button className="secondary-button optimize-cart-button" disabled={cart.length < 2} onClick={onOptimize}>최적화 분석 <ArrowRight size={17} /></button></div>
      </div>
      {cart.length === 0 ? <div className="empty-state cart-empty">
        <ShoppingCart /><h2>어떤 조합을 먹고 있나요?</h2><p>함께 확인할 제품을 담아보세요.<br />복용 중인 약도 함께 확인할 수 있어요.</p>
        <button className="primary-button" onClick={onExplore}>제품 담으러 가기 <ArrowRight /></button>
        <button className="text-button demo-cart-button" onClick={onDemo}>시연 조합 담아보기</button>
      </div> : <>
        <div className="section-heading cart-list-heading"><h2>담긴 제품</h2><button className="inline-link" onClick={onExplore}>제품 추가 <Plus size={17} /></button></div><div className="cart-list">
          <AnimatePresence initial={false}>
            {cart.map(item => {
              const product = productById.get(item.productId)!
              return <motion.article className={`cart-row ${editing ? 'cart-row--editing' : ''}`} key={item.productId} layout initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, height: 0, margin: 0 }}>
                {editing && <input className="cart-checkbox" type="checkbox" aria-label={`${product.name} 삭제 선택`} checked={selected.includes(item.productId)} onChange={() => toggleSelection(item.productId)} />}
                <ProductImage product={product} />
                <div className="cart-product-info"><h2>{product.name}</h2><p>{product.subtitle}</p>
                  <div className="quantity-control" aria-label={`${product.name} 용기 수량`}>
                    <button aria-label={`${product.name} 수량 줄이기`} disabled={item.quantity <= 1} onClick={() => onQuantity(item.productId, item.quantity - 1)}><Minus size={13} /></button>
                    <span aria-live="polite">{item.quantity}</span>
                    <button aria-label={`${product.name} 수량 늘리기`} disabled={item.quantity >= 99} onClick={() => onQuantity(item.productId, item.quantity + 1)}><Plus size={13} /></button>
                  </div>
                </div>
                {!editing && <button className="remove-product" aria-label={`${product.name} 삭제`} onClick={() => onRemove([item.productId])}><Trash2 size={17} /></button>}
              </motion.article>
            })}
          </AnimatePresence>
        </div>
        {editing && <div className="selection-actions"><label><input type="checkbox" checked={selected.length === cart.length} onChange={event => setSelected(event.target.checked ? cart.map(item => item.productId) : [])} /> 전체 선택</label><button disabled={!selected.length} onClick={removeSelection}><Trash2 size={14} />선택한 {selected.length}개 삭제</button></div>}
        <RuleExplanation analysis={analysis} />
        <AiExplanation analysis={analysis} previousCart={previousCart} onReport={onReport} />
        <button className="add-more-button secondary-button" onClick={onExplore}><Plus size={18} />다른 제품 추가하기</button>
        <p className="cart-note">등록 제품은 시연용이에요. 수량은 용기 개수이며 섭취량이 아니에요.</p>
        <button className="inline-link find-more" onClick={onExplore}>제품 더 찾기 <ArrowRight size={17} /></button>
        <div className="cart-bottom-action"><button className="primary-button" onClick={onSave} disabled={cart.length < 2 || saved}><Bookmark size={18} />{saved ? '저장한 조합' : '조합 저장하기'}</button><p>{cart.length < 2 ? '비교·저장하려면 서로 다른 제품 2개를 담아주세요.' : '구성이 바뀌면 점수와 근거가 자동으로 갱신돼요.'}</p></div>
      </>}
      {details && <CartDetails analysis={analysis} onClose={() => setDetails(false)} onReport={onReport} onOptimize={onOptimize} />}
    </section>
  )
}
