import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { introKey } from '../lib/intro'

export function Intro({ onComplete }: { onComplete: () => void }) {
  const reducedMotion = useReducedMotion()
  const skip = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    try { localStorage.setItem(introKey, 'true') } catch { /* Browsing works without persistence. */ }
    skip.current?.focus()
    const timer = window.setTimeout(onComplete, reducedMotion ? 0 : 1050)
    return () => window.clearTimeout(timer)
  }, [onComplete, reducedMotion])
  return <motion.div className="intro-screen" role="dialog" aria-modal="true" aria-label="Fitmate 시작 안내" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : .18 }} onKeyDown={event => { if (event.key === 'Escape') onComplete() }}>
    <button ref={skip} className="intro-skip" onClick={onComplete}>건너뛰기</button>
    <motion.div className="intro-brand" initial={{ opacity: reducedMotion ? 1 : 0, y: reducedMotion ? 0 : 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .45 }}>
      <svg viewBox="0 0 60 60" fill="none" aria-hidden="true"><path d="M16 43V17h28M16 30h21" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" /><circle cx="44" cy="43" r="5" fill="currentColor" /></svg>
      <span className="wordmark">Fitmate</span><p>함께 먹는 조합,<br />차근차근 알아가요.</p>
    </motion.div>
    <span className="intro-caption">나의 영양 루틴을 위한 작은 확인</span>
  </motion.div>
}
