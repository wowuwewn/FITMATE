export type Severity = 'info' | 'caution' | 'high'
export type CartItem = { productId: string; quantity: number }
export type IngredientAmount = { ingredient_id: string; amount: number | null; unit: string | null }
export type IngredientDefinition = { id: string; name_ko: string; kind: string }
export type ProductData = {
  product_id: string
  display_name: string
  category: string
  is_demo?: boolean
  composition_status?: string
  ingredients?: readonly IngredientAmount[] | null
}
export type InteractionRule = {
  rule_id: string
  ingredient_a: string
  ingredient_b: string
  match: string
  symmetric: boolean
  alert_type: string
  severity: string
  title: string
  message: string
  trigger_meaning?: string
  evidence_level?: string
  source_urls?: readonly string[]
  original_condition_for_optional_detailed_evaluation?: unknown
  condition?: unknown
  conditions?: unknown
  trigger?: unknown
}
export type DeferredRule = { id: string; source: string; type: string; reason: string; sourceUrls: string[] }
export type AnalysisDataset = {
  ingredients: readonly IngredientDefinition[]
  products: readonly ProductData[]
  rules: readonly InteractionRule[]
  deferredRules: readonly DeferredRule[]
  versions: { cart: string; supplemental: string }
}
export type ConditionEvaluation = { status: 'met' | 'not_met' | 'unknown' | 'unsupported'; reason: string }
export type AnalysisIssue = { code: string; message: string; productId?: string; ruleId?: string }
export type AnalyzedProduct = {
  productId: string
  displayName: string
  category: string
  quantity: number
  ingredients: { id: string; name: string; amount: number | null; unit: string | null; registered: boolean }[]
}
export type Finding = {
  key: string
  causeKey: string
  ruleId: string
  ingredientIds: [string, string]
  ingredientNames: [string, string]
  productIds: [string, string]
  severity: Severity
  kind: 'duplicate' | 'interaction'
  medicationRelated: boolean
  title: string
  message: string
  triggerMeaning: string
  evidenceLevel: string | null
  sourceUrls: string[]
  detailedEvaluation: ConditionEvaluation
}
export type DuplicateIngredient = { ingredientId: string; name: string; productIds: string[]; ruleIds: string[] }
export type ScoreDeduction = { causeKey: string; ingredientNames: [string, string]; severity: Severity; points: number; ruleIds: string[]; productPairs: [string, string][] }
export type ComparisonScore = { value: number | null; baseline: number; rawDeduction: number; deductions: ScoreDeduction[]; policyVersion: string }
export type AnalysisResult = {
  products: AnalyzedProduct[]
  findings: Finding[]
  duplicates: DuplicateIngredient[]
  issues: AnalysisIssue[]
  deferredRules: DeferredRule[]
  coverage: { totalPairs: number; evaluatedPairs: number; unknownAmounts: number; ingredientEntries: number; missingIngredientProducts: number; unregisteredIngredients: number; skippedRules: number }
  score: ComparisonScore
  fingerprint: string
}
