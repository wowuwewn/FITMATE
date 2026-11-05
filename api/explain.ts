import { checkRateLimit } from '@vercel/firewall'
import { createAssistantHandler } from '../server/assistant'

const handler = createAssistantHandler({ env: process.env, requireDistributedLimit: true, distributedLimit: async request => {
  if (process.env.NODE_ENV !== 'production') throw new Error('Production limiter unavailable')
  if (process.env.AI_RATE_LIMIT_ID) {
    const perClient = await checkRateLimit(process.env.AI_RATE_LIMIT_ID, { request, timeout: 2000 })
    if (perClient.error) throw new Error('Firewall rule unavailable')
    if (perClient.rateLimited) return false
  }
  const global = await checkRateLimit(process.env.AI_GLOBAL_LIMIT_ID!, { request, rateLimitKey: 'fitmate-ai-total', timeout: 2000 })
  if (global.error) throw new Error('Firewall rule unavailable')
  return !global.rateLimited
} })

export default { fetch: handler }
