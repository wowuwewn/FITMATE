import { Sheet } from './Sheet'
import { CombinationDetails } from './CombinationDetails'
import type { AnalysisResult } from '../analysis/types'

export function CartDetails({ analysis, onClose, onOptimize }: { analysis: AnalysisResult; onClose: () => void; onOptimize: () => void }) {
  return <Sheet title="조합 상세 정보" onClose={onClose}>
    <CombinationDetails analysis={analysis} onOptimize={onOptimize} />
  </Sheet>
}
