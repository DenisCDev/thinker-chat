import { createClient } from '@/lib/supabase/server'
import { AI_CONFIG } from '@/lib/openrouter/config'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { chatRequestSchema, validateSchema } from '@/lib/validations'
import { searchKnowledge, formatSearchResultsForContext } from '@/lib/rag/search'
import {
  sanitizeAssistantName,
  sanitizeSummary,
  sanitizeKnowledgeContent,
  sanitizeUserMessage,
} from '@/lib/security/sanitize'
import { createAdminClient } from '@/lib/supabase/admin'

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return new Response('Unauthorized', { status: 401 })
    }

    // Rate limiting
    const rateLimit = await checkRateLimit(user.id, 'chat')
    if (!rateLimit.success) {
      return rateLimitResponse(rateLimit)
    }

    // Validate request body
    const body = await req.json()
    const validation = validateSchema(chatRequestSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const { messages, assistantId, handoffSummary: clientHandoffSummary, previousAssistantName: clientPreviousAssistantName } = validation.data

    const adminClient = createAdminClient()

    // Fetch full assistant data
    const { data: fullAssistant, error: assistantError } = await adminClient
      .from('assistants')
      .select('*')
      .eq('id', assistantId)
      .single()

    if (assistantError || !fullAssistant) {
      return new Response('Assistant not found', { status: 404 })
    }

    // Build messages with system prompt
    let systemContent = fullAssistant.system_prompt

    // Add formatting instruction
    systemContent = `${systemContent}

---
INSTRUCAO DE FORMATACAO - OBRIGATORIO EM TODAS AS RESPOSTAS:
IMPORTANTE: Voce DEVE formatar TODAS as suas respostas seguindo EXATAMENTE este estilo:

REGRAS DE TITULOS (OBRIGATORIO):
- Use ## para titulos principais (ex: ## Tema Principal)
- Use ### para subtitulos numerados (ex: ### 1. Base Legal)
- NUNCA use apenas **negrito** para titulos - SEMPRE use ## ou ###
- Negrito (**texto**) e APENAS para destacar termos tecnicos dentro de paragrafos

ESTRUTURA OBRIGATORIA:
1. Paragrafo introdutorio breve (2-3 frases)
2. Secoes com ## Titulo Principal
3. Subsecoes com ### 1. Subtitulo Numerado
4. Listas com bullets (-) para itens
5. **Termos tecnicos** em negrito dentro do texto
6. Conclusao com ## Conclusao

EXEMPLO (siga este formato EXATAMENTE):

Paragrafo introdutorio explicando o contexto da resposta.

## Tema Principal

### 1. Primeiro Topico
- Item com **termo tecnico** destacado
- Outro item relevante

### 2. Segundo Topico
- Explicacao com **conceito importante**
- Detalhes adicionais

## Conclusao

Resumo final ou pergunta de acompanhamento.
---`

    // Add handoff context if provided by client
    if (clientHandoffSummary) {
      const safeSummary = sanitizeSummary(clientHandoffSummary)
      const safePrevName = sanitizeAssistantName(clientPreviousAssistantName) || 'assistente anterior'
      systemContent = `${systemContent}

---
CONTEXTO DA CONVERSA ANTERIOR:
O usuario estava conversando com o ${safePrevName}. Abaixo esta um resumo do que foi discutido:

${safeSummary}

Por favor, continue a conversa levando em consideracao este contexto. Voce pode se apresentar brevemente e indicar que esta ciente do historico da conversa.
---`
    }

    // RAG: Search for relevant knowledge
    const lastUserMessage = messages.filter((m) => m.role === 'user').pop()
    if (lastUserMessage && fullAssistant.slug) {
      try {
        const safeSearchQuery = sanitizeUserMessage(lastUserMessage.content)
        const ragResults = await searchKnowledge(safeSearchQuery, fullAssistant.slug, {
          matchThreshold: 0.5,
          matchCount: 10,
        })
        if (ragResults.length > 0) {
          const ragContext = formatSearchResultsForContext(ragResults)
          const safeRagContext = sanitizeKnowledgeContent(ragContext)
          systemContent = `${systemContent}\n${safeRagContext}`
        }
      } catch (error) {
        console.error('RAG search error:', error)
      }
    }

    const systemMessage: Message = {
      role: 'system',
      content: systemContent,
    }

    // Sanitize user messages
    const sanitizedMessages: Message[] = messages.map((m) => ({
      role: m.role,
      content: m.role === 'user' ? sanitizeUserMessage(m.content) : m.content,
    }))

    // If handoff, only include last 4 messages + new message
    let apiMessages: Message[]
    if (clientHandoffSummary && sanitizedMessages.length > 4) {
      const recentMessages = sanitizedMessages.slice(-4)
      apiMessages = [systemMessage, ...recentMessages]
    } else {
      apiMessages = [systemMessage, ...sanitizedMessages]
    }

    const model = fullAssistant.model || AI_CONFIG.defaultModel
    const temperature = fullAssistant.temperature || 0.3
    const maxTokens = fullAssistant.max_tokens || 4096

    console.log(`Calling Google AI with model: ${model}`)
    const response = await fetch(`${AI_CONFIG.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GOOGLE_AI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: apiMessages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Google AI error:', errorText)
      return new Response('AI service error', { status: 500 })
    }

    // Create a transform stream to process SSE
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    let sseBuffer = ''

    const transformStream = new TransformStream({
      async transform(chunk, controller) {
        const text = decoder.decode(chunk, { stream: true })

        sseBuffer += text
        const lines = sseBuffer.split('\n')

        if (!sseBuffer.endsWith('\n')) {
          sseBuffer = lines.pop() || ''
        } else {
          sseBuffer = ''
        }

        for (const line of lines) {
          const trimmedLine = line.trim()
          if (!trimmedLine) continue

          if (trimmedLine.startsWith('data: ')) {
            const data = trimmedLine.slice(6)
            if (data === '[DONE]') {
              controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
              return
            }
            try {
              const json = JSON.parse(data)
              const content = json.choices?.[0]?.delta?.content || ''
              if (content) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      },
    })

    return new Response(response.body?.pipeThrough(transformStream), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return new Response('Internal server error', { status: 500 })
  }
}
