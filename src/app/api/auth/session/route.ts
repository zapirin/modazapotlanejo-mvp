import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('session_user_id')?.value;
        if (!userId) return NextResponse.json(null);
        
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { location: true }
        });
        return NextResponse.json(user);
    } catch (error) {
        return NextResponse.json(null);
    }
}
