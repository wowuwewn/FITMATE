import { normalizeCart } from './catalog'
import type { CartItem } from './catalog'

export type SavedCombination = { id: string; createdAt: string; items: CartItem[] }
export function cartKey(cart: CartItem[]) {
  return [...cart].sort((a, b) => a.productId.localeCompare(b.productId)).map(item => `${item.productId}:${item.quantity}`).join('|')
}
export function normalizeSaved(value: unknown): SavedCombination[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value.flatMap(item => {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || typeof item.createdAt !== 'string' || !Number.isFinite(Date.parse(item.createdAt))) return []
    const items = normalizeCart(item.items)
    const key = cartKey(items)
    if (items.length < 2 || seen.has(key)) return []
    seen.add(key)
    return [{ id: item.id, createdAt: item.createdAt, items }]
  })
}
