import { resend } from './resend'
import { getPasswordResetEmailHtml, getPasswordResetEmailText } from './templates/password-reset'

interface SendPasswordResetEmailParams {
  to: string
  firstName?: string
  resetUrl: string
  expiresInMinutes?: number
}

export async function sendPasswordResetEmail({
  to,
  firstName,
  resetUrl,
  expiresInMinutes = 10
}: SendPasswordResetEmailParams) {
  if (!resend) {
    console.warn('[PasswordReset] Resend not configured, skipping email')
    return null
  }

  const { data, error } = await resend.emails.send({
    from: 'Thinker <noreply@thinker.ai>',
    to: [to],
    subject: 'Redefinir sua senha - Thinker',
    html: getPasswordResetEmailHtml({ firstName, resetUrl, expiresInMinutes }),
    text: getPasswordResetEmailText({ firstName, resetUrl, expiresInMinutes }),
  })

  if (error) {
    console.error('Error sending password reset email:', error)
    throw error
  }

  return data
}
