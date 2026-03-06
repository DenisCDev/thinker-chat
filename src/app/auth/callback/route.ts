import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as 'recovery' | 'email' | undefined
  const next = searchParams.get('next') ?? '/chat'

  const supabase = await createClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || origin

  // Fluxo com token_hash (Resend password reset)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) {
      return NextResponse.redirect(`${appUrl}${next}`)
    }
  }

  // Fluxo com code (outros callbacks do Supabase)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${appUrl}${next}`)
    }
  }

  return NextResponse.redirect(`${appUrl}/forgot-password?error=invalid_link`)
}
