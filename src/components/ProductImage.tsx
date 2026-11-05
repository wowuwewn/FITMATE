import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import type { Product } from '../lib/catalog'

export function ProductImage({ product, small = false }: { product: Product; small?: boolean }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className={`product-image ${small ? 'product-image--small' : ''}`}>
      {product.image && !failed
        ? <img draggable={false} src={product.image} alt={`${product.name} 패키지`} decoding="async" onError={() => setFailed(true)} />
        : <span className="missing-image" role="img" aria-label="제품 이미지 없음"><ImageOff aria-hidden="true" /><span>이미지 없음</span></span>}
      {!small && ['P01', 'P02', 'P03'].includes(product.product_id) && <span className="product-variant" aria-hidden="true">{({ P01: 'A', P02: 'B', P03: 'C' } as Record<string, string>)[product.product_id]}</span>}
    </div>
  )
}
