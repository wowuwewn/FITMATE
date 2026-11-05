import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react'
import { UserRound, Check, Home as HomeIcon, Search, ShoppingCart, X } from 'lucide-react'
import { Home } from './screens/Home'
import { Explore } from './screens/Explore'
import { Cart } from './screens/Cart'
import type { AppliedReplacement } from './screens/Result'
import { analyzeCart } from './analysis/engine'
import { analysisDataset } from './analysis/data'
import { getReplacementCandidates } from './analysis/optimization'
import { demoCart, normalizeCart, productById } from './lib/catalog'
import type { CartItem } from './lib/catalog'
import { cartKey, normalizeSaved } from './lib/saved'
import type { SavedCombination } from './lib/saved'
import { useStoredState } from './lib/storage'
import { Intro } from './components/Intro'
import { shouldShowIntro } from './lib/intro'
import { ProductDetails } from './components/ProductDetails'
import type { Product } from './lib/catalog'
import type { ExploreRequest } from './lib/categories'
import './App.css'
import './styles/v4.css'

const Result = lazy(() => import('./screens/Result').then(module => ({ default: module.Result })))
const Optimize = lazy(() => import('./screens/Optimize').then(module => ({ default: module.Optimize })))
const Saved = lazy(() => import('./screens/Saved').then(module => ({ default: module.Saved })))

export type Screen = 'home' | 'explore' | 'cart' | 'result' | 'optimize' | 'saved'
const screens = ['home', 'explore', 'cart', 'result', 'optimize', 'saved']
function screenFromHash(): Screen {
  const hash = window.location.hash.slice(1)
  return screens.includes(hash) ? hash as Screen : 'home'
}

function App() {
  const reducedMotion = useReducedMotion()
  const [screen, setScreen] = useState<Screen>(screenFromHash)
  const [cart, setCart, cartStorageAvailable] = useStoredState<CartItem[]>('fitmate.cart.v1', [], normalizeCart)
  const [combinations, setCombinations, savedStorageAvailable] = useStoredState<SavedCombination[]>('fitmate.saved.v1', [], normalizeSaved)
  const [previousCart, setPreviousCart, previousStorageAvailable] = useStoredState<CartItem[]>('fitmate.previous-cart.v1', [], normalizeCart)
  const [toast, setToast] = useState('')
  const [intro, setIntro] = useState(shouldShowIntro)
  const [exploreRequest, setExploreRequest] = useState<ExploreRequest>({})
  const [product, setProduct] = useState<Product | null>(null)
  const [replacement, setReplacement] = useState<AppliedReplacement | null>(null)
  const currentScreen = useRef(screen)
  const exploreOrigin = useRef<Screen>('home')
  const exploreScroll = useRef({ window: 0, shell: 0 })
  const nextScroll = useRef({ window: 0, shell: 0 })
  const analysis = useMemo(() => analyzeCart(cart, analysisDataset), [cart])
  const count = cart.reduce((sum, item) => sum + item.quantity, 0)
  const effectiveScreen = (screen === 'result' || screen === 'optimize') && cart.length < 2 ? 'cart' : screen
  const isDetail = effectiveScreen === 'result' || effectiveScreen === 'optimize'
  const isSaved = combinations.some(combination => cartKey(combination.items) === cartKey(cart))
  const navigate = useCallback((next: Screen) => {
    if (next === 'explore' && currentScreen.current !== 'explore') {
      exploreOrigin.current = currentScreen.current
      exploreScroll.current = { window: window.scrollY, shell: document.querySelector('.app-shell')?.scrollTop ?? 0 }
    }
    nextScroll.current = currentScreen.current === 'explore' && next === exploreOrigin.current ? exploreScroll.current : { window: 0, shell: 0 }
    currentScreen.current = next
    setProduct(null)
    setScreen(next)
    window.location.hash = next
    setToast('')
  }, [])
  useEffect(() => {
    const onHashChange = () => { const next = screenFromHash(); currentScreen.current = next; setScreen(next); setProduct(null) }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])
  useEffect(() => {
    window.scrollTo({ top: nextScroll.current.window, behavior: 'instant' })
    document.querySelector('.app-shell')?.scrollTo({ top: nextScroll.current.shell, behavior: 'instant' })
  }, [screen])
  const finishIntro = useCallback(() => setIntro(false), [])
  function explore(request: ExploreRequest = {}) {
    setExploreRequest(request)
    navigate('explore')
  }
  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 2700)
    return () => window.clearTimeout(timeout)
  }, [toast, cart])

  function addProduct(id: string) {
    setPreviousCart([])
    setReplacement(null)
    const existing = cart.find(item => item.productId === id)
    if (existing && existing.quantity >= 99) { setToast('용기는 제품별 최대 99개까지 담을 수 있어요'); return }
    setCart(current => normalizeCart([...current, { productId: id, quantity: 1 }]))
    setToast(`${productById.get(id)?.name} 담았어요`)
  }
  function changeQuantity(id: string, quantity: number) {
    setPreviousCart([])
    setReplacement(null)
    setCart(current => normalizeCart(current.map(item => item.productId === id ? { ...item, quantity } : item)))
  }
  function removeProducts(ids: string[]) {
    setPreviousCart([])
    setReplacement(null)
    setCart(current => current.filter(item => !ids.includes(item.productId)))
    setToast('선택한 제품을 삭제했어요')
  }
  function saveCombination() {
    if (cart.length < 2) return
    if (isSaved) { setToast('이미 보관한 조합이에요'); return }
    const createdAt = new Date().toISOString()
    setCombinations(current => [{ id: crypto.randomUUID(), createdAt, items: cart.map(item => ({ ...item })) }, ...current])
    setToast('내 정보에 조합을 저장했어요')
  }
  async function copySummary() {
    const text = `Fitmate 조합: ${cart.map(item => productById.get(item.productId)?.name).join(', ')}. 시연용 조합 비교 지표 ${analysis.score.value ?? '계산 불가'}/100. 주의·중복 규칙 ${analysis.findings.length}건. 함량 미확인 ${analysis.coverage.unknownAmounts}개, 추가 조건 ${analysis.deferredRules.length}개 보류. 의학적 안전성 평가가 아니며 전문가 검증이 필요합니다.`
    try { await navigator.clipboard.writeText(text); setToast('분석 요약을 복사했어요') }
    catch { setToast('이 브라우저에서는 복사를 사용할 수 없어요') }
  }
  function renderScreen() {
    // All result screens receive the analysis of the current persisted cart.
    switch (effectiveScreen) {
      case 'explore':
        return <Explore cart={cart} onAdd={addProduct} onRemove={removeProducts} onBack={() => navigate(exploreOrigin.current)} request={exploreRequest} onProduct={setProduct} />
      case 'cart':
        return <Cart cart={cart} analysis={analysis} previousCart={previousCart} onQuantity={changeQuantity} onRemove={removeProducts} onExplore={() => navigate('explore')} onDemo={() => { setCart(demoCart.map(item => ({ ...item }))); setPreviousCart([]); setReplacement(null); navigate('cart') }} onReport={() => navigate('result')} onOptimize={() => navigate('optimize')} onSave={saveCombination} saved={isSaved} />
      case 'result':
        return <Result analysis={analysis} previousCart={previousCart} replacement={replacement} onBack={() => navigate('cart')} onOptimize={() => navigate('optimize')} onSave={saveCombination} saved={isSaved} onCopy={copySummary} />
      case 'optimize':
        return <Optimize cart={cart} before={analysis} onBack={() => navigate('result')} onApply={(sourceId, targetId) => {
          const candidate = getReplacementCandidates(cart, sourceId, analysisDataset).find(item => item.product.product_id === targetId)
          if (!candidate) { setToast('등록된 성분으로 비교할 수 있는 제품을 선택해주세요'); return }
          setPreviousCart(cart.map(item => ({ ...item })))
          setCart(candidate.items)
          setReplacement({ fromName: productById.get(sourceId)?.name ?? sourceId, toName: productById.get(targetId)?.name ?? targetId })
          navigate('result')
          setToast('변경된 조합을 다시 분석했어요')
        }} />
      case 'saved':
        return <Saved combinations={combinations} onLoad={combination => { setCart(combination.items.map(item => ({ ...item }))); setPreviousCart([]); setReplacement(null); navigate('cart'); setToast('보관한 조합을 불러왔어요') }} onRemove={id => { setCombinations(current => current.filter(item => item.id !== id)); setToast('보관한 조합을 삭제했어요') }} onExplore={() => navigate('explore')} />
      default:
        return <Home navigate={navigate} count={count} cart={cart} onAdd={addProduct} onRemove={removeProducts} onExplore={explore} onProduct={setProduct} onExample={items => { setCart(items.map(item => ({ ...item }))); setPreviousCart([]); setReplacement(null); navigate('cart'); setToast('예시 조합을 적용했어요') }} />
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="app-shell">
        <div inert={intro}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.main key={effectiveScreen} initial={{ opacity: reducedMotion ? 1 : 0 }} animate={{ opacity: 1 }} exit={{ opacity: reducedMotion ? 1 : 0 }} transition={{ duration: reducedMotion ? 0 : .18 }} onAnimationComplete={() => {
              if (effectiveScreen !== currentScreen.current) return
              window.scrollTo({ top: nextScroll.current.window, behavior: 'instant' })
              document.querySelector('.app-shell')?.scrollTo({ top: nextScroll.current.shell, behavior: 'instant' })
              nextScroll.current = { window: 0, shell: 0 }
            }}>
              <Suspense fallback={<section className="screen" role="status">화면을 불러오고 있어요.</section>}>{renderScreen()}</Suspense>
            </motion.main>
          </AnimatePresence>
          {!isDetail && <nav className="bottom-nav" aria-label="메인 내비게이션">
            {([{ id: 'home', label: '홈', icon: HomeIcon }, { id: 'explore', label: '탐색', icon: Search }, { id: 'cart', label: '조합함', icon: ShoppingCart }, { id: 'saved', label: '내 정보', icon: UserRound }] as const).map(({ id, label, icon: Icon }) => (
              <button key={id} className={`nav-item ${effectiveScreen === id ? 'active' : ''}`} aria-current={effectiveScreen === id ? 'page' : undefined} onClick={() => navigate(id)}>
                <span className="nav-icon"><Icon className={id === 'home' ? 'home-icon' : ''} />{id === 'cart' && count > 0 && <span className="count-badge" aria-hidden="true">{count > 99 ? '99+' : count}</span>}</span><span>{label}</span>{id === 'cart' && <span className="sr-only">제품 {count}개</span>}
              </button>
            ))}
          </nav>}
        </div>
        <AnimatePresence>{intro && <Intro onComplete={finishIntro} />}</AnimatePresence>
        {product && <ProductDetails product={product} count={cart.find(item => item.productId === product.product_id)?.quantity ?? 0} onClose={() => setProduct(null)} onAdd={addProduct} onRemove={removeProducts} />}
        {toast && <div className="toast" role="status"><span><Check size={17} />{toast}</span>{toast.endsWith('담았어요') ? <button onClick={() => navigate('cart')}>조합함 보기</button> : <button aria-label="알림 닫기" onClick={() => setToast('')}><X size={15} /></button>}</div>}
        {(!cartStorageAvailable || !savedStorageAvailable || !previousStorageAvailable) && <div className="storage-notice" role="status">이 브라우저에서는 변경 내용이 새로고침 후 유지되지 않아요.</div>}
      </div>
    </MotionConfig>
  )
}
export default App
