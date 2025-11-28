// services/whatsappManager.js (Versão 3.4 - Verificada e 100% Limpa)
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
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
const pausedChats = {}; 

function setWss(webSocketServer) { wss = webSocketServer; }

function broadcastEvent(event) {
    if (!wss) return;
    const data = JSON.stringify(event);
    wss.clients.forEach(client => { if (client.readyState === client.OPEN) client.send(data); });
}

// --- MOTOR DE REGRAS (SEM IA) ---
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
                    image_url: rule.image_url || null
                };
            }
        }
        if (logicData.default_reply) {
            logger.log(`[${sessionId}] Nenhuma regra encontrada. Usando resposta padrão.`);
            return { handled: true, reply: logicData.default_reply, shouldPause: false, image_url: null };
        }
    } catch (error) {
        logger.error(`[${sessionId}] Erro ao processar arquivo de lógica .json:`, error);
    }
    return { handled: false };
}

function createSession(sessionId) {
    logger.log(`[WhatsappManager] Criando ou reconectando sessão: ${sessionId}`);
    const client = new Client({
        authStrategy: new LocalAuth({ clientId: sessionId }),
        puppeteer: {
            args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-accelerated-2d-canvas", "--no-first-run", "--no-zygote", "--disable-gpu"]
        }
    });
    sessions[sessionId] = { client, status: "INITIALIZING", qrCode: null };
    pausedChats[sessionId] = [];

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

        // --- INÍCIO DA CORREÇÃO ANTI-LOOP ---
        if (message.fromMe) {
            logger.log(`[${sessionId}] Mensagem própria ignorada (fromMe).`);
            return; 
        }
        const otherBotJids = [];
        for (const sId in sessions) {
            if (sId !== sessionId && sessions[sId].status === "READY" && sessions[sId].client.info) {
                otherBotJids.push(sessions[sId].client.info.wid._serialized); 
            }
        }
        if (otherBotJids.includes(message.from)) {
            logger.log(`[${sessionId}] [Anti-Loop] Mensagem do bot ${message.from} ignorada.`);
            return;
        }
        // --- FIM DA CORREÇÃO ANTI-LOOP ---

        // --- LÓGICA DE PAUSA ---
        const sessionPausedChats = pausedChats[sessionId] || [];
        const isPaused = sessionPausedChats.includes(userNumber);
        const userMessageLower = message.body.toLowerCase().trim();
        const unpauseKeywords = ["menu", "ajuda", "inicio", "início", "start", "voltar", "sair", "opcoes", "opções"];

        if (isPaused) {
            if (unpauseKeywords.includes(userMessageLower)) {
                pausedChats[sessionId] = sessionPausedChats.filter(id => id !== userNumber);
                logger.log(`[${sessionId}] Chat ${userNumber} foi REATIVADO pelo usuário.`);
            } else {
                logger.log(`[${sessionId}] Chat ${userNumber} está pausado. Ignorando mensagem: "${message.body}"`);
                return;
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

        // --- IA (Gemini) opcional com comando /ia ---
        if (userMessageLower.startsWith("/ia")) {
            const userPrompt = userMessageLower.substring(4).trim(); // Pega o texto depois de "/ia "
            if (userPrompt.length < 5) {
                await message.reply("?? Por favor, escreva sua pergunta para a IA depois do comando */ia*.\n\nExemplo: */ia qual a melhor placa para jogos de luta?*");
                return;
            }

            broadcastEvent({ type: "new_message", sessionId, from: userNumber, body: message.body, timestamp: new Date().toISOString() });
            logger.log(`[${sessionId}] Comando /ia recebido, usando Gemini para: ${userPrompt}`);
            
            try {
                if (!genAI) throw new Error("API do Gemini não inicializada.");
                
                const logicDir = path.join("uploads", sessionId);
                
                // 1. Carrega a Personalidade da IA (ia-prompt.txt) - OBRIGATÓRIO
                let systemInstruction = "";
                const personaPath = path.join(logicDir, "ia-prompt.txt");
                if (fs.existsSync(personaPath)) {
                    systemInstruction = fs.readFileSync(personaPath, "utf8");
                } else {
                    // Se não tem prompt, a IA não pode funcionar
                    logger.warn(`[${sessionId}] Comando /ia recebido, mas 'ia-prompt.txt' não foi encontrado.`);
                    await message.reply(`?? Desculpe, a Inteligência Artificial não está configurada para este dispositivo.`);
                    return;
                }

                // 2. Carrega a Base de Conhecimento (knowledge.txt) - OPCIONAL
                let knowledge = "";
                const knowledgePath = path.join(logicDir, "knowledge.txt");
                if (fs.existsSync(knowledgePath)) {
                    knowledge = fs.readFileSync(knowledgePath, "utf8");
                }

                // 3. Substitui o placeholder {{KNOWLEDGE_BASE}} no prompt pelo conteúdo do knowledge.txt
                systemInstruction = systemInstruction.replace("{{KNOWLEDGE_BASE}}", knowledge);
                // --- FIM DA LÓGICA DE CARREGAMENTO DINÂMICO ---

                const model = genAI.getGenerativeModel({ model: "gemini-pro-latest" });
                const initialHistory = [
                    { role: "user", parts: [{ text: systemInstruction }] },
                    { role: "model", parts: [{ text: "Ok, entendi minhas instruções. Estou pronto para ajudar!" }] } // Resposta genérica
                ];
                const chat = model.startChat({ history: initialHistory });
                const result = await chat.sendMessage(userPrompt); // Envia só o prompt do usuário
                const textResponse = result.response.text();

                await client.sendMessage(userNumber, textResponse);
                broadcastEvent({ type: "new_message", sessionId, from: "BOT", to: userNumber, body: textResponse, timestamp: new Date().toISOString() });
            } catch (error) {
                logger.error(`[${sessionId}] Erro ao processar com Gemini:`, error);
                broadcastEvent({ type: "error", sessionId, message: error.message });
            }
            return; // Encerra o processamento da mensagem aqui
        }
        
        // --- LÓGICA DO MOTOR DE REGRAS (JSON) ---
        const ruleResult = runRuleBasedEngine(message, sessionId);
        if (ruleResult.handled) {
            broadcastEvent({ type: "new_message", sessionId, from: userNumber, body: message.body, timestamp: new Date().toISOString() });

            // Nova lógica para enviar imagem, se existir
            if (ruleResult.image_url) {
                try {
                    const media = await MessageMedia.fromUrl(ruleResult.image_url);
                    await client.sendMessage(userNumber, media, { caption: ruleResult.reply });
                    logger.log(`[${sessionId}] Resposta com imagem enviada para ${userNumber}.`);
                } catch (imgError) {
                    logger.error(`[${sessionId}] Falha ao baixar imagem de ${ruleResult.image_url}. Enviando só texto.`, imgError);
                    await message.reply(ruleResult.reply);
                }
            } else {
                // Se não tem image_url, envia só o texto
                await message.reply(ruleResult.reply);
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
        
        // Se chegou até aqui, nenhuma regra foi encontrada E não era um comando /ia.
        logger.log(`[${sessionId}] Nenhuma regra JSON ou comando /ia encontrado para: "${message.body}". Mensagem ignorada.`);
        broadcastEvent({ type: "new_message", sessionId, from: userNumber, body: message.body, timestamp: new Date().toISOString() });
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
        delete pausedChats[sessionId];
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
    const savedDevices = require("../services/db").getDevices();
    const activeDeviceIds = Object.keys(sessions);
    const allDeviceIds = [...new Set([...savedDevices, ...activeDeviceIds])];

    return allDeviceIds.map(id => ({
        id: id,
        status: sessions[id]?.status || "OFFLINE"
    }));
};

module.exports = { setWss, createSession, getSessionStatus, getQRCode, getAllSessions, destroySession, sendMessage, checkGeminiHealth };