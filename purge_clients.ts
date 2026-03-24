import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Borrando todos los clientes...');
  
  // Como las ventas tienen un `clientId: String?` (opcional) pero en el esquema anterior 
  // no le pusimos `onDelete: Cascade` a `Client`, primero desvinculamos ventas y abonos.
  
  // 1. Borrar todos los pagos a cuenta de tienda (StoreAccountPayment)
  await prisma.storeAccountPayment.deleteMany({});
  console.log('Pagos de cuenta borrados.');

  // 2. Desvincular todas las ventas de los clientes
  await prisma.sale.updateMany({
    data: {
      clientId: null,
    }
  });
  console.log('Ventas desvinculadas de clientes.');

  // 3. Borrar los clientes
  const deletedClients = await prisma.client.deleteMany({});
  
  console.log(`Se borraron ${deletedClients.count} clientes exitosamente.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
