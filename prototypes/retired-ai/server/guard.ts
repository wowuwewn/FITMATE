import type { EvidenceFact } from '../src/assistant/types'
import { analysisDataset } from '../src/analysis/data'

export const assistantInstructions = `당신은 Fitmate의 분석 결과 설명자다. 한국어로 쉽고 짧게 설명한다.
입력 facts는 서버에서 기존 JSON 엔진으로 계산한 매칭·감점 사실이다. 이것만 사용한다. 다른 지식이나 추측을 추가하지 않는다.
새 의학적 설명, 효능, 시너지, 안전 판단, 권장량, 복용 지시를 절대 생성하지 않는다. 성분이 위험하다고 단정하지 않고 어떤 규칙에 매칭되어 어떤 감점이 적용됐는지만 설명한다.
현재와 이전 조합을 혼동하지 않는다. 점수 차이가 임상 개선을 뜻한다고 쓰지 않는다. 정보가 없으면 정보 부족이라고 쓴다.
각 문장에 반드시 근거 factIds를 붙인다. 수치·제품·규칙은 인용한 facts와 정확히 일치해야 한다. URL은 본문에 쓰지 않는다.
출력은 segments 배열 JSON으로, 최대 4개 문장, 문장별 180자 이내다. 한 문장에서 다른 근거의 값을 섞지 않는다.
임상 관련 문구나 면책 문구는 앱에서 별도로 표시하므로 생성하지 말고, 매칭 및 점수 계산 사실만 요약한다.`

export function outputSchema(facts: EvidenceFact[]) {
  return { type: 'object', additionalProperties: false, required: ['segments'], properties: { segments: { type: 'array', minItems: 1, maxItems: 4, items: { type: 'object', additionalProperties: false, required: ['text', 'factIds'], properties: { text: { type: 'string' }, factIds: { type: 'array', minItems: 1, maxItems: 4, items: { type: 'string', enum: facts.map(fact => fact.id) } } } } } } }
}

// Fail closed on unsupported IDs, links, quantities, clinical language or values.
// Provenance validation is not a medical/semantic validation of arbitrary prose.
export function validateOutput(value: unknown, facts: EvidenceFact[]) {
  if (!value || typeof value !== 'object' || Object.keys(value).join() !== 'segments') throw new Error('INVALID_OUTPUT')
  const segments = (value as { segments: unknown }).segments
  if (!Array.isArray(segments) || !segments.length || segments.length > 4) throw new Error('INVALID_OUTPUT')
  return segments.map(item => {
    if (!item || typeof item !== 'object' || Object.keys(item).some(key => !['text', 'factIds'].includes(key)) || typeof item.text !== 'string' || !item.text.trim() || item.text.length > 180 || !Array.isArray(item.factIds) || !item.factIds.length || item.factIds.length > 4 || !item.factIds.every((id: unknown) => typeof id === 'string' && facts.some(fact => fact.id === id))) throw new Error('INVALID_OUTPUT')
    const text = item.text as string
    if (/(https?:|www\.|<|>|시너지|효능|효과|안전|위험|복용|섭취|흡수|혈|독성|치료|예방|수면|신장|간격|유당|용량|권장|알레르기|부작용|개선|괜찮|문제\s*없|문제가\s*없|걱정|드세요|드셔|먹|마시|추천|질환|통증|증상|완화|면역|mg\b|mcg\b|\d\s*(?:g|그램|밀리|시간|스쿱|알|정)\b)/i.test(text)) throw new Error('UNSUPPORTED_CLAIM')
    const selected = facts.filter(fact => item.factIds.includes(fact.id)).map(fact => fact.text + ' ' + fact.ruleIds.join(' ') + ' ' + fact.productIds.join(' ')).join(' ')
    const names = [...analysisDataset.ingredients.map(item => item.name_ko), ...analysisDataset.products.map(item => item.display_name.replace(/^시연용\s*/, '').split(' — ')[0])]
    if (names.some(name => text.includes(name) && !selected.includes(name))) throw new Error('UNSUPPORTED_ENTITY')
    const numbers = new Set(selected.match(/-?\d+(?:\.\d+)?/g) ?? [])
    if ((text.match(/-?\d+(?:\.\d+)?/g) ?? []).some(number => !numbers.has(number))) throw new Error('UNSUPPORTED_VALUE')
    const ids = new Set(selected.match(/[PMR]\d{2}/g) ?? [])
    if ((text.match(/[PMR]\d{2}/g) ?? []).some(id => !ids.has(id))) throw new Error('UNSUPPORTED_REFERENCE')
    return { text: text.trim(), factIds: [...new Set(item.factIds as string[])] }
  })
}
