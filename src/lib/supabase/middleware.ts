import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protected routes
  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/register') ||
    request.nextUrl.pathname.startsWith('/forgot-password') ||
    request.nextUrl.pathname.startsWith('/reset-password')

  const isPublicRoute = request.nextUrl.pathname === '/' ||
    request.nextUrl.pathname.startsWith('/api/') ||
    request.nextUrl.pathname.startsWith('/_next/') ||
    request.nextUrl.pathname.startsWith('/auth/callback')

  if (!user && !isAuthRoute && !isPublicRoute) {
    // Redirect to login if trying to access protected route
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isAuthRoute &&
    !request.nextUrl.pathname.startsWith('/reset-password')
  ) {
    // Redirect to chat if already logged in and trying to access auth routes
    // (except reset-password, which requires an authenticated session from the email link)
    const url = request.nextUrl.clone()
    url.pathname = '/chat'
    return NextResponse.redirect(url)
  }

  // Subscription check moved to dashboard layout (src/app/(dashboard)/layout.tsx)
  // to avoid an extra DB query on every single request.

  return supabaseResponse
}
