import dataset from '../data/cart_interactions_dataset.json'
import type { CartItem, IngredientAmount, ProductData } from '../analysis/types'
import { categoryForProduct } from './categories'
import { productImages } from './imagery'

export type { CartItem } from '../analysis/types'
export type Product = Omit<ProductData, 'ingredients'> & {
  ingredients: IngredientAmount[]
  name: string
  subtitle: string
  ingredientNames: string[]
  image?: string
  group: string | null
}

const ingredientNames = new Map(dataset.ingredients.map(item => [item.id, item.name_ko]))
const displayOrder = ['P01', 'P06', 'P08']

export const products: Product[] = (dataset.products as ProductData[]).map(product => {
  const [name, variant] = product.display_name.replace(/^시연용\s*/, '').replace('경구제 경구제', '경구제').split(' — ')
  const ingredients = [...product.ingredients ?? []]
  const ids = ingredients.map(item => item.ingredient_id)
  const names = ids.map(id => ingredientNames.get(id) ?? '미등록 성분')
  const group = categoryForProduct(product)
  return { ...product, ingredients, name, subtitle: variant ?? (names.length ? names.join(' · ') : '성분 정보 없음'), ingredientNames: names, image: productImages[product.product_id], group }
}).sort((a, b) => {
  const order = (id: string) => displayOrder.includes(id) ? displayOrder.indexOf(id) : 100
  return order(a.product_id) - order(b.product_id)
})

export const productById = new Map(products.map(product => [product.product_id, product]))
export { categories } from './categories'
export const demoCart: CartItem[] = ['P01', 'P06', 'P08'].map(productId => ({ productId, quantity: 1 }))

// Validate persisted data before using it. Quantities describe containers, never doses.
export function normalizeCart(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return []
  const quantities = new Map<string, number>()
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const { productId, quantity } = item as Partial<CartItem>
    if (typeof productId !== 'string' || !productById.has(productId) || typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity < 1) continue
    quantities.set(productId, Math.min(99, (quantities.get(productId) ?? 0) + Math.floor(quantity)))
  }
  return Array.from(quantities, ([productId, quantity]) => ({ productId, quantity }))
}

