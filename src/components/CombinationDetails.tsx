import { useId, useState } from 'react'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { AnalysisLimitations, FindingList } from './AnalysisDetails'
import type { AnalysisResult } from '../analysis/types'

type Section = 'minus' | 'plus' | 'suggestions'
export function CombinationDetails({ analysis, onOptimize }: { analysis: AnalysisResult; onOptimize: () => void }) {
  const [active, setActive] = useState<Section | null>(null)
  const id = useId()
  const sections = [
    { id: 'minus', title: '마이너스 조합' },
    { id: 'plus', title: '플러스 조합' },
    { id: 'suggestions', title: '개선 제안' },
  ] as const
  return <>
    <div className="combination-groups">{sections.map(section => <section className="combination-group" key={section.id}>
      <button className="combination-group-heading" aria-expanded={active === section.id} aria-controls={`${id}-${section.id}`} onClick={() => setActive(active === section.id ? null : section.id)}><span>{section.title}</span><ChevronDown size={17} className={active === section.id ? 'rotated' : ''} /></button>
      {active === section.id && <div id={`${id}-${section.id}`} className="combination-group-body">
        {section.id === 'minus' && (analysis.findings.length ? <FindingList findings={analysis.findings} /> : <p>확인된 감점 관계가 없어요.</p>)}
        {section.id === 'plus' && <p>등록된 시너지 근거가 없어 플러스 관계를 판단할 수 없어요.</p>}
        {section.id === 'suggestions' && <><p>제품을 교체해 점수와 성분 관계를 비교해보세요.</p><button className="secondary-button" disabled={analysis.products.length < 2 || !analysis.products.some(product => product.category === 'supplement')} onClick={onOptimize}>제품 교체 비교 <ArrowRight size={17} /></button></>}
      </div>}
    </section>)}</div>
    <AnalysisLimitations analysis={analysis} />
  </>
}
