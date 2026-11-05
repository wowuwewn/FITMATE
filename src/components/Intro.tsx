import { useEffect } from 'react'
import { motion, useReducedMotion } from 'motion/react'

export function Intro({ onComplete }: { onComplete: () => void }) {
  const reducedMotion = useReducedMotion()
  useEffect(() => {
    const timer = window.setTimeout(onComplete, 1650)
    return () => window.clearTimeout(timer)
  }, [onComplete, reducedMotion])
  return <motion.div className="intro-screen" role="status" aria-label="Fitmate 시작 안내" initial={{ opacity: 1 }} exit={{ opacity: 0, y: reducedMotion ? 0 : -24 }} transition={{ duration: reducedMotion ? 0 : .35, ease: [.2, .75, .25, 1] }}>
    <motion.div className="intro-brand" initial={{ opacity: reducedMotion ? 1 : 0, x: reducedMotion ? 0 : -24, filter: reducedMotion ? 'blur(0px)' : 'blur(6px)' }} animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }} transition={{ duration: reducedMotion ? 0 : .7, ease: [.2, .75, .25, 1] }}>
      <svg viewBox="0 0 60 60" fill="none" aria-hidden="true"><path d="M16 43V17h28M16 30h21" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" /><circle cx="44" cy="43" r="5" fill="currentColor" /></svg>
      <span className="wordmark">Fitmate</span><p>함께 먹는 조합,<br />차근차근 알아가요.</p>
    </motion.div>
    <span className="intro-caption">나의 영양 루틴을 위한 작은 확인</span>
  </motion.div>
}
