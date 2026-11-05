import type { ComparisonScore, Finding, ScoreDeduction, Severity } from './types'

// Application comparison policy, explicitly authorized for demo use.
// These weights are NOT clinical risk, probabilities or ingredient tolerances.
export const SCORING_POLICY = {
  version: 'demo-comparison-v1',
  baseline: 100,
  weights: { info: 3, caution: 12, high: 25 } satisfies Record<Severity, number>,
} as const

export function scoreFindings(findings: readonly Finding[], canCompare: boolean): ComparisonScore {
  const causes = new Map<string, ScoreDeduction>()
  for (const finding of findings) {
    const points = SCORING_POLICY.weights[finding.severity]
    const existing = causes.get(finding.causeKey)
    if (!existing) {
      causes.set(finding.causeKey, { causeKey: finding.causeKey, ingredientNames: finding.ingredientNames, severity: finding.severity, points, ruleIds: [finding.ruleId], productPairs: [finding.productIds] })
    } else {
      if (points > existing.points) { existing.points = points; existing.severity = finding.severity }
      if (!existing.ruleIds.includes(finding.ruleId)) existing.ruleIds.push(finding.ruleId)
      if (!existing.productPairs.some(pair => pair[0] === finding.productIds[0] && pair[1] === finding.productIds[1])) existing.productPairs.push(finding.productIds)
    }
  }
  const deductions = [...causes.values()].sort((a, b) => a.causeKey.localeCompare(b.causeKey))
  for (const deduction of deductions) deduction.ruleIds.sort()
  const rawDeduction = deductions.reduce((sum, deduction) => sum + deduction.points, 0)
  return { value: canCompare ? Math.max(0, SCORING_POLICY.baseline - rawDeduction) : null, baseline: SCORING_POLICY.baseline, rawDeduction, deductions, policyVersion: SCORING_POLICY.version }
}
