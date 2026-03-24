import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const p = await prisma.product.findFirst({
     include: { tags: true }
  })
  console.log("Product:", p?.id)
}
main().catch(console.error)
