import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from 'motion/react'
import { Search, ShoppingBag } from 'lucide-react'

const covers = [
  { title: <>지금 먹는 영양제,<br />함께 먹어도<br />괜찮을까?</>, description: <>함께 먹는 제품의 성분 관계를<br />차근차근 확인해보세요.</>, image: '/images/charcoal-jar-demo.png' },
  { title: <>하나씩 담으면,<br />한눈에 보이는<br />나의 조합.</>, description: <>먹고 있는 제품을 찾아 담고,<br />확인할 성분 관계를 살펴봐요.</>, image: '/images/white-jar-demo.png' },
  { title: <>제품을 바꾸고,<br />달라진 조합을<br />비교해보세요.</>, description: <>같은 규칙으로 비교한 뒤,<br />나만의 조합을 저장하세요.</>, image: '/images/amber-bottle-demo.png' },
]

export function HomeCover({ count, onEnter, onSearch, onCart }: { count: number; onEnter: () => void; onSearch: () => void; onCart: () => void }) {
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const controls = useAnimationControls()
  const reduced = useReducedMotion()
  const transitioning = useRef(false)
  useEffect(() => {
    const shell = document.querySelector<HTMLElement>('.app-shell')
    const rootOverflow = document.documentElement.style.overflow
    const shellOverflow = shell?.style.overflowY ?? ''
    document.documentElement.style.overflow = 'hidden'
    if (shell) shell.style.overflowY = 'hidden'
    return () => {
      document.documentElement.style.overflow = rootOverflow
      if (shell) shell.style.overflowY = shellOverflow
    }
  }, [])
  async function advance(next = true) {
    if (transitioning.current || (!next && index === 0)) return
    transitioning.current = true
    if (next && index === covers.length - 1) {
      await controls.start({ x: '-110%', transition: { duration: reduced ? 0 : .35, ease: [.2, .75, .25, 1] } })
      onEnter()
      return
    }
    setDirection(next ? 1 : -1)
    setIndex(current => current + (next ? 1 : -1))
  }
  const cover = covers[index]
  return <motion.section className="home-cover" aria-label="옆으로 넘기는 Fitmate 소개" tabIndex={0} animate={controls}
    onWheel={event => { if (Math.abs(event.deltaX) > 25) void advance(event.deltaX > 0) }}
    onKeyDown={event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        void advance(event.key === 'ArrowRight')
      }
    }}>
    <AnimatePresence initial={false} custom={direction}>
      <motion.div key={index} className={`cover-page cover-page--${index}`} custom={direction}
        variants={{ enter: (way: number) => ({ x: reduced ? 0 : `${way * 100}%`, opacity: reduced ? 0 : 1 }), center: { x: 0, opacity: 1 }, exit: (way: number) => ({ x: reduced ? 0 : `${way * -100}%`, opacity: reduced ? 0 : 1 }) }}
        initial="enter" animate="center" exit="exit" transition={{ duration: reduced ? 0 : .35, ease: [.2, .75, .25, 1] }}
        onAnimationComplete={definition => { if (definition === 'center') transitioning.current = false }}
        drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={.85} dragMomentum={false}
        onDragEnd={(_, info) => {
          if (info.offset.x < -45 || info.velocity.x < -450) void advance()
          else if (info.offset.x > 45 || info.velocity.x > 450) void advance(false)
        }}>
        <header className="home-header"><span className="wordmark">Fitmate<span>.</span></span><div className="home-header-actions"><button className="icon-button" aria-label="제품 검색" onClick={onSearch}><Search /></button><button className="icon-button" aria-label="조합함 열기" onClick={onCart}><ShoppingBag />{count > 0 && <span className="count-badge">{count}</span>}</button></div></header>
        <div className="cover-copy"><h1>{cover.title}</h1><p>{cover.description}</p></div>
        <div className="cover-image"><img src={cover.image} alt="보충제 패키지" draggable={false} fetchPriority="high" /></div>
        <div className="cover-pagination" aria-label={`${index + 1}번째 소개, 총 3개`}>{covers.map((item, dot) => <span key={item.image} className={dot === index ? 'active' : ''} />)}</div>
      </motion.div>
    </AnimatePresence>
  </motion.section>
}
