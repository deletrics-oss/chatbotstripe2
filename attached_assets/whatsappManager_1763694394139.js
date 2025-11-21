// services/whatsappManager.js (Versão 2.9 - Com Suporte a Imagens no JSON)
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js"); // <-- ADICIONADO MessageMedia
const { GoogleGenerativeAI } = require("@google/generative-ai");
const qrcode = require("qrcode");
const fs = require("fs");
const path = require("path");
const { logger } = require("./logger");

let genAI;
try {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
} catch (error) {
    logger.error("ERRO GRAVE: Chave da API do Gemini não configurada ou inválida no .env", error);
    genAI = null;
}

const sessions = {};
let wss;
const pausedChats = {}; // Objeto para armazenar chats pausados por sessão

function setWss(webSocketServer) { wss = webSocketServer; }

function broadcastEvent(event) {
    if (!wss) return;
    const data = JSON.stringify(event);
    wss.clients.forEach(client => { if (client.readyState === client.OPEN) client.send(data); });
}

// --- MOTOR DE REGRAS (SEM IA) ---
// =========================================================================
// INÍCIO DA ALTERAÇÃO: A função agora retorna 'image_url'
// =========================================================================
function runRuleBasedEngine(message, sessionId) {
    const logicDir = path.join("uploads", sessionId);
    if (!fs.existsSync(logicDir)) return { handled: false };
    const files = fs.readdirSync(logicDir);
    const jsonFile = files.find(f => f.endsWith(".json"));
    if (!jsonFile) return { handled: false };

    try {
        const filePath = path.join(logicDir, jsonFile);
        const logicData = JSON.parse(fs.readFileSync(filePath, "utf8"));
        const userMessage = message.body.toLowerCase().trim();

        for (const rule of logicData.rules) {
            const foundKeyword = rule.keywords.find(keyword => userMessage === keyword.toLowerCase());
            if (foundKeyword) {
                logger.log(`[${sessionId}] Regra encontrada para keyword: "${foundKeyword}". Respondendo.`);
                return {
                    handled: true,
                    reply: rule.reply,
                    shouldPause: rule.pause_bot_after_reply === true,
                    image_url: rule.image_url || null // <-- Retorna image_url se existir
                };
            }
        }
        if (logicData.default_reply) {
            logger.log(`[${sessionId}] Nenhuma regra encontrada. Usando resposta padrão.`);
             // A resposta padrão não tem imagem por padrão
            return { handled: true, reply: logicData.default_reply, shouldPause: false, image_url: null };
        }
    } catch (error) {
        logger.error(`[${sessionId}] Erro ao processar arquivo de lógica .json:`, error);
    }
    return { handled: false };
}
// =========================================================================
// FIM DA ALTERAÇÃO
// =========================================================================

function createSession(sessionId) {
    logger.log(`[WhatsappManager] Criando ou reconectando sessão: ${sessionId}`);
    const client = new Client({
        authStrategy: new LocalAuth({ clientId: sessionId }),
        puppeteer: {
            args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-accelerated-2d-canvas", "--no-first-run", "--no-zygote", "--disable-gpu"]
        }
    });
    sessions[sessionId] = { client, status: "INITIALIZING", qrCode: null };
    pausedChats[sessionId] = []; // Inicializa lista de pausados para esta sessão

    broadcastEvent({ type: "status_update", sessionId, status: "INITIALIZING" });

    client.on("qr", (qr) => {
        logger.log(`[${sessionId}] QR Code recebido.`);
        sessions[sessionId].status = "QR_PENDING";
        qrcode.toDataURL(qr, (err, url) => { if (!err) sessions[sessionId].qrCode = url; });
        broadcastEvent({ type: "status_update", sessionId, status: "QR_PENDING" });
    });

    client.on("ready", () => {
        logger.log(`[${sessionId}] Cliente pronto e conectado.`);
        sessions[sessionId].status = "READY";
        sessions[sessionId].qrCode = null;
        broadcastEvent({ type: "status_update", sessionId, status: "READY" });
    });

    client.on("disconnected", (reason) => {
        if (sessions[sessionId] && sessions[sessionId].status !== "DESTROYING") {
            logger.warn(`[${sessionId}] Cliente desconectado:`, reason);
            destroySession(sessionId);
        }
    });

    client.on("message", async (message) => {
        const userNumber = message.from;
        if (userNumber.endsWith("@g.us") || message.isStatus) return;

        // --- Adicionado Anti-Loop Básico ---
        if (message.fromMe) {
             // logger.log(`[${sessionId}] Mensagem própria ignorada (fromMe).`); // Opcional: logar
             return; 
         }
         // Seria ideal adicionar a lógica para ignorar outros bots também, se necessário

        // --- Lógica de Pausa ---
        const sessionPausedChats = pausedChats[sessionId] || [];
        const isPaused = sessionPausedChats.includes(userNumber);
        const userMessageLower = message.body.toLowerCase().trim();
        const unpauseKeywords = ["menu", "ajuda", "inicio", "início", "start", "voltar", "sair", "opcoes", "opções", "0"]; // Adicionado 0

        if (isPaused) {
            if (unpauseKeywords.includes(userMessageLower)) {
                pausedChats[sessionId] = sessionPausedChats.filter(id => id !== userNumber);
                logger.log(`[${sessionId}] Chat ${userNumber} foi REATIVADO pelo usuário.`);
                 // Importante: NÃO dar return aqui, deixa processar o comando (ex: menu)
            } else {
                logger.log(`[${sessionId}] Chat ${userNumber} está pausado. Ignorando mensagem: "${message.body}"`);
                return; // Ignora se estiver pausado e não for comando de reativar
            }
        }
        
        if (message.body.toLowerCase() === "/status") {
            logger.log(`[${sessionId}] Comando de status recebido de ${userNumber}. Respondendo OK.`);
            const statusMessage = `Bot Conectado!\n\n- *Dispositivo:* ${sessionId}\n- *Status WhatsApp:* OK\n- *Servidor:* OK\n- *Gemini AI:* ${genAI ? "OK" : "ERRO"}`;
            await client.sendMessage(userNumber, statusMessage);
            broadcastEvent({ type: "new_message", sessionId, from: userNumber, body: message.body, timestamp: new Date().toISOString() });
            broadcastEvent({ type: "new_message", sessionId, from: "SYSTEM", to: userNumber, body: statusMessage, timestamp: new Date().toISOString() });
            return;
        }
        
        // =========================================================================
        // INÍCIO DA ALTERAÇÃO: Lógica para processar a resposta do motor de regras (com imagem)
        // =========================================================================
        const ruleResult = runRuleBasedEngine(message, sessionId);
        if (ruleResult.handled) {
            broadcastEvent({ type: "new_message", sessionId, from: userNumber, body: message.body, timestamp: new Date().toISOString() });

            // Nova lógica para enviar imagem, se existir
            if (ruleResult.image_url) {
                try {
                    // 1. Baixa a mídia da URL
                    const media = await MessageMedia.fromUrl(ruleResult.image_url, { unsafeMime: true }); // unsafeMime pode ajudar com alguns links
                    // 2. Envia a mídia com o texto de 'reply' como legenda (caption)
                    await client.sendMessage(userNumber, media, { caption: ruleResult.reply });
                    logger.log(`[${sessionId}] Resposta com imagem enviada para ${userNumber}.`);
                    broadcastEvent({ type: "new_message", sessionId, from: "BOT", to: userNumber, body: `[Imagem] ${ruleResult.reply}`, timestamp: new Date().toISOString() }); // Log com indicador de imagem

                } catch (imgError) {
                    // Se falhar o download (link quebrado, etc), envia só o texto
                    logger.error(`[${sessionId}] Falha ao baixar/enviar imagem de ${ruleResult.image_url}. Enviando só texto.`, imgError);
                    await message.reply(ruleResult.reply);
                    broadcastEvent({ type: "new_message", sessionId, from: "BOT", to: userNumber, body: ruleResult.reply, timestamp: new Date().toISOString() }); // Log normal
                }
            } else {
                // Se não tem image_url, envia só o texto (como era antes)
                await message.reply(ruleResult.reply);
                broadcastEvent({ type: "new_message", sessionId, from: "BOT", to: userNumber, body: ruleResult.reply, timestamp: new Date().toISOString() }); // Log normal
            }
            // Fim da nova lógica de imagem

            // Lógica de pausa (continua a mesma)
            if (ruleResult.shouldPause) {
                if (!pausedChats[sessionId].includes(userNumber)) {
                    pausedChats[sessionId].push(userNumber);
                    logger.log(`[${sessionId}] Chat ${userNumber} foi PAUSADO pela regra.`);
                }
            }
            return; // Encerra o processamento da mensagem aqui
        }
        // =========================================================================
        // FIM DA ALTERAÇÃO
        // =========================================================================

        // --- Fallback para Gemini AI ---
        // (Este bloco só executa se NENHUMA regra JSON foi encontrada acima)
        broadcastEvent({ type: "new_message", sessionId, from: userNumber, body: message.body, timestamp: new Date().toISOString() });
        logger.log(`[${sessionId}] Nenhuma regra encontrada, usando Gemini para: ${message.body}`);
        
        try {
            if (!genAI) throw new Error("API do Gemini não inicializada.");
            let knowledge = "";
            const logicDir = path.join("uploads", sessionId);
            if (fs.existsSync(logicDir)) {
                fs.readdirSync(logicDir).forEach(file => {
                    if (path.extname(file) === ".txt") knowledge += fs.readFileSync(path.join(logicDir, file), "utf8") + "\n\n";
                });
            }
            
            let systemInstruction;
            
            if (knowledge.trim() === "") {
                systemInstruction = `Você é a "Arcade Master", uma IA especialista em tudo relacionado a fliperamas, arcades e controles. Sua personalidade é amigável, prestativa e entusiasta. Converse com os usuários sobre este universo, explicando sobre peças, sistemas, jogos e história. Responda em português do Brasil.`;
            } else {
                systemInstruction = `Você é a "Arcade Master", uma IA especialista em fliperamas e assistente da empresa "Fight Arcade". Sua personalidade é amigável e prestativa.

                Suas regras de resposta são:
                1.  **PRIORIDADE MÁXIMA:** Para perguntas sobre preços, garantia, frete e modelos específicos da Fight Arcade, você DEVE usar APENAS a informação da "BASE DE CONHECIMENTO DA EMPRESA" fornecida abaixo. Esta é sua fonte de verdade absoluta para dados da empresa.
                2.  **CONHECIMENTO GERAL:** Se a pergunta for sobre o universo arcade em geral (peças como Sanwa, sistemas como Pandory, história dos jogos, etc.) e a resposta NÃO estiver na base de conhecimento da empresa, você TEM PERMISSÃO para usar seu conhecimento geral de especialista para dar uma resposta completa e informativa.
                3.  **CONVERSA CASUAL:** Cumprimente os usuários de volta e mantenha uma conversa amigável.
                4.  **FORA DO TÓPICO:** Se a pergunta não tiver relação nenhuma com arcades ou com a Fight Arcade, responda educadamente que você só pode ajudar com esses assuntos.

                --- BASE DE CONHECIMENTO DA EMPRESA ---
                ${knowledge}
                --- FIM DA BASE DE CONHECIMENTO ---`;
            }

            const model = genAI.getGenerativeModel({ model: "gemini-pro-latest" });
            const initialHistory = [
                { role: "user", parts: [{ text: systemInstruction }] },
                { role: "model", parts: [{ text: "Ok, entendi minhas instruções. Estou pronta para ajudar como a Arcade Master!" }] }
            ];
            const chat = model.startChat({ history: initialHistory });
            const result = await chat.sendMessage(message.body);
            const textResponse = result.response.text();

            await client.sendMessage(userNumber, textResponse);
            broadcastEvent({ type: "new_message", sessionId, from: "BOT", to: userNumber, body: textResponse, timestamp: new Date().toISOString() });
        } catch (error) {
            logger.error(`[${sessionId}] Erro ao processar com Gemini:`, error);
            broadcastEvent({ type: "error", sessionId, message: error.message });
            // Adiciona uma resposta padrão de erro da IA para o usuário
             try {
                 await message.reply("🤖 Desculpe, não consegui processar sua pergunta com a IA no momento. Tente novamente mais tarde ou use as opções do menu.");
             } catch (replyError) {
                 logger.error(`[${sessionId}] Erro ao enviar mensagem de fallback da IA:`, replyError);
             }
        }
    });

    client.initialize().catch(err => {
        logger.error(`[${sessionId}] Erro ao inicializar:`, err);
        broadcastEvent({ type: "status_update", sessionId, status: "ERROR" });
    });
}

async function destroySession(sessionId) {
    if (sessions[sessionId]) {
        logger.log(`[WhatsappManager] Destruindo sessão: ${sessionId}`);
        sessions[sessionId].status = "DESTROYING";
        await sessions[sessionId].client.destroy();
        delete sessions[sessionId];
        delete pausedChats[sessionId]; // Limpa chats pausados ao destruir
        broadcastEvent({ type: "session_destroyed", sessionId });
        return true;
    }
    return false;
}

async function checkGeminiHealth() {
    if (!genAI) return { status: "ERROR", message: "Chave da API não configurada ou inválida." };
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro-latest" });
        await model.countTokens("ok");
        return { status: "OPERATIONAL" };
    } catch (error) {
        logger.error("Falha no Health Check do Gemini:", error);
        return { status: "ERROR", message: error.message };
    }
}

async function sendMessage(sessionId, number, text) {
    const client = sessions[sessionId]?.client;
    if (client && (await client.getState()) === "CONNECTED") {
        const chatId = `${number.replace(/\D/g, "")}@c.us`;
        await client.sendMessage(chatId, text);
        broadcastEvent({ type: "new_message", sessionId, from: "ADMIN", to: chatId, body: text, timestamp: new Date().toISOString() });
        return true;
    }
    return false;
}

const getSessionStatus = (sessionId) => sessions[sessionId]?.status || "OFFLINE";
const getQRCode = (sessionId) => sessions[sessionId]?.qrCode || null;
const getAllSessions = () => {
    const savedDevices = require("../services/db").getDevices(); // Assumindo que db.js existe
    const activeDeviceIds = Object.keys(sessions);
    const allDeviceIds = [...new Set([...savedDevices, ...activeDeviceIds])];

    return allDeviceIds.map(id => ({
        id: id,
        status: sessions[id]?.status || "OFFLINE"
    }));
};

module.exports = { setWss, createSession, getSessionStatus, getQRCode, getAllSessions, destroySession, sendMessage, checkGeminiHealth }; // Corrigido erro de digitação aqui também se houver