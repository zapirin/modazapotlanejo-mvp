import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Testing database connection...');
  try {
    const start = Date.now();
    const userCount = await prisma.user.count();
    const productCount = await prisma.product.count();
    const end = Date.now();
    console.log(`Connection successful!`);
    console.log(`Users: ${userCount}`);
    console.log(`Products: ${productCount}`);
    console.log(`Time taken: ${end - start}ms`);
  } catch (error) {
    console.error('Database connection failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
