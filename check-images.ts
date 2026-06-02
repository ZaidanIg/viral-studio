import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const chars = await prisma.character.findMany({ take: 5 })
  console.log('Chars:', chars.flatMap(c => c.image_urls))
  
  const prods = await prisma.product.findMany({ take: 5 })
  console.log('Prods:', prods.flatMap(p => p.image_urls))
}

main().catch(console.error).finally(() => prisma.$disconnect())
