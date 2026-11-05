import { describe, expect, it } from 'vitest'
import { categoryForProduct, categories } from '../../lib/categories'
import { categoryImages } from '../../lib/imagery'
import { products, productById } from '../../lib/catalog'
import dataset from '../../data/cart_interactions_dataset.json'

describe('탐색 데이터 무결성', () => {
  it('9개 분류를 제공하고 실제 원본 17개 제품만 사용한다', () => {
    expect(categories).toHaveLength(9)
    expect(products.map(item => item.product_id).sort()).toEqual(dataset.products.map(item => item.product_id).sort())
  })
  it('약물을 보충제 카테고리에 섞지 않고 카페인을 다이어트 식품으로 추정하지 않는다', () => {
    for (const product of products.filter(item => item.category === 'medication')) expect(categoryForProduct(product)).toBeNull()
    expect(productById.get('P04')?.group).toBeNull()
    expect(productById.get('P05')?.group).toBeNull()
    expect(productById.get('P02')?.group).toBe('프로틴')
    expect(productById.get('P08')?.group).toBe('비타민&미네랄')
  })
  it('빈 분류에 제품을 생성하지 않는다', () => {
    for (const category of ['프로틴 스낵&식품', '크레아틴', '다이어트&커팅', '유산균', '지방산&오일', '식물&기능성 추출물']) expect(products.filter(item => item.group === category)).toHaveLength(0)
  })
  it('모든 제품과 카테고리의 목업은 실제 프로젝트 파일로 존재한다', () => {
    const assets = import.meta.glob('/public/images/**/*.{png,webp}')
    for (const path of [...products.map(item => item.image), ...Object.values(categoryImages)]) {
      expect(typeof path).toBe('string')
      expect(assets).toHaveProperty(`/public${path}`)
    }
  })
})
