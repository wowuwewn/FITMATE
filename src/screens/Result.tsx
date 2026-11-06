import { ArrowLeft, Bookmark, Check, Share } from 'lucide-react'
import { ScoreGauge } from '../components/ScoreGauge'
import { CombinationDetails } from '../components/CombinationDetails'
import type { AnalysisResult } from '../analysis/types'

export type AppliedReplacement = { fromName: string; toName: string; previousScore: number | null }
type Props = { analysis: AnalysisResult; replacement: AppliedReplacement | null; onBack: () => void; onOptimize: () => void; onSave: () => void; onCopy: () => void; saved: boolean }

export function Result({ analysis, replacement, onBack, onOptimize, onSave, onCopy, saved }: Props) {
  const cautions = analysis.findings.filter(finding => finding.severity !== 'info').length
  return <section className="screen detail-screen result-screen result-screen--compact" aria-labelledby="result-heading">
    <header className="detail-header"><button className="icon-button" aria-label="조합함으로 돌아가기" onClick={onBack}><ArrowLeft /></button><h1 className="page-heading" id="result-heading">조합 분석 결과</h1><button className="icon-button" aria-label="분석 요약 복사" onClick={onCopy}><Share size={21} /></button></header>
    {replacement && <p className="change-confirmation" role="status"><Check size={15} />{replacement.fromName} → {replacement.toName}</p>}
    <ScoreGauge value={analysis.score.value} previousValue={replacement?.previousScore} />
    <div className="result-summary">
      <p>{analysis.score.value === null ? '비교할 성분 정보가 부족해요.' : `주의 관계 ${cautions}건 · 중복 성분 ${analysis.duplicates.length}개`}</p>
    </div>
    <CombinationDetails analysis={analysis} onOptimize={onOptimize} />
    <div className="detail-bottom-action"><button className="primary-button" onClick={onSave} disabled={saved}><Bookmark size={18} />{saved ? '내 정보에 저장됨' : replacement ? '변경한 조합 저장하기' : '이 조합 저장하기'}</button></div>
  </section>
}
