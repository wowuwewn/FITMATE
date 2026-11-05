import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Check } from 'lucide-react'

const steps = ['등록된 성분 불러오기', '성분 관계 확인하기', '비교 지표 계산하기']
export function AnalysisOverlay({ onComplete }: { onComplete: () => void }) {
  const reducedMotion = useReducedMotion()
  const [step, setStep] = useState(0)
  const dialog = useRef<HTMLDivElement>(null)
  useEffect(() => { dialog.current?.focus() }, [])
  useEffect(() => {
    const timers = [window.setTimeout(() => setStep(1), reducedMotion ? 0 : 350), window.setTimeout(() => setStep(2), reducedMotion ? 0 : 750), window.setTimeout(onComplete, reducedMotion ? 80 : 1200)]
    return () => timers.forEach(window.clearTimeout)
  }, [onComplete, reducedMotion])
  return <motion.div ref={dialog} tabIndex={-1} className="analysis-overlay" role="dialog" aria-modal="true" aria-labelledby="analysis-title" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <div className="analysis-loader" aria-hidden="true"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="33" fill="none" stroke="#e8edf2" strokeWidth="5" /><motion.circle cx="40" cy="40" r="33" fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" strokeDasharray="90 120" animate={reducedMotion ? {} : { rotate: 360 }} transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }} /></svg></div>
    <h2 id="analysis-title">내 조합을 살펴보고 있어요</h2><p>제품에 등록된 성분을 차근차근 확인해요.</p>
    <div className="analysis-steps" aria-live="polite">{steps.map((label, index) => <span key={label} className={index <= step ? 'completed' : ''}><Check size={14} />{label}</span>)}</div>
  </motion.div>
}
