import { useState } from 'react'
import { ArrowLeft, Check, Plus, Search, SlidersHorizontal, X } from 'lucide-react'
import { motion } from 'motion/react'
import { categories, products } from '../lib/catalog'
import type { Product } from '../lib/catalog'
import type { ExploreRequest, ProductCategory } from '../lib/categories'
import type { CartItem } from '../lib/catalog'
import { ProductImage } from '../components/ProductImage'
import { categoryImages } from '../lib/imagery'
import { BrowseButton } from '../components/BrowseButton'

export function Explore({ cart, onAdd, onRemove, onBack, request, onProduct }: { cart: CartItem[]; onAdd: (id: string) => void; onRemove: (ids: string[]) => void; onBack: () => void; request: ExploreRequest; onProduct: (product: Product) => void }) {
  const [query, setQuery] = useState(request.query ?? '')
  const [category, setCategory] = useState<ProductCategory>(request.category ?? '전체')
  const [medications, setMedications] = useState(request.medications ?? false)
  const [filters, setFilters] = useState(false)
  const [sort, setSort] = useState('default')
  const [onlyAvailableImage, setOnlyAvailableImage] = useState(false)
  const normalizedQuery = query.trim().toLocaleLowerCase().replace(/\s+/g, '')
  const visible = products.filter(product => {
    const searchText = [product.display_name, product.subtitle, ...product.ingredientNames, ...product.ingredients.map(item => item.ingredient_id)].join('').toLocaleLowerCase().replace(/\s+/g, '')
    return (medications ? product.category === 'medication' : product.category === 'supplement' && (category === '전체' || product.group === category)) && searchText.includes(normalizedQuery) && (!onlyAvailableImage || product.image)
  }).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, 'ko') : 0)

  return (
    <section className="screen explore-screen" aria-labelledby="explore-heading">
      <header className="explore-header"><button className="icon-button" aria-label="이전 화면으로 돌아가기" onClick={onBack}><ArrowLeft /></button><h1 className="page-heading" id="explore-heading">제품 탐색</h1></header>
      <div className="catalog-modes" aria-label="탐색 대상"><button aria-pressed={!medications} onClick={() => setMedications(false)}>보충제·영양제</button><button aria-pressed={medications} onClick={() => setMedications(true)}>복용약 확인</button></div>
      <div className="search-field">
        <Search size={20} aria-hidden="true" />
        <input aria-label="제품 또는 성분 검색" type="search" placeholder="제품 또는 성분 검색" value={query} onChange={event => setQuery(event.target.value)} />
        {query && <button className="clear-search" aria-label="검색어 지우기" onClick={() => setQuery('')}><X size={16} /></button>}
      </div>
      {!medications && <div className="category-list" aria-label="제품 카테고리">
        {categories.map(item => <BrowseButton key={item} className={`category-chip ${category === item ? 'active' : ''}`} aria-pressed={category === item} onClick={() => setCategory(item)}><span className="category-image"><img draggable={false} src={categoryImages[item]} alt="" /></span><span>{item}</span></BrowseButton>)}
      </div>}
      {medications && <p className="medication-note">복용 중인 약의 상호작용을 확인하기 위한 목록이에요. 구매·교체 추천이 아니며, 복용약을 임의로 변경하지 마세요.</p>}
      <div className="catalog-toolbar">
        <p aria-live="polite">{medications ? '복용약' : category} <strong>{visible.length}</strong>개</p>
        <button className={`icon-button ${filters || onlyAvailableImage || sort !== 'default' ? 'filter-active' : ''}`} aria-label="목록 정렬 및 필터" aria-expanded={filters} aria-controls="catalog-filters" onClick={() => setFilters(!filters)}><SlidersHorizontal size={20} /></button>
      </div>
      {filters && <div className="catalog-filters" id="catalog-filters">
        <label>정렬<select value={sort} onChange={event => setSort(event.target.value)}><option value="default">기본순</option><option value="name">이름순</option></select></label>
        <label className="checkbox-label"><input type="checkbox" checked={onlyAvailableImage} onChange={event => setOnlyAvailableImage(event.target.checked)} />시연 이미지가 있는 제품만</label>
      </div>}
      <div className="catalog-list">
        {visible.map(product => {
          const count = cart.find(item => item.productId === product.product_id)?.quantity ?? 0
          return <article className="product-row" key={product.product_id}>
            <BrowseButton className="product-image-button" aria-label={`${product.name} 이미지로 상세 보기`} onClick={() => onProduct(product)}><ProductImage product={product} /></BrowseButton>
            <BrowseButton className="product-copy" title={product.display_name} aria-label={`${product.name} 상세 보기`} onClick={() => onProduct(product)}>
              <h2>{product.name}</h2><p>{product.subtitle}</p>
              <span className="product-meta">{product.category === 'medication' ? '복용약 확인용' : '함량 미등록'}</span>
            </BrowseButton>
            <div className="product-selection"><motion.button className={`add-button ${count > 0 ? 'added' : ''}`} whileTap={{ scale: .94 }} aria-label={`${product.name} 조합함에 추가${count ? `, 현재 ${count}개` : ''}`} onClick={() => onAdd(product.product_id)}>
              {count > 0 ? <Check size={17} /> : <Plus size={18} />}
              {count > 0 && <span className="added-quantity">{count}</span>}
            </motion.button>{count > 0 && <button className="selection-cancel" aria-label={`${product.name} 담기 취소`} onClick={() => onRemove([product.product_id])}>취소</button>}</div>
          </article>
        })}
      </div>
      {visible.length === 0 && <div className="empty-state search-empty"><Search /><h2>{!query && !onlyAvailableImage && category !== '전체' && !medications ? '아직 등록된 제품이 없어요' : '검색 결과가 없어요'}</h2><p>{!query && category !== '전체' && !medications ? `${category} 제품 데이터가 준비되면 여기에서 볼 수 있어요.` : '다른 제품명이나 성분으로 찾아보세요.'}</p><button className="text-button" onClick={() => { setQuery(''); setCategory('전체'); setOnlyAvailableImage(false) }}>필터 초기화</button></div>}
      <p className="catalog-note">등록 제품과 패키지는 시연용이에요. 실제 함량과 개인 복용 조건은 별도로 확인해주세요.</p>
    </section>
  )
}
