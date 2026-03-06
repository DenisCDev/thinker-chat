/**
 * Script standalone para inserir o assistente "Anti Insatisfação"
 * e ingerir conhecimento na knowledge_base com embeddings.
 *
 * Uso: npx tsx scripts/ingest-anti-insatisfacao.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Supabase admin client (inline to avoid Next.js server imports)
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
// Embedding helpers (inline to avoid path alias issues in scripts/)
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
  // Free tier limit is 100 requests/min — use small batches with delay
  const BATCH_SIZE = 20
  const embeddings: number[][] = []
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(texts.length / BATCH_SIZE)

    // Retry with backoff on rate limits
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
    // Small delay between batches to stay under rate limits
    if (i + BATCH_SIZE < texts.length) await sleep(2000)
  }
  return embeddings
}

// ---------------------------------------------------------------------------
// Assistente
// ---------------------------------------------------------------------------
const ASSISTANT_SLUG = 'anti-insatisfacao'

const SYSTEM_PROMPT = `Você é o assistente "Anti Insatisfação" — um especialista em comunicação empática e profissional para equipes de suporte ao cliente.

# Seu papel
O agente de suporte vai colar uma situação difícil com um cliente (reclamação, frustração, pedido impossível, bug, limitação do sistema, etc.) e você deve reformular ou criar uma mensagem adequada para enviar ao cliente.

# Como você responde
1. Leia a situação descrita pelo agente
2. Identifique o tipo de cenário (bug, limitação, recusa, erro do cliente, etc.)
3. Gere uma mensagem pronta para enviar ao cliente, seguindo os frameworks abaixo
4. Se relevante, inclua uma explicação breve para o agente sobre a estratégia usada

# Framework principal: Reconhecer → Empatizar → Advocar → Solucionar (REAS)
Toda resposta ao cliente deve seguir estes 4 passos:
- **Reconhecer**: Mostre que você ouviu e entendeu a situação específica do cliente
- **Empatizar**: Valide o sentimento do cliente sem ser condescendente
- **Advocar**: Posicione-se como aliado do cliente (você está DO LADO dele)
- **Solucionar**: Ofereça uma solução, alternativa ou próximo passo concreto

# Técnicas complementares

## Comunicação Não-Violenta (OFNR)
- **Observação**: Descreva os fatos sem julgamento
- **Sentimento**: Reconheça o que o cliente pode estar sentindo
- **Necessidade**: Identifique a necessidade por trás do pedido
- **Pedido**: Faça uma proposta clara e viável

## Técnica STATE (Crucial Conversations)
- **Share facts**: Comece pelos fatos objetivos
- **Tell your story**: Explique sua interpretação com cuidado
- **Ask**: Pergunte a perspectiva do outro
- **Talk tentatively**: Use linguagem tentativa, não absoluta
- **Encourage testing**: Convide o cliente a contribuir com a solução

## Técnica Feel-Felt-Found
- "Entendo como você se sente..."
- "Outros clientes já se sentiram da mesma forma..."
- "O que descobrimos/encontramos foi que..."

# Regras de linguagem

## SEMPRE faça:
- Foque no que PODE ser feito, não no que não pode
- Use linguagem positiva e orientada a soluções
- Ofereça alternativas concretas
- Personalize (use o nome do cliente quando disponível)
- Seja específico sobre próximos passos e prazos quando possível
- Mantenha tom profissional mas humano e acolhedor
- Use frases curtas e parágrafos pequenos

## NUNCA faça:
- Não use "infelizmente" (substitua por frases de ação)
- Não use "não é possível" (substitua por "o que podemos fazer é...")
- Não use "não podemos" (substitua por "a melhor alternativa que temos é...")
- Não culpe o cliente, mesmo que o erro seja dele
- Não use linguagem burocrática ou robótica
- Não prometa o que não pode cumprir
- Não minimize o problema do cliente
- Não use "mas" após validar o sentimento (use "e" ou "ao mesmo tempo")

## Substituições de palavras-gatilho:
- "Infelizmente" → "Neste momento" / "O que posso fazer agora é"
- "Não é possível" → "A melhor alternativa que encontrei"
- "Não podemos" → "O que podemos fazer é" / "Uma opção que temos"
- "Você precisa" → "Uma sugestão que funciona bem é"
- "É política da empresa" → "Para garantir a melhor experiência para todos"
- "Não tenho como" → "Vou buscar a melhor solução para isso"
- "Problema" → "Situação" / "Questão"
- "Reclamação" → "Feedback" / "Observação"

# Formato da resposta

Responda sempre com:

**Mensagem para o cliente:**
[A mensagem pronta para copiar e enviar]

**Estratégia utilizada:** [Breve explicação de 1-2 linhas sobre qual técnica foi aplicada e por quê — isso ajuda o agente a aprender]

Se o agente pedir, você pode gerar variações (mais formal, mais informal, mais curta, etc.).`

const SAMPLE_QUESTIONS = [
  'O cliente quer uma funcionalidade que não existe no sistema',
  'Tem um bug que já sabemos mas não tem previsão de correção',
  'O sistema ficou fora do ar e o cliente quer explicações',
  'O cliente errou e está culpando nosso sistema',
  'Preciso avisar que uma funcionalidade vai ser descontinuada',
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
    id: 'frameworks-comunicacao',
    title: 'Frameworks de Comunicação Empática',
    content: `# Frameworks de Comunicação para Suporte ao Cliente

## 1. Framework REAS (Reconhecer → Empatizar → Advocar → Solucionar)

O método mais eficaz para lidar com clientes insatisfeitos segue 4 passos:

### Reconhecer
Mostre que você ouviu o cliente. Repita o problema com suas próprias palavras.
- "Entendi que você está enfrentando [situação específica]..."
- "Pelo que você descreveu, a questão é [resumo]..."
- "Obrigado por nos trazer essa questão sobre [tema]..."

### Empatizar
Valide o sentimento sem ser condescendente. Não diga "eu sei como você se sente" — mostre que entende o IMPACTO.
- "Imagino como isso deve estar impactando seu dia a dia..."
- "É totalmente compreensível a sua frustração com essa situação..."
- "Concordo que isso não deveria estar acontecendo..."

### Advocar
Posicione-se como aliado. O cliente precisa sentir que você está DO LADO dele, lutando pela solução.
- "Vou pessoalmente acompanhar essa questão..."
- "Já sinalizei para nossa equipe técnica com prioridade..."
- "Estou aqui para garantir que isso seja resolvido..."

### Solucionar
Sempre termine com uma ação concreta. Mesmo que não tenha solução imediata, dê um próximo passo claro.
- "O que vou fazer agora é [ação]. Você receberá retorno até [prazo]."
- "Enquanto isso, uma alternativa que funciona bem é [alternativa]."
- "Vou [ação] e volto aqui até [prazo] com uma atualização."

## 2. Framework OFNR (Comunicação Não-Violenta - Marshall Rosenberg)

A CNV ajuda a comunicar decisões difíceis sem criar conflito:

### Observação (sem julgamento)
Descreva apenas os fatos, sem interpretação.
- Errado: "Você não configurou direito"
- Certo: "Percebi que a configuração está com o campo X em branco"

### Sentimento (reconhecer)
Identifique o sentimento por trás da reclamação.
- "Entendo que isso gera insegurança/frustração/preocupação..."

### Necessidade (identificar)
Descubra a necessidade real. O cliente pede X, mas precisa de Y.
- Cliente pede relatório customizado → precisa de visibilidade sobre os dados
- Cliente pede desconto → precisa sentir que está sendo valorizado

### Pedido (viável e concreto)
Faça uma proposta clara que atenda à necessidade identificada.
- "O que posso propor é [alternativa concreta]..."

## 3. Técnica STATE (Crucial Conversations - Patterson et al.)

Para conversas difíceis onde precisamos dar notícias ruins:

### Share facts (Compartilhe fatos)
Comece sempre pelos fatos objetivos, não por conclusões.

### Tell your story (Conte sua perspectiva)
Explique sua interpretação dos fatos com humildade.

### Ask (Pergunte)
Peça a perspectiva do cliente. Isso cria colaboração.

### Talk tentatively (Fale tentativamente)
Use "parece que", "pelo que observamos", nunca afirmações absolutas.

### Encourage testing (Encoraje participação)
Convide o cliente a participar da solução.

## 4. Técnica Feel-Felt-Found

Ideal para quando o cliente se sente sozinho no problema:
1. "Entendo como você se sente com essa situação..."
2. "Outros clientes também passaram por algo parecido..."
3. "O que encontramos como melhor caminho foi..."

Essa técnica normaliza a experiência e oferece uma saída comprovada.

## 5. Princípio do Mínimo Esforço (The Effortless Experience)

A lealdade do cliente não vem de "encantar", mas de REDUZIR O ESFORÇO:
- Resolva no primeiro contato quando possível
- Não faça o cliente repetir informações
- Antecipe as perguntas seguintes
- Dê instruções passo a passo claras
- Ofereça resolver pelo canal atual (não mande para outro lugar)`,
  },
  {
    id: 'templates-cenarios',
    title: 'Templates por Cenário de Suporte',
    content: `# Templates de Resposta por Cenário

## Cenário 1: Sistema não possui a funcionalidade

Quando o cliente pede algo que o sistema não faz:

### Template:
"[Nome], obrigado por compartilhar essa necessidade! Entendo que [funcionalidade] faria diferença no seu dia a dia.

Neste momento, o sistema trabalha de uma forma um pouco diferente: [explique o que o sistema faz de similar ou relacionado].

O que posso fazer por você agora:
- [Alternativa 1 viável]
- [Alternativa 2 se houver]

Além disso, vou registrar sua sugestão diretamente com nossa equipe de produto. Feedbacks como o seu são fundamentais para priorizarmos as próximas melhorias."

### Estratégia: Valide a necessidade → Mostre o que existe → Ofereça alternativas → Registre como feedback

---

## Cenário 2: Bug conhecido em correção

Quando há um bug que a equipe já está trabalhando:

### Template:
"[Nome], obrigado por nos avisar sobre essa questão com [funcionalidade]. Identificamos essa situação e nossa equipe técnica já está trabalhando na correção.

Sei que isso impacta seu trabalho e quero garantir que você tenha alternativas enquanto resolvemos:
- [Workaround 1]
- [Workaround 2 se houver]

Vou acompanhar pessoalmente o andamento e te atualizo assim que tivermos novidades. Se precisar de algo mais nesse meio tempo, é só me chamar."

### Estratégia: Reconheça → Mostre que já está em andamento → Ofereça workaround → Comprometa-se com update

---

## Cenário 3: Cliente insistindo em algo impossível

Quando o cliente insiste em algo que realmente não pode ser feito:

### Template:
"[Nome], entendo perfeitamente por que [o que ele quer] é importante para você — faz total sentido dentro do seu contexto.

Quero ser transparente: [explicação honesta e simples do porquê]. Isso existe para [razão que beneficia o cliente ou todos os clientes].

O que encontramos como melhor caminho para situações como a sua é:
- [Alternativa concreta 1]
- [Alternativa concreta 2]

Qual dessas opções faz mais sentido para você? Estou aqui para ajudar a implementar a que preferir."

### Estratégia: Valide a intenção → Seja transparente → Redirecione para alternativas → Dê escolha ao cliente

---

## Cenário 4: Limitação de política/processo

Quando é uma regra da empresa que não pode ser flexibilizada:

### Template:
"[Nome], entendo sua solicitação e agradeço por trazer isso. Essa questão está relacionada a [política/processo] que existe para [razão positiva - proteção, qualidade, segurança, etc.].

Dentro do que posso fazer, as melhores opções que tenho para você são:
- [Opção 1]
- [Opção 2]

Se fizer sentido, posso também [ação adicional que demonstre esforço]. O que acha?"

### Estratégia: Explique o "porquê" de forma positiva → Ofereça o que PODE → Demonstre esforço extra

---

## Cenário 5: Prazo que não pode ser cumprido

Quando o cliente pede algo para ontem:

### Template:
"[Nome], entendo a urgência da sua demanda e quero te dar um panorama realista para que você possa se planejar.

Para [o que foi pedido], o processo envolve [explicação breve]. O prazo que consigo garantir com qualidade é [prazo real].

O que posso fazer para ajudar agora:
- [Solução parcial imediata se houver]
- [Priorização ou escalação]

Vou trabalhar para que seja o mais rápido possível dentro desse prazo. Te mantenho atualizado a cada [frequência]."

### Estratégia: Reconheça urgência → Seja realista → Ofereça solução parcial imediata → Comprometa-se com updates

---

## Cenário 6: Funcionalidade descontinuada

Quando algo que o cliente usava vai deixar de existir:

### Template:
"[Nome], quero te informar sobre uma mudança importante: [funcionalidade] passará por uma atualização.

Entendo que você utiliza [funcionalidade] para [uso que o cliente faz], e sabemos que mudanças assim pedem adaptação.

Para facilitar essa transição, preparamos:
- [Nova forma de fazer / substituto]
- [Material de apoio / tutorial se houver]
- [Período de transição se aplicável]

Estou à disposição para te ajudar pessoalmente nessa adaptação. Podemos agendar um momento para eu te mostrar o novo fluxo?"

### Estratégia: Comunique como evolução → Reconheça o impacto → Ofereça suporte na transição → Acompanhe pessoalmente

---

## Cenário 7: Erro do cliente (sem culpá-lo)

Quando o problema foi causado pelo próprio cliente:

### Template:
"[Nome], analisei a situação e identifiquei o que está acontecendo: [descreva o que aconteceu de forma neutra, sem atribuir culpa].

Isso é algo que pode acontecer com facilidade, especialmente quando [normalize a situação].

Para resolver agora:
1. [Passo 1 para corrigir]
2. [Passo 2]

E para evitar que aconteça novamente, uma dica que funciona bem é [prevenção]. Se tiver qualquer dúvida durante o processo, me chama que te guio passo a passo."

### Estratégia: Descreva neutro → Normalize o erro → Resolva → Previna sem culpar`,
  },
  {
    id: 'frases-expressoes',
    title: 'Frases e Expressões para Suporte Empático',
    content: `# Banco de Frases e Expressões

## Frases de Reconhecimento e Abertura
- "Obrigado por nos trazer essa questão."
- "Entendo a situação que você está descrevendo."
- "Agradeço por ter nos informado sobre isso."
- "Pelo que você compartilhou, consigo entender exatamente o cenário."
- "Obrigado pela paciência em nos explicar o que aconteceu."

## Frases de Empatia e Validação
- "É totalmente compreensível a sua preocupação."
- "Concordo que essa situação não é a ideal."
- "Entendo como isso pode impactar o seu dia a dia."
- "Faz total sentido você esperar que funcionasse dessa forma."
- "Imagino que deve ser frustrante lidar com isso."
- "Sua expectativa é completamente válida."
- "Ninguém merece passar por essa dificuldade."
- "Isso é realmente importante e merece atenção."

## Frases de Advocacy (Aliança)
- "Vou pessoalmente acompanhar essa questão."
- "Estou aqui para garantir que isso seja resolvido."
- "Vou tratar isso com prioridade."
- "Pode contar comigo para resolver."
- "Vou fazer o máximo para encontrar a melhor solução."
- "Já estou trabalhando nisso."
- "Vou levar sua questão diretamente para a equipe responsável."

## Frases de Transição (do problema para a solução)
- "O que posso fazer por você agora é..."
- "A melhor alternativa que encontrei é..."
- "Neste momento, o caminho mais eficiente é..."
- "O que proponho é o seguinte..."
- "Para resolver essa questão, vou..."
- "O próximo passo seria..."
- "Uma opção que tem funcionado muito bem é..."

## Frases para Oferecer Alternativas
- "Uma opção que funciona bem para situações como a sua é..."
- "O que outros clientes têm feito com bons resultados é..."
- "Posso sugerir uma abordagem diferente que pode atender sua necessidade?"
- "Temos algumas opções — deixa eu te apresentar as que fazem mais sentido para o seu caso."
- "Dentro do que temos disponível, acredito que a melhor opção seria..."

## Frases de Fechamento e Compromisso
- "Vou te manter atualizado sobre o andamento."
- "Se precisar de qualquer coisa, pode me chamar."
- "Estou à disposição para qualquer dúvida."
- "Volto aqui com novidades até [prazo]."
- "Vou acompanhar e te aviso assim que tiver atualização."

## Palavras e Expressões a EVITAR → Alternativas Positivas

| Evitar | Usar |
|--------|------|
| Infelizmente | Neste momento / O que posso fazer é |
| Não é possível | A melhor alternativa que temos |
| Não podemos | O que podemos fazer é |
| Você deveria ter | Uma boa prática é |
| Você precisa | Uma sugestão que funciona bem |
| É política da empresa | Para garantir a melhor experiência |
| Não tenho como | Vou buscar a melhor solução |
| Problema | Situação / Questão |
| Reclamação | Feedback / Observação |
| Mas | E / Ao mesmo tempo |
| Calma | Entendo / Compreendo |
| Não é minha área | Vou conectar você com quem pode resolver |
| Já informei | Vou reforçar essa informação |
| Você não entendeu | Deixa eu explicar de outra forma |
| Isso é normal | Entendo que não é a experiência ideal |`,
  },
  {
    id: 'principios-livros',
    title: 'Princípios dos Livros de Referência',
    content: `# Princípios Aplicados dos Livros de Referência

## Crucial Conversations (Patterson, Grenny, McMillan, Switzler)

### Conceito Central
Conversas cruciais são aquelas onde as opiniões divergem, as emoções são fortes e os resultados importam. No suporte, quase toda interação com cliente insatisfeito é uma conversa crucial.

### Aplicação no Suporte:

**1. Comece com o coração**
Antes de responder, pergunte-se: "O que eu realmente quero para este cliente, para mim e para o relacionamento?" Isso evita respostas defensivas.

**2. Aprenda a observar**
Identifique quando a conversa está ficando insegura (cliente ficando agressivo ou se fechando). Quando isso acontece, pare e restabeleça a segurança antes de continuar.

**3. Torne seguro**
O cliente precisa sentir que você se importa com os interesses dele (propósito mútuo) e que o respeita (respeito mútuo). Sem esses dois, nenhuma técnica funciona.

**4. Domine sua história**
Separe os fatos da história que você conta sobre eles. Fato: "O cliente escreveu em maiúsculas." História: "Ele está sendo grosso." Responda aos fatos, não à história.

**5. STATE: O método para falar com honestidade**
- Share facts: Comece com dados objetivos
- Tell your story: Compartilhe sua interpretação com humildade
- Ask: Peça a versão do outro
- Talk tentatively: Use "parece que", "talvez", "pelo que observamos"
- Encourage testing: Convide o cliente a discordar ou propor

---

## Comunicação Não-Violenta (Marshall Rosenberg)

### Conceito Central
Por trás de toda reclamação existe uma necessidade não atendida. Quando identificamos e reconhecemos essa necessidade, o conflito diminui naturalmente.

### As 4 necessidades universais mais comuns no suporte:
1. **Ser ouvido e reconhecido** — O cliente quer saber que alguém se importa
2. **Ter controle/autonomia** — O cliente quer poder resolver sozinho ou ter opções
3. **Segurança/confiabilidade** — O cliente quer saber que pode contar com o sistema
4. **Eficiência** — O cliente quer que seu tempo seja respeitado

### Aplicação prática:
- Quando o cliente reclama de bug → necessidade de confiabilidade → "Entendo que você precisa contar com o sistema funcionando de forma estável"
- Quando insiste em funcionalidade → necessidade de autonomia → "Faz sentido querer ter esse controle sobre [processo]"
- Quando está irritado com atendimento → necessidade de ser ouvido → "Quero garantir que sua questão receba a atenção que merece"
- Quando reclama de demora → necessidade de eficiência → "Seu tempo é valioso e vou trabalhar para resolver isso rapidamente"

### O poder do "pedido" vs "exigência":
Na CNV, sempre fazemos PEDIDOS (viáveis, concretos, no positivo), nunca exigências. No suporte, isso significa oferecer opções em vez de impor soluções:
- Exigência: "Você precisa atualizar o sistema"
- Pedido: "Posso sugerir uma atualização que resolveria essa questão? Leva cerca de 5 minutos."

---

## Hug Your Haters (Jay Baer)

### Conceito Central
Reclamações são presentes. Cada cliente que reclama está dando uma oportunidade de melhorar e de criar um defensor da marca.

### Os 2 tipos de "haters":
1. **Offstage haters**: Reclamam em redes sociais, sites de review. Querem audiência.
2. **Onstage haters**: Reclamam direto para a empresa (suporte, email). Querem solução.

No suporte, lidamos majoritariamente com onstage haters — e eles são os mais valiosos porque QUEREM que a empresa resolva.

### Regras para "abraçar" haters:
1. **Responda a todas as reclamações** — Silêncio é a pior resposta
2. **Responda rapidamente** — Velocidade importa tanto quanto qualidade
3. **Não discuta em público** — Leve para privado quando necessário
4. **Encontre um próximo passo** — Sempre termine com uma ação
5. **Seja humano** — Não use respostas genéricas/robóticas

### Estatística chave:
Clientes cujas reclamações são bem resolvidas se tornam MAIS leais do que clientes que nunca tiveram problemas. Isso é chamado de "Service Recovery Paradox".

---

## The Effortless Experience (Dixon, Toman, DeLisi)

### Conceito Central
A lealdade do cliente não vem de "momentos wow" — vem de REDUZIR O ESFORÇO. Cada obstáculo, transferência ou repetição destrói lealdade.

### Os 4 pilares para reduzir esforço:

**1. Resolução no primeiro contato**
Resolva tudo que puder ali mesmo. Não transfira, não peça para o cliente ligar de novo.

**2. Engenharia da experiência**
Antecipe as perguntas seguintes. Se o cliente perguntou A, provavelmente vai precisar saber B e C.

**3. Linguagem de experiência**
Use linguagem positiva e de advocacy. "Vou fazer isso por você" em vez de "Você precisa fazer isso".

**4. Empoderamento com controle**
Dê autonomia ao agente para resolver. Quanto mais regras rígidas, mais esforço para o cliente.

### Aplicação prática no suporte:
- Ao responder uma dúvida, já inclua a resposta para a dúvida seguinte provável
- Não peça informações que você já tem acesso
- Se precisa escalar, faça a transição (não jogue o cliente para outro lugar)
- Dê instruções passo a passo claras e numeradas
- Confirme o entendimento antes de encerrar`,
  },
]

// ---------------------------------------------------------------------------
// Chunking simplificado para documentos de conhecimento
// ---------------------------------------------------------------------------
interface Chunk {
  content: string
  metadata: {
    document_id: string
    document_title: string
    source_type: string
    chunk_index: number
    section?: string
  }
}

function chunkBySection(text: string): string[] {
  // Split by markdown H2 headers (## ) — each section becomes a chunk
  const sections = text.split(/\n(?=## )/)
  const chunks: string[] = []

  for (const section of sections) {
    const trimmed = section.trim()
    if (trimmed.length > 50) {
      // If a section is very large (> 4000 chars), split at H3 or ---
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
  console.log('=== Ingestão: Anti Insatisfação ===\n')

  const supabase = createAdminClient()

  // 1. Upsert assistant
  console.log('1. Inserindo assistente...')
  const { error: assistantError } = await supabase.from('assistants').upsert(
    {
      name: 'Anti Insatisfação',
      slug: ASSISTANT_SLUG,
      description: 'Reformula mensagens difíceis para clientes com empatia e profissionalismo',
      model: 'gemini-2.5-flash-lite',
      temperature: 0.4,
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
  console.log('   Assistente "Anti Insatisfação" inserido/atualizado com sucesso.\n')

  // 2. Remove old knowledge for this assistant (idempotent)
  console.log('2. Limpando conhecimento anterior...')
  const { count: deletedCount } = await supabase
    .from('knowledge_base')
    .delete({ count: 'exact' })
    .eq('assistant_slug', ASSISTANT_SLUG)

  console.log(`   ${deletedCount ?? 0} chunks anteriores removidos.\n`)

  // 3. Build chunks
  console.log('3. Gerando chunks...')
  const chunks = buildChunks(knowledgeDocs)
  console.log(`   ${chunks.length} chunks gerados a partir de ${knowledgeDocs.length} documentos.\n`)

  // 4. Generate embeddings
  console.log('4. Gerando embeddings...')
  const texts = chunks.map((c) => c.content)
  const embeddings = await generateEmbeddings(texts)
  console.log(`   ${embeddings.length} embeddings gerados.\n`)

  // 5. Insert into knowledge_base
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
  console.log(`  Assistente: Anti Insatisfação (${ASSISTANT_SLUG})`)
  console.log(`  Modelo: gemini-2.5-flash-lite`)
  console.log(`  Documentos: ${knowledgeDocs.length}`)
  console.log(`  Chunks: ${totalInserted}`)
  console.log(`\nPróximo passo: Teste no app selecionando o assistente "Anti Insatisfação".`)
}

main().catch((err) => {
  console.error('Erro fatal:', err)
  process.exit(1)
})
