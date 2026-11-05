import type { AnalyzedProduct, ConditionEvaluation } from './types'

const result = (status: ConditionEvaluation['status'], reason: string): ConditionEvaluation => ({ status, reason })

// Deliberately small interpreter. Additional fields cannot silently become true.
// Counts are registered products, never daily doses or consumption events.
export function evaluateCondition(condition: unknown, products: readonly AnalyzedProduct[]): ConditionEvaluation {
  if (!condition || typeof condition !== 'object' || Array.isArray(condition)) return result('unsupported', '지원하지 않는 조건 구조입니다.')
  const item = condition as Record<string, unknown>
  const has = (product: AnalyzedProduct, id: string) => product.ingredients.some(ingredient => ingredient.registered && ingredient.id === id)
  switch (item.op) {
    case 'active_entities_present': {
      if (!Array.isArray(item.entity_ids) || !item.entity_ids.length || !item.entity_ids.every(id => typeof id === 'string')) return result('unsupported', '성분 ID 목록이 올바르지 않습니다.')
      if (Object.keys(item).some(key => !['op', 'entity_ids', 'ingredient_scope', 'qualifier'].includes(key))) return result('unsupported', '알 수 없는 추가 성분 조건이 있습니다.')
      if (!item.entity_ids.every(id => products.some(product => has(product, id)))) return result('not_met', '필요한 등록 성분이 모두 확인되지 않았습니다.')
      if ('ingredient_scope' in item || 'qualifier' in item) return result('unknown', '제품 범위·섭취 변경 이력이 없어 추가 조건을 판정하지 않았습니다.')
      return result('met', '필요한 등록 성분의 존재를 확인했습니다.')
    }
    case 'distinct_products_same_ingredient': {
      if (typeof item.ingredient_id !== 'string' || !Number.isInteger(item.min_products) || Number(item.min_products) < 2) return result('unsupported', '서로 다른 제품 수 조건이 올바르지 않습니다.')
      if (Object.keys(item).some(key => !['op', 'ingredient_id', 'min_products', 'window'].includes(key))) return result('unsupported', '알 수 없는 추가 중복 조건이 있습니다.')
      if (products.filter(product => has(product, item.ingredient_id as string)).length < Number(item.min_products)) return result('not_met', '해당 성분을 포함한 서로 다른 제품 수가 조건보다 적습니다.')
      if ('window' in item) return result('unknown', '동일 성분은 확인했지만 실제 같은 날 섭취했는지는 알 수 없습니다.')
      return result('met', '서로 다른 제품에 등록된 동일 성분을 확인했습니다.')
    }
    case 'oral_drug_separation':
      return result('unknown', '복용 시간·제형·라벨 확인 정보가 없어 시간 간격의 충족 여부를 계산하지 않았습니다.')
    default:
      return result('unsupported', `지원하지 않는 조건 연산자: ${typeof item.op === 'string' ? item.op : '미지정'}`)
  }
}
