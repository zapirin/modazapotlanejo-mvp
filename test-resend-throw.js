// Need to mock the imports since we are running in node
const { sendEmail } = require('./src/lib/email/resend.ts'); 
// Wait, resend.ts is TS. We need to run it with ts-node or use the compiled version if it exists.
// Or just replicate the logic again but be MORE CAREFUL.

const { Resend } = require('resend');

const getResend = () => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        console.log('RESEND_API_KEY is not defined');
        return null;
    }
    try {
        return new Resend(apiKey);
    } catch (e) {
        console.error('Error creating Resend instance:', e);
        return null;
    }
};

async function testRealLogic() {
    console.log('--- Testing REAL sendEmail Logic ---');
    try {
        const resend = getResend();
        if (!resend) {
            console.log('Result: null (as expected if no key)');
            return;
        }

        console.log('Attempting to call resend.emails.send (this might throw if key is invalid format)');
        const { data, error } = await resend.emails.send({
            from: 'onboarding@resend.dev',
            to: 'kalexa.fashion@gmail.com',
            subject: 'Test',
            html: '<p>Test</p>'
        });
        console.log('Data:', data);
        console.log('Error:', error);
    } catch (e) {
        console.error('CAUGHT THROW:', e);
    }
}

testRealLogic();
