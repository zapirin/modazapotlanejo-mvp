import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';
import { cookies } from 'next/headers';

function hashPassword(p: string) {
    return createHash('sha256').update(p).digest('hex');
}

export async function POST(request: NextRequest) {
    try {
        const { email, password, registeredDomain } = await request.json();
        const normalizedEmail = email.toLowerCase().trim();

        let user: any = null;
        if (registeredDomain) {
            user = await prisma.user.findFirst({
                where: { email: normalizedEmail, registeredDomain },
                include: { location: true }
            });
        }
        if (!user) {
            user = await prisma.user.findFirst({
                where: { email: normalizedEmail },
                include: { location: true }
            });
        }
        if (!user) return NextResponse.json({ success: false, error: 'Usuario no encontrado' });
        if (!user.isActive) return NextResponse.json({ success: false, error: 'Cuenta desactivada' });
        if (user.role !== 'ADMIN' && registeredDomain && user.registeredDomain !== registeredDomain) {
            return NextResponse.json({ success: false, error: 'Este usuario no pertenece a esta tienda' });
        }
        if (user.passwordHash) {
            if (!password) return NextResponse.json({ success: false, error: 'Contraseña requerida' });
            if (user.passwordHash !== hashPassword(password)) {
                return NextResponse.json({ success: false, error: 'Contraseña incorrecta' });
            }
        }

        const cookieStore = await cookies();
        cookieStore.set('session_user_id', user.id, {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7,
            path: '/',
        });

        return NextResponse.json({ success: true, role: user.role });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}
