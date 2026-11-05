import { Plus, X } from 'lucide-react'
import { Sheet } from './Sheet'
import { ProductImage } from './ProductImage'
import type { Product } from '../lib/catalog'

export function ProductDetails({ product, count, onClose, onAdd, onRemove }: { product: Product; count: number; onClose: () => void; onAdd: (id: string) => void; onRemove: (ids: string[]) => void }) {
  return <Sheet title="제품 상세" onClose={onClose}>
    <div className="product-detail-hero"><ProductImage product={product} /></div>
    <span className="eyebrow">{product.category === 'medication' ? '복용약 상호작용 확인용' : product.group ?? '보충제'} · 시연용 구성</span>
    <h3 className="product-detail-name">{product.name}</h3><p>{product.subtitle}</p>
    <h3 className="detail-section-heading">등록된 성분</h3>
    {product.ingredients.length ? <ul className="product-ingredient-list">{product.ingredients.map((ingredient, index) => <li key={ingredient.ingredient_id}><span>{product.ingredientNames[index]}</span><span>{ingredient.amount === null || !ingredient.unit ? '함량 미등록' : `${ingredient.amount} ${ingredient.unit}`}</span></li>)}</ul> : <p>성분 정보가 등록되지 않았어요.</p>}
    <p className="sheet-intro">패키지는 AI 목업이며 실제 제품 사진·라벨이 아니에요. 용기 수량은 섭취량으로 환산하지 않아요.{product.category === 'medication' && ' 복용약을 임의로 중단하거나 변경하지 마세요.'}</p>
    <div className="product-detail-actions"><button className="primary-button" disabled={count >= 99} onClick={() => onAdd(product.product_id)}><Plus size={18} />조합함에 추가{count > 0 ? ` · 현재 ${count}개` : ''}</button>{count > 0 && <button className="secondary-button" onClick={() => { onRemove([product.product_id]); onClose() }}><X size={18} />담기 취소</button>}<button className="secondary-button" onClick={onClose}>닫고 돌아가기</button></div>
  </Sheet>
}
