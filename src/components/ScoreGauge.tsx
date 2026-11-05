import { useEffect } from 'react'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'

export function ScoreGauge({ value }: { value: number | null }) {
  const reducedMotion = useReducedMotion()
  const target = value ?? 0
  const count = useMotionValue(target)
  const rounded = useTransform(count, latest => Math.round(latest))
  const offset = useTransform(count, latest => 100 - latest)
  useEffect(() => {
    const controls = animate(count, target, { duration: reducedMotion ? 0 : .68, ease: [0.2, 0.75, 0.25, 1] })
    return () => controls.stop()
  }, [count, target, reducedMotion])
  return (
    <div className="score-gauge" role="img" aria-label={value === null ? '분석 정보 부족. 숫자 지표를 계산하지 않았습니다.' : `시연용 조합 비교 지표 ${value}점, 100점 만점. 의학적 안전성 평가가 아니며 전문가 검증이 필요합니다.`}>
      <svg viewBox="0 0 240 240" fill="none" aria-hidden="true">
        <circle cx="120" cy="120" r="105" stroke="#E8EDF2" strokeWidth="11" />
        <motion.circle cx="120" cy="120" r="105" stroke="var(--accent)" strokeWidth="11" strokeLinecap="round" transform="rotate(-90 120 120)" pathLength={100} strokeDasharray="100" style={{ strokeDashoffset: offset }} />
      </svg>
      <div className="score-center" aria-hidden="true"><div className="score-value">{value === null ? <span>—</span> : <motion.span>{rounded}</motion.span>}<span className="score-denominator">/ 100</span></div><span className="score-label">{value === null ? '분석 정보 부족' : '시연 비교 지표'}</span></div>
    </div>
  )
}
