import type { CartItem } from '../analysis/types'

export const assistantQuestions = ['쉽게 요약해줘', '왜 감점됐나요?', '어떤 성분이 문제인가요?', '제품 교체 후 무엇이 달라졌나요?'] as const
export type AssistantRequest = { cart: CartItem[]; previousCart?: CartItem[]; question: string; fingerprint: string }
export type EvidenceFact = { id: string; text: string; ruleIds: string[]; productIds: string[]; sourceUrls: string[] }
export type AssistantReply = {
  kind: 'ai' | 'rules'
  fingerprint: string
  segments: { text: string; factIds: string[] }[]
  evidence: EvidenceFact[]
  model?: string
  cached?: boolean
}
