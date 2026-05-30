import { z } from 'zod'

const schema = z.object({
  DATABASE_URL: z.string().default('file:./prisma/dev.db'),
  ALPACA_API_KEY: z.string().min(1),
  ALPACA_API_SECRET: z.string().min(1),
  ALPACA_BASE_URL: z.string().url().default('https://api.alpaca.markets'),
  ALPACA_WS_URL: z.string().url().default('wss://stream.data.alpaca.markets/v2/iex'),
  FMP_API_KEY: z.string().min(1),
  EXCHANGE_RATE_API_KEY: z.string().min(1),
  PORT: z.string().default('3000'),
})

export type Env = z.infer<typeof schema>

export function parseEnv(input: NodeJS.ProcessEnv): Env {
  const result = schema.safeParse(input)
  if (!result.success) {
    throw new Error(`Invalid environment variables: ${JSON.stringify(result.error.flatten().fieldErrors)}`)
  }
  return result.data
}

export const env = parseEnv(process.env)
