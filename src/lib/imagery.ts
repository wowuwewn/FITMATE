import type { ProductCategory } from './categories'

// Illustrative packaging only; assets do not supply product composition or claims.
export const categoryImages: Record<ProductCategory, string> = {
  '전체': '/images/white-jar-demo.png',
  '프로틴': '/images/white-jar-demo.png',
  '프로틴 스낵&식품': '/images/mockups/snack.webp',
  '크레아틴': '/images/mockups/creatine.webp',
  '비타민&미네랄': '/images/amber-bottle-demo.png',
  '다이어트&커팅': '/images/mockups/diet.webp',
  '유산균': '/images/mockups/probiotic.webp',
  '지방산&오일': '/images/mockups/oil.webp',
  '식물&기능성 추출물': '/images/mockups/extract.webp',
}

export const productImages: Record<string, string> = {
  P01: '/images/white-jar-demo.png', P02: '/images/white-jar-demo.png', P03: '/images/white-jar-demo.png',
  P04: '/images/mockups/creatine.webp', P05: '/images/mockups/energy.webp',
  P06: '/images/charcoal-jar-demo.png', P07: '/images/amber-bottle-demo.png',
  P08: '/images/amber-bottle-demo.png', P09: '/images/amber-bottle-demo.png', P10: '/images/charcoal-jar-demo.png',
  ...Object.fromEntries(['M01', 'M02', 'M03', 'M04', 'M05', 'M06', 'M07'].map(id => [id, '/images/mockups/medication.webp'])),
}
