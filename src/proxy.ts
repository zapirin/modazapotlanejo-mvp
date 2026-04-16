import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
    const requestHeaders = new Headers(request.headers);

    const rawHost = requestHeaders.get('host') || '';
    const cleanHost = rawHost.split(',')[0].trim().replace(/^https?:\/\//, '');
    requestHeaders.set('host', cleanHost);
    requestHeaders.set('x-forwarded-host', cleanHost);

    const rawOrigin = requestHeaders.get('origin') || '';
    if (rawOrigin.includes(',')) {
        const cleanOrigin = rawOrigin.split(',')[0].trim();
        requestHeaders.set('origin', cleanOrigin);
    }

    const sessionCookie = request.cookies.get('session_user_id');
    const url = request.nextUrl.clone();
    
    // Fix OpenLiteSpeed duplicated X-Forwarded-Proto header
    const forwardedProto = requestHeaders.get('x-forwarded-proto');
    if (forwardedProto && forwardedProto.includes(',')) {
        requestHeaders.set('x-forwarded-proto', forwardedProto.split(',')[0]);
    }

    const isLoginPage = url.pathname === '/login';

    // Rutas públicas del marketplace — no redirigir al login
    const publicPaths = ['/catalog', '/brands', '/categories', '/vendors', '/wishlist', '/register', '/cart', '/api/ai-description', '/acceso', '/forgot-password', '/reset-password'];
    const isPublicPath = publicPaths.some(p => url.pathname === p || url.pathname.startsWith(p + '/'));

    if (!sessionCookie && !isLoginPage && !isPublicPath) {
        url.pathname = '/login';
        return NextResponse.redirect(url);
    }

    return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/pos/:path*',
    '/inventory/:path*',
    '/products/:path*',
    '/settings/:path*',
    '/vas/:path*',
    '/admin/:path*',
    '/reports/:path*',
    '/reviews/:path*',
    '/messages/:path*',
    '/clients/:path*',
    '/orders/:path*',
    '/login',
    '/catalog/:path*',
    '/catalog',
    '/cart',
    '/brands',
    '/categories',
    '/vendors/:path*',
    '/vendors',
    '/wishlist',
    '/register/:path*',
    '/api/ai-description',
    '/acceso/:path*',
    '/forgot-password',
    '/reset-password',
    '/coupons',
    '/coupons/:path*',
  ],
};
