import { PrismaClient, Role } from '../generated/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

function hashPassword(password: string) {
    return createHash('sha256').update(password).digest('hex');
}

async function main() {
    const email = 'jcarlosdlt@gmail.com'; 
    const password = 'admin123';
    const hashedPassword = hashPassword(password);

    console.log(`Setting up admin user: ${email}...`);

    try {
        const existingUser = await prisma.user.findFirst({
            where: { email }
        });

        if (existingUser) {
            console.log(`User found (ID: ${existingUser.id}), updating to ADMIN...`);
            await prisma.user.update({
                where: { id: existingUser.id },
                data: {
                    role: Role.ADMIN,
                    passwordHash: hashedPassword,
                    isActive: true
                }
            });
        } else {
            console.log('User not found, creating new ADMIN...');
            await prisma.user.create({
                data: {
                    email,
                    name: 'Admin User',
                    role: Role.ADMIN,
                    passwordHash: hashedPassword,
                    isActive: true,
                    registeredDomain: null
                }
            });
        }

        console.log('✅ Admin set up successfully!');
        console.log('Email:', email);
        console.log('Password:', password);
        console.log('\nNow you can login at http://localhost:3000/login and go to /admin/marketplace');
    } catch (error) {
        console.error('❌ Error setting up admin:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
