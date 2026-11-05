import type { ProductData } from '../analysis/types'

export const categories = ['전체', '프로틴', '프로틴 스낵&식품', '크레아틴', '비타민&미네랄', '다이어트&커팅', '유산균', '지방산&오일', '식물&기능성 추출물'] as const
export type ProductCategory = typeof categories[number]
export type ExploreRequest = { query?: string; category?: ProductCategory; medications?: boolean }

// Caffeine alone does not establish a diet/food category. Unmapped supplements
// remain accessible under 전체; medications never enter supplement categories.
export function categoryForProduct(product: ProductData): ProductCategory | null {
  if (product.category !== 'supplement') return null
  const ids = product.ingredients?.map(item => item.ingredient_id) ?? []
  if (ids.includes('protein')) return '프로틴'
  if (ids.includes('creatine')) return '크레아틴'
  if (ids.some(id => id.startsWith('vitamin_') || ['magnesium', 'iron', 'zinc', 'calcium', 'potassium', 'niacin', 'folate'].includes(id))) return '비타민&미네랄'
  if (ids.includes('omega3')) return '지방산&오일'
  return null
}
