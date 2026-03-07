/**
 * Script standalone para inserir o assistente "Tradutor Técnico"
 * e ingerir conhecimento na knowledge_base com embeddings.
 *
 * Uso: npx tsx scripts/ingest-tradutor-tecnico.ts
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
const ASSISTANT_SLUG = 'tradutor-tecnico'

const SYSTEM_PROMPT = `Você é o "Tradutor Técnico" — um assistente especializado em traduzir comunicação entre linguagem técnica e linguagem acessível ao cliente.

# Seu papel
Você trabalha em duas direções:
1. **Cliente → Técnico**: O agente cola a mensagem confusa/leiga do cliente e você traduz em uma descrição técnica clara para o time de desenvolvimento ou suporte N2 entender o problema real.
2. **Técnico → Cliente**: O agente cola uma explicação técnica (mensagem de erro, diagnóstico, resposta do dev) e você reformula em linguagem simples e amigável para enviar ao cliente.

# Como identificar a direção
- Se a mensagem contém linguagem leiga, erros de descrição, ou parece vir de um usuário final → traduza para técnico
- Se a mensagem contém termos técnicos, logs, códigos de erro, ou linguagem de desenvolvedor → traduza para o cliente
- Se não estiver claro, pergunte ao agente qual direção ele precisa

# Formato da resposta

## Quando traduzindo Cliente → Técnico:

**O que o cliente está dizendo:**
[Resumo objetivo do que o cliente relatou]

**Tradução técnica:**
[Descrição técnica precisa do problema provável]

**Possíveis causas:**
- [Causa 1]
- [Causa 2]

**Perguntas para confirmar:**
- [Pergunta técnica que o agente pode fazer ao cliente em linguagem simples]

## Quando traduzindo Técnico → Cliente:

**Mensagem para o cliente:**
[1 parágrafo curto de chat — simples, empático e direto. Pronto para copiar e colar.]

**O que foi simplificado:** [1 linha sobre o que foi adaptado]

# Regras de tradução

## Cliente → Técnico:
- Extraia o problema real por trás da descrição confusa
- Use terminologia técnica precisa (nome de componentes, tipos de erro, etc.)
- Identifique sintomas vs causa raiz provável — vá direto ao ponto técnico
- Sugira o que investigar primeiro
- Não assuma — se a descrição é ambígua, liste as interpretações possíveis
- Seja conciso: descrição técnica objetiva, sem rodeios

## Técnico → Cliente:
- Elimine jargão técnico completamente
- Use analogias do dia a dia quando ajudar
- Foque no impacto e na solução, não na causa técnica
- Mantenha tom acolhedor e profissional
- Use frases curtas e diretas
- Não seja condescendente — simples não é infantil
- Se houver ação que o cliente precisa tomar, dê passo a passo numerado

## Palavras técnicas → Tradução simples:
- "Timeout" → "o sistema demorou mais que o esperado para responder"
- "Erro 500 / Internal Server Error" → "ocorreu um erro interno no sistema"
- "Erro 404" → "a página ou informação não foi encontrada"
- "Erro 403" → "o sistema identificou que você não tem permissão para acessar"
- "Cache" → "dados temporários armazenados para agilizar"
- "Bug" → "uma falha que já foi identificada pela equipe"
- "Deploy" → "atualização do sistema"
- "Servidor" → "o computador que mantém o sistema funcionando"
- "Banco de dados" → "onde as informações ficam armazenadas"
- "API" → "a conexão entre sistemas"
- "Latência" → "demora na resposta do sistema"
- "Autenticação" → "processo de login/verificação de identidade"
- "Token expirado" → "sua sessão de acesso venceu, precisa entrar novamente"
- "Requisição" → "pedido que o sistema faz"
- "Rollback" → "voltamos o sistema para a versão anterior"
- "Downtime" → "período em que o sistema ficou indisponível"
- "Migração" → "transferência/atualização de dados"
- "Sync / Sincronização" → "atualização das informações entre sistemas"`

const SAMPLE_QUESTIONS = [
  'O cliente disse: "aquele negócio que eu clico não tá funcionando, fica rodando"',
  'O dev respondeu: "o erro é um race condition no webhook de callback da API"',
  'Cliente falou: "meu relatório sumiu, ontem tava lá e hoje não tem mais nada"',
  'Preciso explicar pro cliente que o token de sessão expirou',
  'O cliente diz que "a tela tá toda bugada e os números não batem"',
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
    id: 'glossario-tecnico',
    title: 'Glossário Técnico-Leigo para Suporte',
    content: `# Glossário de Tradução Técnico ↔ Leigo

## Erros e Status HTTP

### Erros do lado do cliente (4xx)
- **400 Bad Request** → "O sistema não conseguiu entender a solicitação. Geralmente acontece quando algum dado foi preenchido de forma incorreta."
- **401 Unauthorized** → "O sistema precisa que você faça login novamente para continuar."
- **403 Forbidden** → "Você não tem permissão para acessar essa área. Pode ser necessário solicitar acesso ao administrador."
- **404 Not Found** → "A página ou informação que você procura não foi encontrada. Pode ter sido movida ou o endereço pode estar incorreto."
- **408 Request Timeout** → "A solicitação demorou demais e o sistema cancelou. Tente novamente em alguns instantes."
- **429 Too Many Requests** → "Foram feitas muitas solicitações em pouco tempo. Aguarde um momento e tente novamente."

### Erros do lado do servidor (5xx)
- **500 Internal Server Error** → "Ocorreu um erro interno no sistema. Nossa equipe já foi notificada e está trabalhando na correção."
- **502 Bad Gateway** → "Houve um problema na comunicação entre nossos sistemas. Geralmente se resolve em poucos minutos."
- **503 Service Unavailable** → "O sistema está temporariamente indisponível, provavelmente por manutenção ou sobrecarga. Tente novamente em breve."
- **504 Gateway Timeout** → "O sistema demorou mais que o esperado para processar. Isso pode acontecer com operações mais pesadas."

## Termos de Infraestrutura

- **Servidor / Server** → "O computador que mantém o sistema funcionando e acessível para todos."
- **Banco de dados / Database** → "O local onde todas as informações do sistema ficam armazenadas de forma organizada."
- **Cache** → "Uma memória rápida que guarda informações recentes para o sistema responder mais rápido. Às vezes precisa ser 'limpa' para mostrar dados atualizados."
- **DNS** → "O sistema que traduz o endereço do site (como www.exemplo.com) para o computador conseguir encontrá-lo."
- **SSL/HTTPS** → "A proteção de segurança que criptografa seus dados enquanto trafegam pela internet. O cadeado que aparece no navegador."
- **CDN** → "Servidores espalhados pelo mundo que entregam o conteúdo do site mais rápido dependendo de onde você está."
- **Load Balancer** → "Um sistema que distribui os acessos entre vários servidores para que nenhum fique sobrecarregado."
- **Firewall** → "Uma barreira de segurança que protege o sistema contra acessos não autorizados."

## Termos de Desenvolvimento

- **Bug** → "Uma falha no sistema que faz algo funcionar diferente do esperado. Quando identificamos, nossa equipe trabalha na correção."
- **Deploy / Release** → "Uma atualização do sistema com melhorias ou correções."
- **Hotfix** → "Uma correção urgente que é aplicada rapidamente para resolver um problema crítico."
- **Rollback** → "Quando voltamos o sistema para a versão anterior porque a atualização causou algum problema."
- **Feature** → "Uma funcionalidade ou recurso do sistema."
- **API** → "A ponte de comunicação que conecta diferentes sistemas ou partes do sistema entre si."
- **Webhook** → "Um aviso automático que um sistema envia para outro quando algo acontece."
- **Migração de dados** → "Processo de transferir ou reorganizar informações de um lugar para outro no sistema."

## Termos de Autenticação e Segurança

- **Token** → "Uma chave digital temporária que comprova que você está logado. Quando expira, precisa fazer login novamente."
- **Sessão** → "O período em que você fica logado no sistema. Tem duração limitada por segurança."
- **2FA / Autenticação de dois fatores** → "Uma camada extra de segurança que pede uma segunda confirmação além da senha (código no celular, email, etc.)."
- **Permissões / Roles** → "O nível de acesso que cada usuário tem no sistema. Define o que cada pessoa pode ver e fazer."
- **Hash de senha** → "Sua senha é transformada em um código irreversível. Nem nós conseguimos ver sua senha original."

## Termos de Performance

- **Latência** → "O tempo que o sistema leva para responder após você clicar em algo."
- **Timeout** → "Quando o sistema demora demais e desiste de completar a operação."
- **Gargalo / Bottleneck** → "Um ponto do sistema que está mais lento e atrasa todo o resto."
- **Memória / RAM** → "O espaço que o sistema usa para processar informações no momento. Quando acaba, fica lento."
- **CPU** → "O 'cérebro' do servidor que processa todas as operações."

## Termos de Dados

- **Backup** → "Uma cópia de segurança das informações, feita periodicamente para proteção."
- **Query** → "Uma consulta/busca que o sistema faz no banco de dados."
- **Sync / Sincronização** → "O processo de atualizar informações para que todos os sistemas mostrem os mesmos dados."
- **Log** → "Um registro detalhado de tudo que acontece no sistema, usado para investigar problemas."
- **Export/Import** → "Exportar é tirar dados do sistema (geralmente em planilha). Importar é colocar dados no sistema."`,
  },
  {
    id: 'padroes-descricao-cliente',
    title: 'Padrões Comuns de Descrição de Clientes',
    content: `# Como Clientes Descrevem Problemas Técnicos

## Padrão 1: "Não funciona" / "Não tá funcionando"
O que geralmente significa:
- O botão não responde ao clique → Pode ser JS não carregado, erro no console, botão desabilitado
- A página não carrega → Pode ser erro 500, timeout, problema de rede, cache
- A funcionalidade não faz o esperado → Pode ser bug, falta de permissão, dados inconsistentes
- O login não funciona → Pode ser senha errada, conta bloqueada, token expirado, SSO com problema

Perguntas para diagnosticar:
- "O que exatamente você está tentando fazer?"
- "O que acontece quando você tenta? Aparece alguma mensagem?"
- "Isso funcionava antes? Mudou alguma coisa recentemente?"
- "Está acontecendo só com você ou com outros colegas também?"

## Padrão 2: "Sumiu" / "Desapareceu" / "Não tem mais"
O que geralmente significa:
- Dados não aparecem na listagem → Filtro aplicado, permissão alterada, paginação, cache
- Botão/menu sumiu → Mudança de permissão, atualização de interface, role diferente
- Relatório vazio → Filtro de data, dados não processados ainda, permissão de visualização
- Arquivo/documento não encontrado → Pode ter sido movido, excluído, ou estar em outra área

Perguntas para diagnosticar:
- "Quando foi a última vez que você viu essa informação?"
- "Você mudou algo nas configurações ou filtros recentemente?"
- "Outros colegas conseguem ver?"
- "Pode me mandar um print da tela como está agora?"

## Padrão 3: "Tá lento" / "Demora muito" / "Fica carregando"
O que geralmente significa:
- Tela de loading infinita → Request travado, erro silencioso, timeout não tratado
- Demora para salvar → Query pesada, muitos dados, lock no banco
- Sistema inteiro lento → Problema de infraestrutura, pico de uso, memória
- Relatório demora → Muitos dados, query não otimizada, processamento pesado

Perguntas para diagnosticar:
- "É só essa parte do sistema ou tudo está lento?"
- "Começou quando? Sempre foi assim ou mudou?"
- "Com quantos registros/dados você está trabalhando?"
- "Já tentou em outro navegador ou limpar o cache?"

## Padrão 4: "Tá bugado" / "Tá todo errado" / "Os dados não batem"
O que geralmente significa:
- Layout quebrado → CSS não carregou, responsividade, versão do navegador
- Números inconsistentes → Cálculo errado, dados duplicados, filtro diferente entre telas
- Comportamento inesperado → Bug de lógica, estado inconsistente, race condition
- Dados misturados → Problema de filtro, cache mostrando dados antigos, bug de permissão

Perguntas para diagnosticar:
- "Pode me mostrar o que está vendo? (print)"
- "O que você esperava ver vs o que está aparecendo?"
- "Já tentou atualizar a página (Ctrl+F5)?"
- "Qual navegador e dispositivo está usando?"

## Padrão 5: "Não consigo acessar" / "Não deixa eu entrar"
O que geralmente significa:
- Tela de login não aceita → Senha errada, caps lock, conta inativa, bloqueio por tentativas
- Erro após login → Token/sessão com problema, permissão não configurada
- Página de erro ao acessar funcionalidade → Falta de role/permissão específica
- "Acesso negado" → Permissão não atribuída, política de acesso

Perguntas para diagnosticar:
- "Que mensagem aparece quando tenta acessar?"
- "Já tentou recuperar a senha?"
- "Seu acesso foi criado recentemente ou já usava antes?"
- "Consegue acessar outras partes do sistema?"

## Padrão 6: "Deu erro" / "Apareceu uma mensagem"
O que geralmente significa:
- Mensagem genérica de erro → Pode ser qualquer coisa — SEMPRE peça o print ou texto exato
- Tela branca → Erro de JS não capturado, build quebrado
- Mensagem em inglês → Erro não traduzido do backend/API
- Pop-up de erro → Validação de formulário, regra de negócio, erro de API

Perguntas para diagnosticar:
- "Pode copiar o texto da mensagem ou tirar um print?"
- "O que você estava fazendo exatamente quando apareceu?"
- "Consegue reproduzir? Acontece sempre ou às vezes?"
- "Aconteceu depois de alguma ação específica?"`,
  },
  {
    id: 'tecnicas-simplificacao',
    title: 'Técnicas de Simplificação de Linguagem Técnica',
    content: `# Técnicas para Simplificar Linguagem Técnica

## Princípio 1: Foque no impacto, não na causa técnica

O cliente não precisa saber O QUE quebrou. Precisa saber:
1. O que está acontecendo (sintoma que ele vê)
2. Se afeta ele (impacto)
3. O que está sendo feito (ação)
4. Quando volta ao normal (prazo)

### Exemplo:
Técnico: "O serviço de autenticação OAuth2 está retornando erro 503 devido a um problema no provider externo de identidade, causando falha no fluxo de SSO."

Para o cliente: "Estamos com uma intermitência no sistema de login que pode afetar o acesso de alguns usuários. Nossa equipe já identificou a origem e está trabalhando na normalização. Enquanto isso, você pode tentar acessar novamente em alguns minutos."

## Princípio 2: Use analogias do cotidiano

Analogias ajudam quando o cliente quer entender o porquê:
- **Cache** → "É como a memória recente do sistema. Às vezes ele lembra de uma informação antiga e precisa 'esquecer' para buscar a atualizada."
- **Servidor sobrecarregado** → "É como um restaurante lotado — as coisas demoram mais quando tem muita gente usando ao mesmo tempo."
- **Bug** → "É como um erro de digitação em uma receita — o prato sai diferente do esperado, mas depois que achamos e corrigimos, volta ao normal."
- **Atualização/Deploy** → "É como uma reforma rápida — o sistema fica indisponível por alguns minutos enquanto aplicamos as melhorias."
- **Backup** → "É uma cópia de segurança de todas as informações, como uma foto de tudo que tem no sistema naquele momento."
- **Sincronização** → "É como quando dois relógios mostram horas diferentes e precisamos acertar para que marquem o mesmo horário."

## Princípio 3: Substitua jargão por verbos de ação

Em vez de nomear o componente técnico, descreva o que ele FAZ:
- "O servidor de email está down" → "O envio de emails está temporariamente parado"
- "A API de pagamentos retornou timeout" → "A confirmação do pagamento está demorando mais que o normal"
- "O job de processamento falhou" → "O processamento dos seus dados não foi concluído e vamos executar novamente"
- "O certificado SSL expirou" → "Houve um problema com a segurança do site que já estamos renovando"

## Princípio 4: Estruture em camadas de detalhe

Dê a informação principal primeiro, detalhes depois:

**Camada 1 (obrigatória):** O que aconteceu + o que estamos fazendo
"Identificamos uma instabilidade no sistema. Nossa equipe já está atuando na correção."

**Camada 2 (se o cliente perguntar mais):** Impacto + prazo
"Isso pode afetar [funcionalidade específica]. A previsão de normalização é [prazo]."

**Camada 3 (se o cliente for técnico e quiser saber):** Causa resumida
"O problema está relacionado a [causa simplificada]. Estamos [ação técnica simplificada]."

## Princípio 5: Traduza mensagens de erro

Mensagens de erro comuns e como explicar:

- "Connection refused" → "O sistema não conseguiu se conectar ao servidor. Pode ser temporário."
- "Null pointer exception" → "O sistema tentou acessar uma informação que não existe."
- "Out of memory" → "O sistema ficou sem recursos para processar. Estamos liberando espaço."
- "Permission denied" → "Sua conta não tem permissão para essa ação. Verifique com seu administrador."
- "File not found" → "O arquivo que o sistema procura não foi encontrado no local esperado."
- "Database connection failed" → "Houve uma falha na conexão com o local onde os dados ficam armazenados."
- "Invalid token" → "Sua sessão de acesso expirou. Faça login novamente."
- "Rate limit exceeded" → "Muitas operações foram feitas em pouco tempo. Aguarde um momento."
- "Disk space full" → "O espaço de armazenamento está cheio. Estamos liberando."
- "SSL handshake failed" → "Houve um problema na verificação de segurança da conexão."`,
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
  console.log('=== Ingestão: Tradutor Técnico ===\n')

  const supabase = createAdminClient()

  console.log('1. Inserindo assistente...')
  const { error: assistantError } = await supabase.from('assistants').upsert(
    {
      name: 'Tradutor Técnico',
      slug: ASSISTANT_SLUG,
      description: 'Traduz entre linguagem técnica e linguagem simples para o cliente',
      model: 'gemini-2.5-flash-lite',
      temperature: 0.3,
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
  console.log('   Assistente "Tradutor Técnico" inserido/atualizado com sucesso.\n')

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
  console.log(`  Assistente: Tradutor Técnico (${ASSISTANT_SLUG})`)
  console.log(`  Modelo: gemini-2.5-flash-lite`)
  console.log(`  Documentos: ${knowledgeDocs.length}`)
  console.log(`  Chunks: ${totalInserted}`)
}

main().catch((err) => {
  console.error('Erro fatal:', err)
  process.exit(1)
})
