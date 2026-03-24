const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial Location and Admin user...');

  // Create primary store location
  const mainStore = await prisma.storeLocation.create({
    data: {
      name: 'Matriz Zapotlanejo',
      address: 'Zapotlanejo Centro',
      isWebStore: true
    }
  });

  console.log(`Created store: ${mainStore.name} (${mainStore.id})`);

  // Create admin user
  // (In a real app, hash the password. Here we will keep it simple or use a placeholder)
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@modazapotlanejo.com',
      name: 'Administrador General',
      role: 'ADMIN',
      locationId: mainStore.id
    }
  });

  console.log(`Created admin user: ${adminUser.email} (${adminUser.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
