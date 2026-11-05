import { productById } from './catalog'

export function displayProductName(id: string, fallback?: string) {
  return productById.get(id)?.name ?? fallback ?? id
}
