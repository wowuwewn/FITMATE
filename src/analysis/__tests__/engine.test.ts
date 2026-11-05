import { describe, expect, it } from 'vitest'
import cartData from '../../data/cart_interactions_dataset.json'
import supplemental from '../../data/supplement_interactions_with_lactose_ko.json'
import { analysisDataset } from '../data'
import { analyzeCart } from '../engine'
import { evaluateCondition } from '../conditions'
import { compareAnalyses, getReplacementCandidates } from '../optimization'
import type { AnalysisDataset, CartItem, InteractionRule, ProductData } from '../types'

const cart = (...ids: string[]): CartItem[] => ids.map(productId => ({ productId, quantity: 1 }))
const analyze = (items: CartItem[], data = analysisDataset) => analyzeCart(items, data)
const ruleIds = (items: CartItem[], data = analysisDataset) => [...new Set(analyze(items, data).findings.map(finding => finding.ruleId))].sort()
const withProducts = (...products: ProductData[]): AnalysisDataset => ({ ...analysisDataset, products: [...analysisDataset.products, ...products] })

describe('원본 matching_contract', () => {
  for (const example of cartData.demo_carts) {
    it(`${example.product_ids.join('+')} → ${example.expected_rule_ids.join(',') || '규칙 없음'}`, () => {
      expect(ruleIds(cart(...example.product_ids))).toEqual([...example.expected_rule_ids].sort())
      expect(ruleIds(cart(...[...example.product_ids].reverse()))).toEqual([...example.expected_rule_ids].sort())
    })
  }
  it('동일 규칙·정렬된 제품 쌍을 한 번만 표시한다', () => {
    const data = { ...analysisDataset, rules: [...analysisDataset.rules, ...analysisDataset.rules] }
    expect(analyze(cart('P02', 'M02'), data).findings).toHaveLength(1)
    expect(analyze([...cart('P02', 'M02'), ...cart('P02')], data).findings).toHaveLength(1)
  })
  it('여러 제품의 모든 쌍을 검사하고 같은 원인은 한 번만 감점한다', () => {
    const result = analyze(cart('P02', 'M02', 'P07', 'P08'))
    expect(result.coverage.evaluatedPairs).toBe(6)
    expect(result.findings.map(finding => finding.ruleId).sort()).toEqual(['R06', 'R07', 'R07', 'R13'])
    expect(result.score.deductions).toHaveLength(3)
    expect(result.score.value).toBe(73)
  })
  it('동일 제품의 수량은 성분 중복·섭취량으로 취급하지 않는다', () => {
    const result = analyze([{ productId: 'P04', quantity: 99 }, ...cart('P01')])
    expect(result.duplicates).toHaveLength(0)
    expect(result.findings).toHaveLength(0)
    expect(result.products.find(product => product.productId === 'P04')?.quantity).toBe(99)
    expect(result.score.value).toBe(analyze(cart('P04', 'P01')).score.value)
  })
  it('규칙 없는 동일 성분은 관찰 정보만 제공하고 새로운 감점을 만들지 않는다', () => {
    const result = analyze(cart('P01', 'P02'))
    expect(result.duplicates.map(item => item.ingredientId)).toEqual(['protein'])
    expect(result.duplicates[0].ruleIds).toEqual([])
    expect(result.findings).toHaveLength(0)
    expect(result.score.value).toBe(100)
  })
  it('약물 관련 관계를 일반 보충제 관계와 구분한다', () => {
    expect(analyze(cart('P03', 'M01')).findings[0].medicationRelated).toBe(true)
    expect(analyze(cart('P04', 'P05')).findings[0].medicationRelated).toBe(false)
  })
})

describe('데이터 부족과 조건 평가', () => {
  it('함량 null은 0이 아니며 정량 판정을 만들지 않는다', () => {
    const result = analyze(cart('P02', 'M02'))
    expect(result.products.flatMap(product => product.ingredients).every(ingredient => ingredient.amount === null)).toBe(true)
    expect(result.coverage.unknownAmounts).toBe(3)
    expect(result.findings[0].detailedEvaluation.status).toBe('unknown')
    expect(result.findings[0].detailedEvaluation.reason).toContain('시간')
    expect(result.score.value).toBe(88)
  })
  it('등록된 0 함량과 단위를 그대로 보존하지만 용기를 일일 섭취량으로 합산하지 않는다', () => {
    // Test-only label fixture, not a clinical rule or a production product.
    const data = withProducts({ product_id: 'test-zero', display_name: '테스트', category: 'supplement', ingredients: [{ ingredient_id: 'caffeine', amount: 0, unit: 'mg' }] })
    const result = analyze([{ productId: 'test-zero', quantity: 4 }, ...cart('P01')], data)
    expect(result.products.find(product => product.productId === 'test-zero')?.ingredients[0].amount).toBe(0)
    expect(result.coverage.unknownAmounts).toBe(1)
  })
  it('성분 목록·미등록 제품·미등록 성분을 누락으로 보고하며 숫자를 추측하지 않는다', () => {
    const data = withProducts(
      { product_id: 'empty', display_name: '빈 테스트', category: 'supplement' },
      { product_id: 'unknown-id', display_name: '미등록 성분 테스트', category: 'supplement', ingredients: [{ ingredient_id: 'not-registered', amount: null, unit: null }] },
    )
    const result = analyze(cart('empty', 'unknown-id', 'missing-product'), data)
    expect(result.score.value).toBeNull()
    expect(result.issues.map(issue => issue.code)).toEqual(expect.arrayContaining(['missing_ingredients', 'unknown_product', 'unknown_ingredient', 'unknown_amount']))
  })
  it('일부 제품 정보가 부족하면 알려진 쌍만 확인하고 누락 쌍 수를 남긴다', () => {
    const result = analyze(cart('P02', 'M02', 'missing-product'))
    expect(result.coverage.totalPairs).toBe(3)
    expect(result.coverage.evaluatedPairs).toBe(1)
    expect(result.score.value).toBe(88)
    expect(result.coverage.missingIngredientProducts).toBe(1)
  })
  it('빈 조합과 제품 한 개는 숫자 점수 대신 분석 정보 부족을 반환한다', () => {
    expect(analyze([]).score.value).toBeNull()
    expect(analyze(cart('P01')).score.value).toBeNull()
  })
  it('미지원 필수 조건을 참으로 처리하거나 감점하지 않는다', () => {
    const original = analysisDataset.rules.find(rule => rule.rule_id === 'R06')!
    const data = { ...analysisDataset, rules: [{ ...original, condition: { op: 'dose_threshold_not_supported', threshold: 10 } }] }
    const result = analyze(cart('P02', 'M02'), data)
    expect(result.findings).toHaveLength(0)
    expect(result.coverage.skippedRules).toBe(1)
    expect(result.issues.some(issue => issue.code === 'unsupported_rule')).toBe(true)
    expect(result.score.value).toBeNull()
  })
  it('미지원 선택 상세 조건 때문에 원본의 성분 쌍 경고를 버리지 않는다', () => {
    const original = analysisDataset.rules.find(rule => rule.rule_id === 'R06')!
    const data = { ...analysisDataset, rules: [{ ...original, original_condition_for_optional_detailed_evaluation: { op: 'unknown-detail' } }] }
    const result = analyze(cart('P02', 'M02'), data)
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0].detailedEvaluation.status).toBe('unsupported')
  })
  it('명시적으로 지원하는 존재·서로 다른 제품 수 조건만 평가한다', () => {
    const products = analyze(cart('P04', 'P05')).products
    expect(evaluateCondition({ op: 'active_entities_present', entity_ids: ['caffeine'] }, products).status).toBe('met')
    expect(evaluateCondition({ op: 'active_entities_present', entity_ids: ['iron'] }, products).status).toBe('not_met')
    expect(evaluateCondition({ op: 'distinct_products_same_ingredient', ingredient_id: 'caffeine', min_products: 2 }, products).status).toBe('met')
    expect(evaluateCondition({ op: 'distinct_products_same_ingredient', ingredient_id: 'caffeine', min_products: 2, window: 'local_day' }, products).status).toBe('unknown')
    expect(evaluateCondition({ op: 'active_entities_present', entity_ids: ['caffeine'], qualifier: { any: ['start'] } }, products).status).toBe('unknown')
    expect(evaluateCondition({ op: 'active_entities_present', entity_ids: ['caffeine'], mystery: true }, products).status).toBe('unsupported')
    expect(evaluateCondition({ op: 'all', children: [] }, products).status).toBe('unsupported')
  })
  it('부적합 severity·매칭 방식·방향을 조용히 적용하지 않는다', () => {
    const rule = analysisDataset.rules.find(rule => rule.rule_id === 'R06')!
    for (const overrides of [{ severity: 'unrecognized' }, { match: 'new_match' }, { symmetric: false }, { conditions: [] }]) {
      const result = analyze(cart('P02', 'M02'), { ...analysisDataset, rules: [{ ...rule, ...overrides }] })
      expect(result.coverage.skippedRules).toBe(1)
      expect(result.findings).toHaveLength(0)
    }
  })
  it('두 번째 JSON의 모든 조건부 규칙을 읽고 미평가 이유를 보존한다', () => {
    const result = analyze(cart('P01', 'M01'))
    expect(result.deferredRules).toHaveLength(supplemental.rules.length)
    expect(result.deferredRules.filter(rule => rule.type === 'personal_condition_check')).toHaveLength(4)
    expect(result.deferredRules.find(rule => rule.id === 'INT-005')?.reason).toContain('potassium_supplement')
    expect(result.deferredRules.find(rule => rule.id === 'LAC-001')?.sourceUrls.length).toBeGreaterThan(0)
    expect(result.findings).toHaveLength(0)
  })
  it('출처는 유효한 HTTPS만 사용하며 URL이 없으면 만들지 않는다', () => {
    const rule = analysisDataset.rules.find(rule => rule.rule_id === 'R06')!
    const source = 'https://example.org/source'
    const result = analyze(cart('P02', 'M02'), { ...analysisDataset, rules: [{ ...rule, source_urls: ['javascript:alert(1)', 'not a URL', source, source] }] })
    expect(result.findings[0].sourceUrls).toEqual([source])
    expect(analyze(cart('P02', 'M02'), { ...analysisDataset, rules: [{ ...rule, source_urls: [] }] }).findings[0].sourceUrls).toEqual([])
  })
})

describe('시연 비교 지표와 교체', () => {
  it('severity를 반영하되 의학적 안전 등급을 만들지 않는다', () => {
    expect(analyze(cart('P04', 'P05')).score.value).toBe(97)
    expect(analyze(cart('P02', 'M02')).score.value).toBe(88)
    expect(analyze(cart('P03', 'M01')).score.value).toBe(75)
    expect(analyze(cart('P01', 'M01')).score.value).toBe(100)
  })
  it('같은 원인의 여러 규칙은 최대 감점만 한 번 적용한다', () => {
    const info = analysisDataset.rules.find(rule => rule.rule_id === 'R01')!
    // Test-only conflicting severities establish de-duplication semantics.
    const second: InteractionRule = { ...info, rule_id: 'TEST-CAUSE', severity: 'high' }
    const result = analyze(cart('P04', 'P05'), { ...analysisDataset, rules: [info, second] })
    expect(result.findings).toHaveLength(2)
    expect(result.score.deductions).toHaveLength(1)
    expect(result.score.deductions[0].ruleIds).toEqual(['R01', 'TEST-CAUSE'])
    expect(result.score.value).toBe(75)
  })
  it('제품·규칙 순서와 재실행에 무관하게 같은 점수와 근거를 만든다', () => {
    const items = cart('P02', 'M02', 'P07', 'P08')
    const first = analyze(items)
    const second = analyze([...items].reverse(), { ...analysisDataset, rules: [...analysisDataset.rules].reverse() })
    expect(second).toEqual(first)
    expect(analyze(items)).toEqual(first)
  })
  it('제품 추가·삭제로 재계산하고 전체 지표는 0~100 범위다', () => {
    expect(analyze(cart('P01', 'M02')).score.value).toBe(100)
    expect(analyze(cart('P01', 'M02', 'P02')).score.value).toBe(88)
    expect(analyze(cart('P01', 'M02')).score.value).toBe(100)
    const all = analyze(cart(...cartData.products.map(product => product.product_id)))
    expect(all.score.value).toBe(0)
    expect(all.score.rawDeduction).toBeGreaterThan(100)
  })
  it('교체 후보는 공통 등록 성분이 있는 실제 보충제만 고른다', () => {
    const candidates = getReplacementCandidates([{ productId: 'P02', quantity: 3 }, ...cart('M02')], 'P02', analysisDataset)
    expect(candidates.map(candidate => candidate.product.product_id)).toEqual(['P01', 'P03'])
    const replacement = candidates[0]
    expect(replacement.items).toEqual([{ productId: 'P01', quantity: 3 }, { productId: 'M02', quantity: 1 }])
    expect(replacement.comparison.before.score.value).toBe(88)
    expect(replacement.comparison.after.score.value).toBe(100)
    expect(replacement.comparison.scoreDelta).toBe(12)
    expect(replacement.comparison.removedCauses[0].ruleIds).toEqual(['R06'])
    expect(replacement.comparison.addedCauses).toHaveLength(0)
    expect(replacement.comparison.after).toEqual(analyze(replacement.items))
  })
  it('새 주의 관계도 같은 엔진으로 비교한다', () => {
    const comparison = compareAnalyses(analyze(cart('P01', 'M01')), analyze(cart('P03', 'M01')))
    expect(comparison.scoreDelta).toBe(-25)
    expect(comparison.addedCauses[0].ruleIds).toEqual(['R28'])
  })
  it('제품 쌍만 바뀌고 원인이 같으면 관계 해소라고 표시하지 않는다', () => {
    const comparison = compareAnalyses(analyze(cart('P07', 'M02')), analyze(cart('P08', 'M02')))
    expect(comparison.removedCauses).toHaveLength(0)
    expect(comparison.addedCauses).toHaveLength(0)
    expect(comparison.scoreDelta).toBe(0)
  })
  it('복용약·성분 없는 제품과 공통 성분 없는 제품은 추천하지 않는다', () => {
    expect(getReplacementCandidates(cart('P02', 'M02'), 'M02', analysisDataset)).toEqual([])
    expect(getReplacementCandidates(cart('P06', 'P01'), 'P06', analysisDataset)).toEqual([])
    expect(getReplacementCandidates(cart('P01'), 'not-in-cart', analysisDataset)).toEqual([])
  })
  it('입력과 원본 데이터는 분석·교체로 수정되지 않는다', () => {
    const items = cart('P02', 'M02')
    const originalData = JSON.stringify(analysisDataset), originalItems = JSON.stringify(items)
    analyze(items)
    getReplacementCandidates(items, 'P02', analysisDataset)
    expect(JSON.stringify(analysisDataset)).toBe(originalData)
    expect(JSON.stringify(items)).toBe(originalItems)
  })
  it('다른 장바구니 제품의 성분도 누락돼 있으면 개선 후보를 추천하지 않는다', () => {
    const data = withProducts({ product_id: 'empty', display_name: '빈 테스트', category: 'supplement' })
    expect(getReplacementCandidates(cart('P01', 'M02', 'empty'), 'P01', data)).toEqual([])
  })
  it('미지원 필수 규칙을 제거하는 것만으로 개선 후보를 만들지 않는다', () => {
    const rule = analysisDataset.rules.find(rule => rule.rule_id === 'R06')!
    const data = { ...analysisDataset, rules: [{ ...rule, condition: { op: 'unsupported' } }] }
    expect(getReplacementCandidates(cart('P02', 'M02'), 'P02', data)).toEqual([])
  })
})
