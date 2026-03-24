const { randomBytes, createHash } = require('crypto');
const { PrismaClient } = require('./src/generated/client');
const prisma = new PrismaClient();

// Mock sendEmail as it would be imported
async function sendEmail({ to, subject, html }) {
    console.log('sendEmail called for:', to);
    // Let's see if this throws or returns an error
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        console.log('RESEND_API_KEY missing in simulation');
        return { success: false, error: 'Email service not configured' };
    }
    // If we reach here, we'd attempt to use Resend
    try {
        const { Resend } = require('resend');
        const resend = new Resend(apiKey);
        return await resend.emails.send({
            from: 'onboarding@resend.dev',
            to,
            subject,
            html
        });
    } catch (e) {
        console.error('Resend internal throw:', e);
        throw e;
    }
}

function hashToken(token) {
    return createHash('sha256').update(token).digest('hex');
}

async function simulateRequestReset(email) {
    try {
        const normalizedEmail = email.toLowerCase().trim();
        const user = await prisma.user.findUnique({
            where: { email: normalizedEmail }
        });

        if (!user) {
            console.log('User not found');
            return { success: true }; 
        }

        const token = randomBytes(32).toString('hex');
        const hashedToken = hashToken(token);
        const expiry = new Date(Date.now() + 3600000);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                resetToken: hashedToken,
                resetTokenExpiry: expiry
            }
        });
        console.log('DB updated with token');

        await sendEmail({
            to: normalizedEmail,
            subject: 'Test Reset',
            html: '<p>Test</p>'
        });

        console.log('Simulation reaching success return');
        return { success: true };
    } catch (error) {
        console.error("CAUGHT EXCEPTION IN SIMULATION:", error);
        return { success: false, error: 'Error al procesar la solicitud' };
    }
}

async function run() {
    await simulateRequestReset('kalexa.fashion@gmail.com');
    await prisma.$disconnect();
}

run();
