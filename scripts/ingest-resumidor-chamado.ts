/**
 * Script standalone para inserir o assistente "Resumidor de Chamado"
 * e ingerir conhecimento na knowledge_base com embeddings.
 *
 * Uso: npx tsx scripts/ingest-resumidor-chamado.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Supabase admin client
// ---------------------------------------------------------------------------
function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ---------------------------------------------------------------------------
// Embedding helpers
// ---------------------------------------------------------------------------
const EMBEDDING_MODEL = 'gemini-embedding-001'
const EMBEDDING_DIMENSIONS = 768

async function callEmbedApi(endpoint: string, body: object): Promise<Response> {
  const apiKey = process.env.GOOGLE_AI_API_KEY!
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:${endpoint}?key=${apiKey}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Google Embedding API error (${res.status}): ${err}`)
  }
  return res
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const BATCH_SIZE = 20
  const embeddings: number[][] = []
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(texts.length / BATCH_SIZE)
    let retries = 0
    while (true) {
      try {
        const res = await callEmbedApi('batchEmbedContents', {
          requests: batch.map((text) => ({
            model: `models/${EMBEDDING_MODEL}`,
            content: { parts: [{ text }] },
            outputDimensionality: EMBEDDING_DIMENSIONS,
          })),
        })
        const data = await res.json()
        embeddings.push(...data.embeddings.map((e: { values: number[] }) => e.values))
        process.stdout.write(`   Batch ${batchNum}/${totalBatches} OK\n`)
        break
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('429') && retries < 5) {
          retries++
          const waitSec = 15 * retries
          process.stdout.write(`   Batch ${batchNum}/${totalBatches} rate limited, aguardando ${waitSec}s...\n`)
          await sleep(waitSec * 1000)
        } else {
          throw err
        }
      }
    }
    if (i + BATCH_SIZE < texts.length) await sleep(2000)
  }
  return embeddings
}

// ---------------------------------------------------------------------------
// Assistente
// ---------------------------------------------------------------------------
const ASSISTANT_SLUG = 'resumidor-chamado'

const SYSTEM_PROMPT = `Você é o "Resumidor de Chamado" — um assistente que transforma conversas longas de suporte em resumos estruturados e acionáveis.

# Seu papel
O agente de suporte cola uma thread de conversa com o cliente (pode ser do chat, email, WhatsApp, ticket, etc.) e você gera um resumo estruturado que permite a qualquer pessoa entender rapidamente o que aconteceu, o status atual e o que precisa ser feito.

# Formato padrão de resumo

Sempre responda neste formato:

**Resumo do Chamado**

**Cliente:** [Nome se identificado, ou "não identificado"]
**Data:** [Se mencionada na conversa]
**Canal:** [Chat/Email/WhatsApp/Ticket — se identificável]

**Problema:**
[1-3 frases descrevendo o problema central relatado pelo cliente]

**Contexto:**
[Informações relevantes mencionadas: módulo do sistema, funcionalidade, frequência, quando começou, etc.]

**O que já foi feito:**
- [Ação 1 tomada pelo suporte]
- [Ação 2]
- [Resultado de cada ação se mencionado]

**Status atual:** [Resolvido / Em andamento / Aguardando cliente / Aguardando equipe técnica / Escalado]

**Próximo passo:**
- [O que precisa ser feito a seguir]
- [Quem é responsável, se identificável]

**Classificação sugerida:**
- Tipo: [Bug / Dúvida / Solicitação / Erro do usuário / Instabilidade / Melhoria]
- Urgência: [Alta / Média / Baixa]
- Módulo: [Parte do sistema afetada, se identificável]

---

# Regras

## Extração de informação:
- Identifique o problema REAL, não só o que o cliente disse primeiro (muitas vezes o problema real aparece mais pra frente na conversa)
- Separe fatos de opiniões/emoções do cliente
- Capture todas as ações que o suporte já tomou
- Note promessas feitas ao cliente (prazos, retornos, etc.)
- Identifique se há informação faltando que seria importante

## Quando a conversa for confusa:
- Se houver múltiplos problemas, liste cada um separadamente
- Se a conversa mudou de assunto, mencione isso
- Se há contradições, aponte-as
- Se informações cruciais estão faltando, liste no campo "Informações pendentes"

## Extras opcionais:
Se o agente pedir, você pode também:
- Gerar uma nota interna para o time técnico
- Gerar uma mensagem de follow-up para o cliente
- Sugerir próximas perguntas para o agente fazer
- Classificar o sentimento do cliente (satisfeito, neutro, frustrado, irritado)

## Tom:
- Objetivo e factual
- Sem julgamentos sobre o cliente ou o agente
- Conciso — o resumo deve ser significativamente mais curto que a conversa original
- Use bullet points para facilitar a leitura rápida`

const SAMPLE_QUESTIONS = [
  'Cola aqui a conversa e eu faço o resumo estruturado',
  'Preciso resumir um ticket longo pra passar pro N2',
  'Quero um resumo dessa thread pra registrar no sistema',
  'Resuma essa conversa e sugira o próximo passo',
  'Preciso de uma nota interna sobre esse atendimento',
]

// ---------------------------------------------------------------------------
// Documentos de conhecimento
// ---------------------------------------------------------------------------
interface KnowledgeDoc {
  id: string
  title: string
  content: string
}

const knowledgeDocs: KnowledgeDoc[] = [
  {
    id: 'templates-resumo',
    title: 'Templates de Resumo por Tipo de Chamado',
    content: `# Templates de Resumo por Tipo de Chamado

## Tipo: Bug / Erro do Sistema

**Problema:**
[Descreva o erro encontrado — o que deveria acontecer vs o que está acontecendo]

**Reprodução:**
- Passos para reproduzir (se identificados na conversa)
- Frequência: [Sempre / Intermitente / Aconteceu uma vez]
- Ambiente: [Navegador, dispositivo, se mencionado]

**Impacto:**
- Quantidade de usuários afetados (se mencionado)
- Funcionalidade bloqueada ou degradada
- Workaround disponível: [Sim/Não — qual]

**Evidências:**
- Prints enviados: [Sim/Não]
- Mensagem de erro: [Texto exato se fornecido]
- Horário da ocorrência: [Se mencionado]

## Tipo: Dúvida / Como fazer

**Dúvida:**
[O que o cliente quer saber/fazer]

**Contexto:**
- Nível de conhecimento do cliente: [Iniciante / Intermediário / Avançado]
- Já tentou algo antes: [O que tentou]

**Resposta fornecida:**
- [O que foi explicado]
- [Se foi enviado tutorial/documentação]

**Resultado:**
- Cliente entendeu: [Sim / Parcialmente / Não]
- Precisa de acompanhamento: [Sim/Não]

## Tipo: Solicitação / Pedido de funcionalidade

**Solicitação:**
[O que o cliente está pedindo]

**Necessidade real:**
[A necessidade por trás do pedido — pode ser diferente do que foi pedido]

**Viabilidade:**
- Existe no sistema: [Sim / Não / Parcialmente]
- Alternativa oferecida: [Qual]
- Encaminhado como sugestão: [Sim/Não]

## Tipo: Erro do Usuário

**O que aconteceu:**
[Descreva o que o usuário fez sem atribuir culpa]

**Como foi resolvido:**
- [Passos para corrigir]
- [Se dados foram recuperados]

**Prevenção:**
- [Orientação dada ao cliente para evitar recorrência]

## Tipo: Instabilidade / Indisponibilidade

**Período afetado:**
- Início: [Quando o cliente reportou / quando começou]
- Fim: [Quando normalizou, se aplicável]

**Serviços afetados:**
- [Lista de funcionalidades impactadas]

**Comunicação:**
- Cliente foi notificado sobre a situação: [Sim/Não]
- Prometido retorno: [Sim — prazo / Não]

**Causa raiz (se identificada):**
- [Resumo simples da causa]`,
  },
  {
    id: 'tecnicas-extracao',
    title: 'Técnicas de Extração de Informação de Conversas',
    content: `# Técnicas de Extração de Informação

## Como identificar o problema real

### Regra dos 3 primeiros parágrafos
Muitas vezes o cliente começa desabafando antes de chegar no problema real. Padrão comum:
1. Primeiro parágrafo: frustração/contexto emocional
2. Segundo parágrafo: descrição vaga do problema
3. Terceiro parágrafo em diante: detalhes reais

Ao resumir, priorize a informação dos parágrafos finais.

### Problema declarado vs problema real
O que o cliente diz nem sempre é o problema técnico:
- "O sistema está lento" → pode ser que uma tela específica demora para carregar
- "Perdi tudo" → pode ser que um filtro está escondendo os dados
- "Não funciona" → pode ser que uma ação específica dá erro
- "Mudaram tudo" → pode ser que houve atualização de interface

Ao resumir, diferencie:
- **Problema declarado**: O que o cliente disse com as palavras dele
- **Problema técnico provável**: A tradução para linguagem técnica

## Como identificar o status do chamado

### Sinais de "Resolvido":
- Cliente agradeceu
- Cliente confirmou que funcionou
- Suporte encerrou com "qualquer dúvida estamos à disposição"

### Sinais de "Aguardando cliente":
- Suporte fez uma pergunta e não teve resposta
- Suporte pediu print/informação e não recebeu
- Suporte deu instrução e aguarda confirmação

### Sinais de "Aguardando equipe técnica":
- Suporte disse que vai "verificar com a equipe"
- Mencionou que vai "escalar" ou "encaminhar"
- Disse que vai "investigar" e retornar

### Sinais de "Em andamento":
- Suporte está ativamente trocando mensagens
- Estão no meio de um troubleshooting
- Suporte pediu para o cliente tentar algo e aguarda

## Como classificar urgência

### Alta:
- Sistema completamente inacessível
- Perda de dados mencionada
- Operação crítica bloqueada (o cliente não consegue trabalhar)
- Múltiplos usuários afetados
- Cliente menciona prazo urgente

### Média:
- Funcionalidade específica com problema, mas tem workaround
- Erro intermitente
- Um usuário afetado
- Impacto parcial no trabalho

### Baixa:
- Dúvida de uso
- Sugestão de melhoria
- Problema cosmético/visual
- Funcionalidade secundária

## Como lidar com conversas problemáticas

### Conversa muito longa (20+ mensagens):
- Foque nos marcos: primeiro relato, diagnóstico, tentativas de solução, status final
- Ignore mensagens de "ok", "tá", "entendi" que não agregam
- Destaque mudanças de direção (quando descobriram que o problema era outro)

### Múltiplos problemas na mesma conversa:
- Numere cada problema separadamente
- Identifique se estão relacionados
- Dê status individual para cada um

### Conversa com emoção/conflito:
- No resumo, mantenha-se factual
- Não registre ofensas ou desabafos
- Registre o nível de frustração como dado objetivo ("cliente demonstrou alta frustração")
- Destaque se houve promessas feitas para acalmar o cliente (precisam ser cumpridas)

### Informação incompleta:
- Liste explicitamente o que está faltando
- Sugira perguntas para completar a informação
- Não assuma — marque como "não informado"`,
  },
  {
    id: 'boas-praticas-registro',
    title: 'Boas Práticas de Registro de Chamados',
    content: `# Boas Práticas de Registro de Chamados

## Por que registrar bem importa

Um bom registro de chamado:
- Permite que qualquer pessoa retome o atendimento sem pedir informações de novo
- Facilita identificar padrões de problemas recorrentes
- Protege o suporte mostrando o que foi feito
- Ajuda o time técnico a priorizar correções
- Reduz tempo de resolução em reincidências

## O que um bom resumo DEVE ter

### Informações obrigatórias:
1. **Quem**: Identificação do cliente
2. **O quê**: Descrição clara do problema
3. **Quando**: Data/hora da ocorrência e do atendimento
4. **Onde**: Módulo/funcionalidade/tela afetada
5. **Status**: Situação atual clara
6. **Próximo passo**: O que precisa acontecer a seguir

### Informações desejáveis:
- Mensagem de erro exata (se houver)
- Passos para reproduzir
- Impacto no trabalho do cliente
- Workaround fornecido
- Histórico de interações anteriores sobre o mesmo tema

## O que um bom resumo NÃO deve ter

- Opiniões pessoais sobre o cliente ("cliente chato", "não sabe usar")
- Detalhes irrelevantes da conversa
- Transcrição literal — o resumo deve ser RESUMIDO
- Linguagem informal ou gírias
- Informações sensíveis desnecessárias (senhas, dados pessoais completos)

## Padrões de escrita

### Use voz ativa:
- Ruim: "Foi verificado que o erro estava ocorrendo..."
- Bom: "Identificamos que o erro ocorre quando..."

### Seja específico:
- Ruim: "Cliente com problema no sistema"
- Bom: "Cliente não consegue gerar relatório de vendas no módulo Financeiro — tela retorna erro 500"

### Use verbos de ação nos próximos passos:
- Ruim: "Precisa ser visto pelo técnico"
- Bom: "Encaminhar para equipe de backend investigar query do relatório de vendas"

## Nota interna vs comunicação ao cliente

### Nota interna (para o time):
- Pode usar termos técnicos
- Inclua detalhes de investigação
- Registre hipóteses e tentativas
- Seja direto e objetivo

### Comunicação ao cliente:
- Use linguagem simples
- Foque no que importa para ele (status e prazo)
- Mantenha tom profissional e empático
- Confirme entendimento do problema`,
  },
]

// ---------------------------------------------------------------------------
// Chunking
// ---------------------------------------------------------------------------
interface Chunk {
  content: string
  metadata: {
    document_id: string
    document_title: string
    source_type: string
    chunk_index: number
  }
}

function chunkBySection(text: string): string[] {
  const sections = text.split(/\n(?=## )/)
  const chunks: string[] = []
  for (const section of sections) {
    const trimmed = section.trim()
    if (trimmed.length > 50) {
      if (trimmed.length > 4000) {
        const subsections = trimmed.split(/\n(?=### |---)/)
        let current = ''
        for (const sub of subsections) {
          if (current.length + sub.length > 4000 && current.length > 50) {
            chunks.push(current.trim())
            current = sub
          } else {
            current += (current ? '\n' : '') + sub
          }
        }
        if (current.trim().length > 50) chunks.push(current.trim())
      } else {
        chunks.push(trimmed)
      }
    }
  }
  return chunks
}

function buildChunks(docs: KnowledgeDoc[]): Chunk[] {
  const chunks: Chunk[] = []
  for (const doc of docs) {
    const parts = chunkBySection(doc.content)
    for (let i = 0; i < parts.length; i++) {
      chunks.push({
        content: parts[i],
        metadata: {
          document_id: doc.id,
          document_title: doc.title,
          source_type: 'manual',
          chunk_index: i,
        },
      })
    }
  }
  return chunks
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('=== Ingestão: Resumidor de Chamado ===\n')

  const supabase = createAdminClient()

  console.log('1. Inserindo assistente...')
  const { error: assistantError } = await supabase.from('assistants').upsert(
    {
      name: 'Resumidor de Chamado',
      slug: ASSISTANT_SLUG,
      description: 'Transforma conversas longas de suporte em resumos estruturados e acionáveis',
      model: 'gemini-2.5-flash-lite',
      temperature: 0.2,
      max_tokens: 4096,
      system_prompt: SYSTEM_PROMPT,
      is_active: true,
      sample_questions: SAMPLE_QUESTIONS,
    },
    { onConflict: 'slug' }
  )

  if (assistantError) {
    console.error('Erro ao inserir assistente:', assistantError)
    process.exit(1)
  }
  console.log('   Assistente "Resumidor de Chamado" inserido/atualizado com sucesso.\n')

  console.log('2. Limpando conhecimento anterior...')
  const { count: deletedCount } = await supabase
    .from('knowledge_base')
    .delete({ count: 'exact' })
    .eq('assistant_slug', ASSISTANT_SLUG)
  console.log(`   ${deletedCount ?? 0} chunks anteriores removidos.\n`)

  console.log('3. Gerando chunks...')
  const chunks = buildChunks(knowledgeDocs)
  console.log(`   ${chunks.length} chunks gerados a partir de ${knowledgeDocs.length} documentos.\n`)

  console.log('4. Gerando embeddings...')
  const texts = chunks.map((c) => c.content)
  const embeddings = await generateEmbeddings(texts)
  console.log(`   ${embeddings.length} embeddings gerados.\n`)

  console.log('5. Inserindo na knowledge_base...')
  const records = chunks.map((chunk, i) => ({
    content: chunk.content,
    metadata: chunk.metadata,
    embedding: embeddings[i],
    assistant_slug: ASSISTANT_SLUG,
  }))

  const BATCH_SIZE = 50
  let totalInserted = 0
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('knowledge_base').insert(batch)
    if (error) {
      console.error(`Erro ao inserir batch ${i / BATCH_SIZE + 1}:`, error)
      process.exit(1)
    }
    totalInserted += batch.length
  }

  console.log(`   ${totalInserted} chunks inseridos com sucesso.\n`)
  console.log('=== Ingestão concluída! ===')
  console.log(`\nResumo:`)
  console.log(`  Assistente: Resumidor de Chamado (${ASSISTANT_SLUG})`)
  console.log(`  Modelo: gemini-2.5-flash-lite`)
  console.log(`  Documentos: ${knowledgeDocs.length}`)
  console.log(`  Chunks: ${totalInserted}`)
}

main().catch((err) => {
  console.error('Erro fatal:', err)
  process.exit(1)
})
