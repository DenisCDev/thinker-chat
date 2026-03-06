import { createAdminClient } from '@/lib/supabase/admin'
import { sendPasswordResetEmail } from '@/lib/email/send-password-reset'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email é obrigatório' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Gerar link de recovery via Admin API (NÃO envia email)
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email: email.toLowerCase(),
    })

    if (linkError || !linkData) {
      console.error('[forgot-password] generateLink error:', linkError?.message)
      // Não revelar se o usuário existe ou não
      return NextResponse.json({ success: true })
    }

    console.log('[forgot-password] Link generated for:', email.toLowerCase())

    const { hashed_token } = linkData.properties
    const resetUrl = `${appUrl}/auth/callback?token_hash=${hashed_token}&type=recovery&next=/reset-password`

    // Enviar email via Resend
    try {
      const result = await sendPasswordResetEmail({
        to: email.toLowerCase(),
        resetUrl,
        expiresInMinutes: 10,
      })
      console.log('[forgot-password] Email sent via Resend:', result?.id ?? 'no resend configured')
    } catch (emailError) {
      console.error('[forgot-password] Resend send error:', emailError)
      // Não retornar 500 — por segurança, sempre retornar sucesso
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[forgot-password] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
