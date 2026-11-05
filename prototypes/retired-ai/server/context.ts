import { analyzeCart } from '../src/analysis/engine'
import { analysisDataset } from '../src/analysis/data'
import { compareAnalyses, getReplacementCandidates } from '../src/analysis/optimization'
import type { AnalysisResult, CartItem } from '../src/analysis/types'
import { assistantQuestions } from '../src/assistant/types'
import type { EvidenceFact } from '../src/assistant/types'

export const canonicalCart = (cart: CartItem[]) => JSON.stringify([...cart].sort((a, b) => a.productId.localeCompare(b.productId)))
export function validateCart(value: unknown): CartItem[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 10) throw new Error('INVALID_CART')
  const seen = new Set<string>()
  return value.map(item => {
    if (!item || typeof item !== 'object' || Object.keys(item).some(key => !['productId', 'quantity'].includes(key)) || typeof item.productId !== 'string' || seen.has(item.productId) || !analysisDataset.products.some(product => product.product_id === item.productId) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) throw new Error('INVALID_CART')
    seen.add(item.productId)
    return { productId: item.productId, quantity: item.quantity }
  })
}

export function buildContext(cart: CartItem[], previousCart?: CartItem[]) {
  const analysis = analyzeCart(cart, analysisDataset)
  const facts: EvidenceFact[] = []
  const add = (id: string, text: string, ruleIds: string[] = [], productIds: string[] = [], sourceUrls: string[] = []) => facts.push({ id, text, ruleIds, productIds, sourceUrls: [...new Set(sourceUrls)] })
  add('score', `현재 시연용 비교 지표: ${analysis.score.value === null ? '정보 부족으로 숫자 없음' : analysis.score.value + '/100'}. 기준 ${analysis.score.baseline}, 고유 원인별 합계 감점 ${analysis.score.rawDeduction}. 정책 ${analysis.score.policyVersion}.`, [], cart.map(item => item.productId))
  add('coverage', `함량 미확인 ${analysis.coverage.unknownAmounts}개, 적용 보류된 추가 조건 ${analysis.deferredRules.length}개. 상세 조건 미평가.`)
  const addCauses = (result: AnalysisResult, prefix: string) => result.score.deductions.forEach((cause, index) => {
    const findings = result.findings.filter(item => item.causeKey === cause.causeKey)
    const ids = [...new Set(cause.productPairs.flat())]
    const names = ids.map(id => result.products.find(product => product.productId === id)!.displayName)
    // Only matching and scoring facts are paraphrased. Clinical guidance remains
    // in the original report, never generated from medical model knowledge.
    add(`${prefix}${index}`, `${names.join(' + ')}: 등록 성분 ${[...new Set(cause.ingredientNames)].join(' + ')} 관계가 ${cause.ruleIds.join(', ')}에 매칭됨. severity ${cause.severity}, 고유 원인 감점 ${cause.points}점. 같은 원인은 한 번만 차감.`, cause.ruleIds, ids, findings.flatMap(item => item.sourceUrls))
  })
  addCauses(analysis, 'current-')
  if (previousCart) {
    const validChange = previousCart.some(item => getReplacementCandidates(previousCart, item.productId, analysisDataset).some(candidate => canonicalCart(candidate.items) === canonicalCart(cart)))
    if (!validChange) throw new Error('INVALID_COMPARISON')
    const before = analyzeCart(previousCart, analysisDataset)
    const comparison = compareAnalyses(before, analysis)
    add('change', `교체 전 비교 지표 ${before.score.value}, 교체 후 ${analysis.score.value}. 변화 ${comparison.scoreDelta}점. 줄어든 고유 성분 관계 ${comparison.removedCauses.length}개, 새로 매칭된 관계 ${comparison.addedCauses.length}개.`, [...new Set([...before.findings, ...analysis.findings].map(item => item.ruleId))], [...new Set([...cart, ...previousCart].map(item => item.productId))])
    addCauses(before, 'previous-')
  }
  return { analysis, facts }
}

export function questionIndex(question: string) {
  const normalize = (text: string) => text.replace(/[\s?!？.!]/g, '')
  return assistantQuestions.findIndex(item => normalize(item) === normalize(question))
}
