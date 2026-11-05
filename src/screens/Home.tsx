import { useRef, useState } from 'react'
import { ArrowRight, Check, Grid2X2, Plus, Search, ShoppingBag } from 'lucide-react'
import type { Screen } from '../App'
import { ProductImage } from '../components/ProductImage'
import { BrowseButton } from '../components/BrowseButton'
import { categories, products, productById } from '../lib/catalog'
import type { CartItem, Product } from '../lib/catalog'
import type { ExploreRequest } from '../lib/categories'
import { analyzeCart } from '../analysis/engine'
import { analysisDataset } from '../analysis/data'
import { categoryImages, productImages } from '../lib/imagery'

const examples = [
  { id: 'routine', title: '기본 구성 살펴보기', description: '프로틴 · 마그네슘 · 종합비타민', ids: ['P01', 'P06', 'P08'] },
  { id: 'duplicate', title: '중복 성분 확인하기', description: '종합비타민 · 비타민 D', ids: ['P08', 'P09'] },
].map(example => {
  const items = example.ids.map(productId => ({ productId, quantity: 1 }))
  return { ...example, items, analysis: analyzeCart(items, analysisDataset) }
})

type Props = {
  navigate: (screen: Screen) => void; count: number; cart: CartItem[]
  onAdd: (id: string) => void; onRemove: (ids: string[]) => void
  onExplore: (request?: ExploreRequest) => void; onExample: (items: CartItem[]) => void; onProduct: (product: Product) => void
}
export function Home({ navigate, count, cart, onAdd, onRemove, onExplore, onExample, onProduct }: Props) {
  const [query, setQuery] = useState('')
  const search = useRef<HTMLInputElement>(null)
  const [shelf, setShelf] = useState<'supplements' | 'vitamins'>('supplements')
  const shelfProducts = shelf === 'supplements' ? products.filter(product => product.group === '프로틴') : ['P06', 'P08', 'P09'].map(id => productById.get(id)!)
  return <section className="screen home-screen discovery-home" aria-label="Fitmate 홈">
    <header className="home-header"><span className="wordmark">Fitmate<span>.</span></span><div className="home-header-actions"><button className="icon-button" aria-label="제품 검색으로 이동" onClick={() => { search.current?.scrollIntoView({ block: 'center' }); search.current?.focus({ preventScroll: true }) }}><Search /></button><button className="icon-button" aria-label={`조합함, 제품 ${count}개`} onClick={() => navigate('cart')}><ShoppingBag />{count > 0 && <span className="count-badge">{count}</span>}</button></div></header>
    <div className="home-welcome"><h1>나의 영양 루틴,<br />조합부터 살펴봐요.</h1></div>
    <form className="search-field home-search" role="search" onSubmit={event => { event.preventDefault(); onExplore({ query }) }}><Search size={21} aria-hidden="true" /><input ref={search} type="search" aria-label="홈 제품 또는 성분 검색" placeholder="제품이나 성분을 검색해보세요" value={query} onChange={event => setQuery(event.target.value)} /><button aria-label="검색하기" type="submit"><ArrowRight size={21} /></button></form>
    <div className="home-shortcuts" aria-label="카테고리 바로가기">
      <BrowseButton onClick={() => onExplore({ category: '프로틴' })}><span><img draggable={false} src={categoryImages['프로틴']} alt="" /></span>프로틴</BrowseButton>
      <BrowseButton onClick={() => onExplore({ category: '비타민&미네랄' })}><span><img draggable={false} src={categoryImages['비타민&미네랄']} alt="" /></span>비타민·미네랄</BrowseButton>
      <BrowseButton onClick={() => onExplore({ medications: true })}><span><img draggable={false} src={productImages.M01} alt="" /></span>복용약 확인</BrowseButton>
      <BrowseButton onClick={() => onExplore()}><span><Grid2X2 size={25} /></span>전체 제품</BrowseButton>
    </div>
    <section className="home-section recommended-section"><div className="section-heading"><h2>조합 둘러보기</h2></div>
      <div className="recommendations">{examples.map((example, index) => <BrowseButton key={example.id} className={`recommendation recommendation--${index}`} whileTap={{ scale: .985 }} onClick={() => onExample(example.items)} aria-label={`${example.title}, 조합함에 적용`}>
        <div className="recommendation-copy"><span className="recommendation-index">COMBINATION 0{index + 1}</span><h3>{example.title}</h3><p>{example.description}</p>{index === 0 && <span className="recommendation-score">조합 점수 {example.analysis.score.value ?? '—'} / 100 <ArrowRight size={17} /></span>}</div>
        <div className="recommendation-products">{example.ids.slice(0, 2).map(id => <ProductImage key={id} product={productById.get(id)!} small />)}</div>{index === 1 && <ArrowRight size={18} />}
      </BrowseButton>)}</div>
    </section>
    <section className="home-section"><div className="section-heading"><h2>제품 둘러보기</h2><button className="inline-link" onClick={() => onExplore()}>전체 보기 <ArrowRight size={16} /></button></div>
      <div className="shelf-tabs" aria-label="제품 유형"><button aria-pressed={shelf === 'supplements'} onClick={() => setShelf('supplements')}>보충제</button><button aria-pressed={shelf === 'vitamins'} onClick={() => setShelf('vitamins')}>영양제</button></div>
      <p className="catalog-order-note">카탈로그 기본순 · 번호는 인기 순위가 아니에요.</p>
      <ol className="home-product-list">{shelfProducts.map((product, index) => {
        const included = cart.some(item => item.productId === product.product_id)
        return <li className="home-product-row" key={product.product_id}><span className="product-index">{String(index + 1).padStart(2, '0')}</span><BrowseButton className="home-product-open" aria-label={`${product.name} 상세 보기`} onClick={() => onProduct(product)}><ProductImage product={product} /><span><strong>{product.name}</strong><span>{product.subtitle}</span><small>함량 미등록</small></span></BrowseButton><BrowseButton className={`add-button ${included ? 'added' : ''}`} aria-label={`${product.name} ${included ? '담기 취소' : '조합함에 추가'}`} aria-pressed={included} onClick={() => included ? onRemove([product.product_id]) : onAdd(product.product_id)}>{included ? <><Check size={17} /><span className="cancel-caption">취소</span></> : <Plus size={20} />}</BrowseButton></li>
      })}</ol>
    </section>
    <section className="home-section"><div className="section-heading"><h2>카테고리로 찾기</h2></div><div className="home-categories">{categories.slice(1).map(category => <BrowseButton key={category} onClick={() => onExplore({ category })}><span className="category-image"><img draggable={false} src={categoryImages[category]} alt="" loading="lazy" /></span><span>{category}</span><ArrowRight size={16} /></BrowseButton>)}</div></section>
    <div className="home-footer-note"><button className="inline-link" onClick={() => onExplore({ medications: true })}>복용약 상호작용 확인 <ArrowRight size={16} /></button></div>
  </section>
}
