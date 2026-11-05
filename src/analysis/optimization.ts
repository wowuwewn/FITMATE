import { analyzeCart } from './engine'
import type { AnalysisDataset, AnalysisResult, CartItem, ProductData } from './types'

export type AnalysisComparison = {
  before: AnalysisResult
  after: AnalysisResult
  scoreDelta: number | null
  removedCauses: AnalysisResult['score']['deductions']
  addedCauses: AnalysisResult['score']['deductions']
}
export type ReplacementCandidate = { product: ProductData; items: CartItem[]; comparison: AnalysisComparison }

export function compareAnalyses(before: AnalysisResult, after: AnalysisResult): AnalysisComparison {
  const beforeCauses = new Set(before.score.deductions.map(item => item.causeKey))
  const afterCauses = new Set(after.score.deductions.map(item => item.causeKey))
  return {
    before, after,
    scoreDelta: before.score.value === null || after.score.value === null ? null : after.score.value - before.score.value,
    removedCauses: before.score.deductions.filter(item => !afterCauses.has(item.causeKey)),
    addedCauses: after.score.deductions.filter(item => !beforeCauses.has(item.causeKey)),
  }
}

// This is an ingredient-presence comparison candidate, not an equivalent therapy.
// No medication replacement, fuzzy ID aliases, unknown ingredients or ingredients
// inferred from product names. Quantities remain container counts.
export function getReplacementCandidates(cart: readonly CartItem[], sourceId: string, dataset: AnalysisDataset): ReplacementCandidate[] {
  const source = dataset.products.find(product => product.product_id === sourceId)
  const sourceItem = cart.find(item => item.productId === sourceId)
  const registered = new Set(dataset.ingredients.map(ingredient => ingredient.id))
  if (!sourceItem || source?.category !== 'supplement' || !source.ingredients?.length || source.ingredients.some(ingredient => !registered.has(ingredient.ingredient_id))) return []
  const sourceIds = new Set(source.ingredients.map(ingredient => ingredient.ingredient_id))
  const before = analyzeCart(cart, dataset)
  if (before.score.value === null || before.coverage.missingIngredientProducts > 0 || before.coverage.unregisteredIngredients > 0 || before.coverage.skippedRules > 0) return []
  return dataset.products.filter(product =>
    product.category === 'supplement' && !cart.some(item => item.productId === product.product_id)
    && Boolean(product.ingredients?.length)
    && product.ingredients!.every(ingredient => registered.has(ingredient.ingredient_id))
    && product.ingredients!.some(ingredient => sourceIds.has(ingredient.ingredient_id)),
  ).map(product => {
    const items = cart.map(item => ({ ...item, productId: item.productId === sourceId ? product.product_id : item.productId }))
    return { product, items, comparison: compareAnalyses(before, analyzeCart(items, dataset)) }
  }).sort((a, b) =>
    (b.comparison.after.score.value ?? -1) - (a.comparison.after.score.value ?? -1)
    || a.comparison.addedCauses.length - b.comparison.addedCauses.length
    || a.product.product_id.localeCompare(b.product.product_id),
  )
}
