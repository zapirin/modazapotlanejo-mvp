import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This function can be marked `async` if using `await` inside
export function proxy(request: NextRequest) {
    const sessionCookie = request.cookies.get('session_user_id');
    const url = request.nextUrl.clone();
    const isLoginPage = url.pathname === '/login';

    // 1. Protect all private routes: if no cookie and not on login page, go to login.
    if (!sessionCookie && !isLoginPage) {
        url.pathname = '/login';
        return NextResponse.redirect(url);
    }
    
    // 2. We REMOVE the auto-redirect from /login to /dashboard if cookie exists.
    // This is where the loop happens if the cookie is stale (user deleted/id changed).
    // The user can manually click 'Login' or we can handle it in the layout.

    return NextResponse.next();
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
    '/login'
  ],
};
