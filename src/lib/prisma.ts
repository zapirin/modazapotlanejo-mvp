import { PrismaClient } from '@/generated/client'

const prismaClient = new PrismaClient({
    log: ['query'],
})

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? prismaClient

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
