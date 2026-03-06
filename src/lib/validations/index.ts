import { z } from 'zod'
import { NextResponse } from 'next/server'

// ============================================
// COMMON SCHEMAS
// ============================================

export const uuidSchema = z.string().uuid('ID deve ser um UUID valido')

export const messageRoleSchema = z.enum(['user', 'assistant', 'system'], {
  message: 'Role deve ser user, assistant ou system',
})

// ============================================
// CHAT SCHEMAS
// ============================================

const MAX_MESSAGE_LENGTH = 50000

export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z
    .string()
    .min(1, 'Conteudo da mensagem e obrigatorio')
    .max(MAX_MESSAGE_LENGTH, `Mensagem muito longa (maximo ${MAX_MESSAGE_LENGTH} caracteres)`),
})

export const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1, 'Pelo menos uma mensagem e obrigatoria'),
  conversationId: z.string().uuid().optional(),
  assistantId: z.string().uuid('ID do assistente deve ser um UUID valido'),
  handoffSummary: z.string().optional(),
  previousAssistantName: z.string().optional(),
})

// ============================================
// VALIDATION HELPER
// ============================================

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: NextResponse }

export function validateSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data)

  if (!result.success) {
    const errors = result.error.issues.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }))

    return {
      success: false,
      error: NextResponse.json(
        {
          error: 'Dados invalidos',
          details: errors,
        },
        { status: 400 }
      ),
    }
  }

  return { success: true, data: result.data }
}

export function validateQueryParams<T>(
  schema: z.ZodSchema<T>,
  searchParams: URLSearchParams
): ValidationResult<T> {
  const params: Record<string, string> = {}
  searchParams.forEach((value, key) => {
    params[key] = value
  })
  return validateSchema(schema, params)
}
