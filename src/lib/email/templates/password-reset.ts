interface PasswordResetEmailParams {
  firstName?: string
  resetUrl: string
  expiresInMinutes: number
}

export function getPasswordResetEmailHtml({ firstName, resetUrl, expiresInMinutes }: PasswordResetEmailParams): string {
  const greeting = firstName ? `Olá, ${firstName}!` : 'Olá!'

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redefinir Senha - Thinker</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background-color: #84cc16; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">Thinker</h1>
              <p style="margin: 10px 0 0; color: #ffffff; font-size: 14px; opacity: 0.9;">AI-powered thinking assistant</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #1a1a1a; font-size: 24px;">${greeting}</h2>

              <p style="margin: 0 0 20px; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                Recebemos uma solicitação para redefinir a senha da sua conta no Thinker.
              </p>

              <p style="margin: 0 0 30px; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                Clique no botão abaixo para criar uma nova senha:
              </p>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}" style="display: inline-block; padding: 16px 40px; background-color: #84cc16; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold; border-radius: 8px;">
                      Redefinir Senha
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 20px; color: #4a4a4a; font-size: 14px; line-height: 1.6;">
                Este link expira em <strong>${expiresInMinutes} minutos</strong>.
              </p>

              <p style="margin: 0 0 20px; color: #4a4a4a; font-size: 14px; line-height: 1.6;">
                Se você não solicitou a redefinição de senha, pode ignorar este email com segurança. Sua senha permanecerá a mesma.
              </p>

              <!-- Alternative Link -->
              <div style="margin-top: 30px; padding: 20px; background-color: #f8f8f8; border-radius: 8px;">
                <p style="margin: 0 0 10px; color: #666666; font-size: 12px;">
                  Se o botão não funcionar, copie e cole este link no seu navegador:
                </p>
                <p style="margin: 0; color: #84cc16; font-size: 12px; word-break: break-all;">
                  ${resetUrl}
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f8f8f8; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0 0 10px; color: #888888; font-size: 12px;">
                © ${new Date().getFullYear()} Thinker. Todos os direitos reservados.
              </p>
              <p style="margin: 0; color: #888888; font-size: 12px;">
                Este email foi enviado automaticamente. Por favor, não responda.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}

export function getPasswordResetEmailText({ firstName, resetUrl, expiresInMinutes }: PasswordResetEmailParams): string {
  const greeting = firstName ? `Olá, ${firstName}!` : 'Olá!'

  return `
${greeting}

Recebemos uma solicitação para redefinir a senha da sua conta no Thinker.

Para criar uma nova senha, acesse o link abaixo:
${resetUrl}

Este link expira em ${expiresInMinutes} minutos.

Se você não solicitou a redefinição de senha, pode ignorar este email com segurança. Sua senha permanecerá a mesma.

---
© ${new Date().getFullYear()} Thinker. Todos os direitos reservados.
Este email foi enviado automaticamente. Por favor, não responda.
`
}
