import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  const url = request.nextUrl.clone()

  // 1. If no session and trying to access protected routes, redirect to login
  if (!session && !url.pathname.startsWith('/login') && !url.pathname.startsWith('/auth')) {
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 2. If session exists and trying to access login, redirect to home
  if (session && url.pathname.startsWith('/login')) {
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // 3. User Role Check (Custom Logic)
  if (session && !url.pathname.startsWith('/waiting-approval') && !url.pathname.startsWith('/auth')) {
    // Fetch user profile to check role
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single()

    // If logged in but no role assigned yet (and not already on waiting page)
    if (!profile?.role && url.pathname !== '/waiting-approval') {
      url.pathname = '/waiting-approval'
      return NextResponse.redirect(url)
    }

    // Role-based route restriction
    if (profile?.role === 'STAFF_GUDANG' || profile?.role === 'STAFF_DAPUR') {
      const restrictedForStaff = ['/', '/report', '/settings']
      if (restrictedForStaff.includes(url.pathname)) {
        url.pathname = '/stock'
        return NextResponse.redirect(url)
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
