import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createPrismaClient() {
  // Docker: DATABASE_URL=file:/app/prisma/trading.db
  // 로컬: DATABASE_URL=file:./prisma/dev.db
  return new PrismaClient({
    datasources: {
      db: { url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db' },
    },
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
