import { evaluateCondition } from './conditions'
import { scoreFindings } from './scoring'
import type { AnalysisDataset, AnalysisIssue, AnalysisResult, AnalyzedProduct, CartItem, DuplicateIngredient, Finding, Severity } from './types'

const severities = new Set(['info', 'caution', 'high'])
export const causeKeyFor = (a: string, b: string) => JSON.stringify([a, b].sort())
const safeUrls = (urls: readonly string[] = []) => [...new Set(urls.filter(url => {
  try { return new URL(url).protocol === 'https:' } catch { return false }
}))].sort()

export function analyzeCart(cart: readonly CartItem[], dataset: AnalysisDataset): AnalysisResult {
  const issues: AnalysisIssue[] = []
  const ingredientById = new Map(dataset.ingredients.map(ingredient => [ingredient.id, ingredient]))
  const catalog = new Map(dataset.products.map(product => [product.product_id, product]))
  const quantities = new Map<string, number>()
  for (const item of cart) {
    if (!item || typeof item.productId !== 'string' || !Number.isSafeInteger(item.quantity) || item.quantity < 1) {
      issues.push({ code: 'invalid_cart_item', message: '올바르지 않은 제품 또는 용기 수량을 분석에서 제외했습니다.' })
      continue
    }
    const total = (quantities.get(item.productId) ?? 0) + item.quantity
    if (!Number.isSafeInteger(total)) { issues.push({ code: 'invalid_quantity', productId: item.productId, message: '용기 수량 범위를 확인할 수 없습니다.' }); continue }
    quantities.set(item.productId, total)
  }
  const products: AnalyzedProduct[] = [...quantities].sort(([a], [b]) => a.localeCompare(b)).map(([productId, quantity]) => {
    const product = catalog.get(productId)
    if (!product) issues.push({ code: 'unknown_product', productId, message: `${productId}: 등록된 제품 정보가 없어 확인하지 못했습니다.` })
    const sourceIngredients = product?.ingredients ?? []
    if (!sourceIngredients.length) issues.push({ code: 'missing_ingredients', productId, message: `${product?.display_name ?? productId}: 성분 목록이 없어 일부 조합을 확인하지 못했습니다.` })
    const ingredients = sourceIngredients.map(ingredient => {
      const definition = ingredientById.get(ingredient.ingredient_id)
      if (!definition) issues.push({ code: 'unknown_ingredient', productId, message: `${ingredient.ingredient_id}: 성분 ID가 등록되지 않아 임의로 매핑하지 않았습니다.` })
      const amountKnown = typeof ingredient.amount === 'number' && Number.isFinite(ingredient.amount) && ingredient.amount >= 0 && typeof ingredient.unit === 'string' && ingredient.unit.trim().length > 0
      if (!amountKnown) issues.push({ code: 'unknown_amount', productId, message: `${definition?.name_ko ?? ingredient.ingredient_id}: 성분 함량 또는 단위가 없어 정량 판정을 하지 않았습니다.` })
      return { id: ingredient.ingredient_id, name: definition?.name_ko ?? ingredient.ingredient_id, registered: Boolean(definition), amount: amountKnown ? ingredient.amount : null, unit: amountKnown ? ingredient.unit : null }
    })
    return { productId, displayName: product?.display_name ?? productId, category: product?.category ?? 'unknown', quantity, ingredients }
  })
  const knownIds = (product: AnalyzedProduct) => new Set(product.ingredients.filter(ingredient => ingredient.registered).map(ingredient => ingredient.id))
  const findingByKey = new Map<string, Finding>()
  const duplicateById = new Map<string, DuplicateIngredient>()
  const skippedRules = new Set<string>()
  let evaluatedPairs = 0

  for (let i = 0; i < products.length; i++) {
    for (let j = i + 1; j < products.length; j++) {
      const a = products[i], b = products[j], aIds = knownIds(a), bIds = knownIds(b)
      if (!aIds.size || !bIds.size) continue
      evaluatedPairs++
      for (const id of aIds) {
        if (!bIds.has(id)) continue
        const duplicate = duplicateById.get(id) ?? { ingredientId: id, name: ingredientById.get(id)!.name_ko, productIds: [], ruleIds: [] }
        duplicate.productIds = [...new Set([...duplicate.productIds, a.productId, b.productId])].sort()
        duplicateById.set(id, duplicate)
      }
      for (const rule of dataset.rules) {
        const pairPresent = (aIds.has(rule.ingredient_a) && bIds.has(rule.ingredient_b)) || (aIds.has(rule.ingredient_b) && bIds.has(rule.ingredient_a))
        if (!pairPresent) continue
        const skip = (message: string) => {
          if (!skippedRules.has(rule.rule_id)) issues.push({ code: 'unsupported_rule', ruleId: rule.rule_id, message })
          skippedRules.add(rule.rule_id)
        }
        if (rule.match !== 'different_cart_products_contain_each_ingredient' || rule.symmetric !== true || !severities.has(rule.severity) || !['duplicate_ingredient', 'interaction_review'].includes(rule.alert_type)) {
          skip(`${rule.rule_id}: 미지원 매칭 방식·방향·severity·알림 유형이 있어 적용하지 않았습니다.`)
          continue
        }
        if (rule.conditions !== undefined || rule.trigger !== undefined) { skip(`${rule.rule_id}: 미지원 필수 조건 구조가 있어 적용하지 않았습니다.`); continue }
        if (rule.condition !== undefined) {
          const required = evaluateCondition(rule.condition, products)
          if (required.status === 'not_met') continue
          if (required.status !== 'met') { skip(`${rule.rule_id}: ${required.reason} 필수 조건을 확인할 수 없어 적용하지 않았습니다.`); continue }
        }
        const productIds: [string, string] = [a.productId, b.productId]
        const key = JSON.stringify([rule.rule_id, ...productIds])
        if (findingByKey.has(key)) continue
        const ids = [rule.ingredient_a, rule.ingredient_b].sort() as [string, string]
        const medicationRelated = [a, b].some(product => product.category === 'medication') || ids.some(id => ingredientById.get(id)?.kind.startsWith('medication'))
        const detailedEvaluation = rule.original_condition_for_optional_detailed_evaluation === undefined
          ? { status: 'unknown' as const, reason: '별도 상세 조건이 등록되지 않았으며 실제 복용 상황은 확인하지 않았습니다.' }
          : evaluateCondition(rule.original_condition_for_optional_detailed_evaluation, products)
        findingByKey.set(key, {
          key, causeKey: causeKeyFor(...ids), ruleId: rule.rule_id, ingredientIds: ids,
          ingredientNames: ids.map(id => ingredientById.get(id)!.name_ko) as [string, string], productIds,
          severity: rule.severity as Severity, kind: rule.alert_type === 'duplicate_ingredient' ? 'duplicate' : 'interaction',
          medicationRelated, title: rule.title, message: rule.message,
          triggerMeaning: rule.trigger_meaning ?? '등록된 성분 관계의 검토 안내이며 부작용 발생을 확정하지 않습니다.',
          evidenceLevel: rule.evidence_level ?? null, sourceUrls: safeUrls(rule.source_urls), detailedEvaluation,
        })
        if (ids[0] === ids[1]) {
          const duplicate = duplicateById.get(ids[0])
          if (duplicate && !duplicate.ruleIds.includes(rule.rule_id)) duplicate.ruleIds.push(rule.rule_id)
        }
      }
    }
  }
  const findings = [...findingByKey.values()].sort((a, b) => a.key.localeCompare(b.key))
  const duplicates = [...duplicateById.values()].sort((a, b) => a.ingredientId.localeCompare(b.ingredientId))
  const coverage = {
    totalPairs: products.length * (products.length - 1) / 2, evaluatedPairs,
    unknownAmounts: issues.filter(issue => issue.code === 'unknown_amount').length,
    ingredientEntries: products.reduce((count, product) => count + product.ingredients.length, 0),
    missingIngredientProducts: products.filter(product => !product.ingredients.length).length,
    unregisteredIngredients: issues.filter(issue => issue.code === 'unknown_ingredient').length,
    skippedRules: skippedRules.size,
  }
  // Partial reports may compare known pairs, but missing pairs never become safe.
  // With no evaluable pair there is no numeric score at all.
  return {
    products, findings, duplicates, issues,
    deferredRules: dataset.deferredRules.map(rule => ({ ...rule, sourceUrls: safeUrls(rule.sourceUrls) })),
    coverage, score: scoreFindings(findings, evaluatedPairs > 0 && skippedRules.size === 0),
    fingerprint: JSON.stringify({ products: products.map(product => [product.productId, product.quantity]), versions: dataset.versions }),
  }
}
