import cartData from '../data/cart_interactions_dataset.json'
import supplementalData from '../data/supplement_interactions_with_lactose_ko.json'
import type { AnalysisDataset, DeferredRule } from './types'

// Keep both source JSON files intact. Different ingredient IDs are never aliased
// using names (e.g. potassium_supplement != potassium, protein != WPC/WPI).
export const deferredSupplementalRules: DeferredRule[] = supplementalData.rules.map(rule => {
  const registeredIds = new Set(cartData.ingredients.map(ingredient => ingredient.id))
  const missing = [rule.ingredient_a.key, rule.ingredient_b.key].filter(id => !registeredIds.has(id))
  const reason = rule.trigger.type === 'personal_condition_check'
    ? '개인 응답과 제품별 실제 유당·제형 정보가 없어 적용을 보류했습니다. 유당불내증을 성분 간 충돌로 취급하지 않습니다.'
    : '병용 확인 응답과 용량·약물 계열 등 제품 조건을 확인할 자료가 없어 적용을 보류했습니다.'
  return {
    id: rule.id,
    source: 'supplement_interactions_with_lactose_ko.json',
    type: rule.trigger.type,
    reason: reason + (missing.length ? ` 자동 매핑하지 않은 ID: ${missing.join(', ')}.` : ''),
    sourceUrls: ('sources' in rule ? rule.sources : [])?.flatMap(source => source.url.startsWith('https://') ? [source.url] : []) ?? [],
  }
})

export const analysisDataset: AnalysisDataset = {
  ingredients: cartData.ingredients,
  products: cartData.products,
  rules: cartData.interaction_rules,
  deferredRules: deferredSupplementalRules,
  versions: { cart: cartData.dataset_version, supplemental: supplementalData.version },
}
