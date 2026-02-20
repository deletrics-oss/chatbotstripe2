import { getAI } from "./ai";
import puppeteer from "puppeteer";

// Helper to scrape URL
async function scrapeUrl(url: string): Promise<string> {
    console.log(`[AI Scraper] Scraping URL: ${url}`);
    try {
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        // Set user agent to avoid bot detection
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        // Extract text from body
        const text = await page.evaluate(() => {
            return document.body.innerText;
        });

        await browser.close();
        // Limit text length
        return text.substring(0, 8000);
    } catch (error) {
        console.error(`[AI Scraper] Error scraping ${url}:`, error);
        return "";
    }
}

export interface SDRConfig {
    product: string;
    productDescription?: string;
    tone?: 'professional' | 'friendly' | 'casual' | 'sales' | 'support';
    includeEmoji?: boolean;
    maxLength?: number;
}

export type LeadIntent =
    | 'INTERESSADO'
    | 'QUALIFICADO'
    | 'REJEITADO'
    | 'MAIS_INFO'
    | 'AGENDAMENTO_SOLICITADO'
    | 'INDEFINIDO';

export interface IntentClassification {
    intent: LeadIntent;
    nextAction: 'propor_agendamento' | 'enviar_mais_detalhes' | 'encerrar_contato' | 'continuar_conversa' | 'notificar_humano';
    confidence: number;
    reason: string;
}

/**
 * Classify the intent of a lead's response
 */
export async function classifySDRIntent(
    leadName: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    lastMessage: string,
    product: string,
    userApiKey?: string | null
): Promise<IntentClassification> {
    const ai = getAI(userApiKey);
    if (!ai) throw new Error("AI service not configured");

    const historyFormatted = conversationHistory
        .map(m => `${m.role === 'assistant' ? 'SDR' : 'CLIENTE'}: ${m.content}`)
        .join('\n');

    const prompt = `Você é um Agente de Desenvolvimento de Vendas (SDR) de IA altamente inteligente. 
Analise o histórico da conversa e a última mensagem do cliente para determinar a intenção e a próxima melhor ação.

**Cliente:** ${leadName}
**Produto/Serviço oferecido:** ${product}

**Histórico da Conversa:**
${historyFormatted}

**Última Mensagem do Cliente:** "${lastMessage}"

Com base nisso, classifique a intenção do cliente e sugira a próxima ação seguindo EXATAMENTE estas categorias:

- **INTERESSADO**: O cliente demonstrou interesse e está aberto a continuar a conversa ou agendar.
- **QUALIFICADO**: O cliente atende aos critérios de interesse claro e está pronto para agendamento.
- **REJEITADO**: O cliente não tem interesse ou pediu para não ser contatado.
- **MAIS_INFO**: O cliente precisa de mais informações (preço, prazos, etc) antes de decidir.
- **AGENDAMENTO_SOLICITADO**: O cliente pediu explicitamente para agendar uma reunião ou conversa.
- **INDEFINIDO**: Não foi possível determinar a intenção com clareza.

Responda em formato JSON VÁLIDO com a seguinte estrutura:
{
  "intent": "INTERESSADO|QUALIFICADO|REJEITADO|MAIS_INFO|AGENDAMENTO_SOLICITADO|INDEFINIDO",
  "nextAction": "propor_agendamento|enviar_mais_detalhes|encerrar_contato|continuar_conversa|notificar_humano",
  "confidence": 0.0 a 1.0,
  "reason": "Explicação breve da classificação"
}

Responda APENAS com o JSON, sem explicações.`;

    try {
        const result = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            config: { responseMimeType: "application/json" },
            contents: [{ role: "user", parts: [{ text: prompt }] }]
        });

        const jsonText = result.text || "{}";
        return JSON.parse(jsonText) as IntentClassification;
    } catch (error) {
        console.error('[SDR AI] Error classifying intent:', error);
        return {
            intent: 'INDEFINIDO',
            nextAction: 'notificar_humano',
            confidence: 0,
            reason: 'Erro ao processar resposta via IA'
        };
    }
}

/**
 * Generate a humanized SDR response
 */
export async function generateSDRResponse(
    leadName: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    lastMessage: string,
    config: SDRConfig,
    intent: LeadIntent,
    userApiKey?: string | null
): Promise<string> {
    const ai = getAI(userApiKey);
    if (!ai) throw new Error("AI service not configured");

    const toneDescriptions = {
        professional: 'profissional mas acessível',
        friendly: 'amigável e próximo',
        casual: 'descontraído e leve',
        sales: 'focado em conversão e persuasivo',
        support: 'atencioso e prestativo'
    };

    const intentActions = {
        'INTERESSADO': 'Propor um horário para conversa ou enviar mais informações do produto',
        'QUALIFICADO': 'Propor agendamento de reunião ou fechamento direto',
        'MAIS_INFO': 'Fornecer os detalhes solicitados de forma concisa e persuasiva',
        'AGENDAMENTO_SOLICITADO': 'Confirmar o agendamento e propor horários específicos',
        'REJEITADO': 'Agradecer educadamente e encerrar o contato sem insistir',
        'INDEFINIDO': 'Fazer uma pergunta de esclarecimento para entender o que o cliente busca'
    };

    const historyFormatted = conversationHistory
        .map(m => `${m.role === 'assistant' ? 'SDR' : 'CLIENTE'}: ${m.content}`)
        .join('\n');

    // Check for URLs in product and description
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const combinedText = `${config.product} ${config.productDescription || ''}`;
    const urls = combinedText.match(urlRegex);
    let scrapedContent = "";

    if (urls && urls.length > 0) {
        // Scrape the first URL found (to save time/resources)
        scrapedContent = await scrapeUrl(urls[0]);
    }

    const prompt = `Você é um SDR de IA (Sales Development Representative) focado em WhatsApp. 
Sua missão é continuar a conversa com o cliente ${leadName} de forma natural, humana e persuasiva.

**Informações do Produto/Serviço:**
${config.product}
${config.productDescription ? `Detalhes Adicionais: ${config.productDescription}` : ""}
${scrapedContent ? `\n**Conteúdo Extraído do Site (Contexto Adicional):**\n${scrapedContent}` : ""}

**Configuração da Persona:**
- Tom: ${toneDescriptions[config.tone || 'professional']}
- Intenção detectada no cliente: ${intent}
- Ação sugerida: ${intentActions[intent]}

**Histórico da Conversa:**
${historyFormatted}

**Última Mensagem do Cliente:** "${lastMessage}"

**Regras de Ouro:**
1. Seja NATURAL. Não pareça um robô. 
2. Use no máximo 2-3 frases curtas. O cliente quer rapidez no WhatsApp.
3. ${config.includeEmoji ? "Use 1-2 emojis de forma moderada." : "NÃO use emojis."}
4. Nunca minta sobre o produto. Se não souber algo, peça para o humano assumir.
5. Termine com uma pergunta ou chamada para ação leve.
6. A resposta deve ser curta e IMPACTANTE.

Responda APENAS com a mensagem de resposta.`;

    try {
        const result = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [{ role: "user", parts: [{ text: prompt }] }]
        });

        return (result.text || "").trim();
    } catch (error) {
        console.error('[SDR AI] Error generating response:', error);
        return "Olá! Tive um problema técnico, mas já vou te responder corretamente. Pode me dar um segundo?";
    }
}
