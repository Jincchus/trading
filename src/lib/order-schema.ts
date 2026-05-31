import { z } from 'zod'

export const MAX_ORDER_USD = parseFloat(process.env.MAX_ORDER_USD ?? '10000')

export const orderSchema = z.object({
  ticker: z.string().regex(/^[A-Za-z.]{1,8}$/, 'Invalid ticker symbol'),
  side: z.enum(['buy', 'sell']),
  type: z.enum(['market', 'limit']),
  qty: z.number().positive().optional(),
  notional: z.number().positive().max(MAX_ORDER_USD, `단일 주문 최대 $${MAX_ORDER_USD}`).optional(),
  limitPrice: z.number().positive().optional(),
  extendedHours: z.boolean().optional(),
  lotId: z.string().optional(),
  clientOrderId: z.string().default(() => crypto.randomUUID()),
}).refine(
  (d) => d.qty !== undefined || d.notional !== undefined,
  { message: 'qty 또는 notional 중 하나 필수' }
)

export type OrderInput = z.infer<typeof orderSchema>
