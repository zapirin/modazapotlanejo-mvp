const { PrismaClient } = require('./src/generated/client');
const prisma = new PrismaClient();

async function debug() {
    const email = 'kalexa.fashion@gmail.com';
    console.log(`Checking user: ${email}`);
    
    try {
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            console.log('User NOT found in database.');
        } else {
            console.log('User found:', JSON.stringify(user, null, 2));
        }

        const allUsersWithResetToken = await prisma.user.findMany({
            where: {
                NOT: { resetToken: null }
            }
        });
        console.log(`Users with reset tokens: ${allUsersWithResetToken.length}`);

    } catch (error) {
        console.error('Database error during debug:', error);
    } finally {
        await prisma.$disconnect();
    }
}

debug();
