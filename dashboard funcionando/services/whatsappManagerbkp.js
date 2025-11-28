// services/whatsappManager.js (Versão 2.9 - IA Especialista Flexível)
const { Client, LocalAuth } = require("whatsapp-web.js");
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

function setWss(webSocketServer) { wss = webSocketServer; }

function broadcastEvent(event) {
    if (!wss) return;
    const data = JSON.stringify(event);
    wss.clients.forEach(client => { if (client.readyState === client.OPEN) client.send(data); });
}

// --- MOTOR DE REGRAS (SEM IA) ---
function runRuleBasedEngine(message, sessionId) {
    const logicDir = path.join("uploads", sessionId);
    if (!fs.existsSync(logicDir)) return false;
    const files = fs.readdirSync(logicDir);
    const jsonFile = files.find(f => f.endsWith(".json"));
    if (!jsonFile) return false;

    try {
        const filePath = path.join(logicDir, jsonFile);
        const logicData = JSON.parse(fs.readFileSync(filePath, "utf8"));
        const userMessage = message.body.toLowerCase();

        for (const rule of logicData.rules) {
            const foundKeyword = rule.keywords.find(keyword => userMessage.includes(keyword.toLowerCase()));
            if (foundKeyword) {
                logger.log(`[${sessionId}] Regra encontrada para keyword: "${foundKeyword}". Respondendo.`);
                message.reply(rule.reply);
                return true;
            }
        }
        if (logicData.default_reply) {
            logger.log(`[${sessionId}] Nenhuma regra encontrada. Usando resposta padrão.`);
            message.reply(logicData.default_reply);
            return true;
        }
    } catch (error) {
        logger.error(`[${sessionId}] Erro ao processar arquivo de lógica .json:`, error);
    }
    return false;
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
        
        if (message.body.toLowerCase() === "/status") {
            logger.log(`[${sessionId}] Comando de status recebido de ${userNumber}. Respondendo OK.`);
            const statusMessage = `✅ Bot Conectado!\n\n- *Dispositivo:* ${sessionId}\n- *Status WhatsApp:* OK\n- *Servidor:* OK\n- *Gemini AI:* ${genAI ? "OK" : "ERRO"}`;
            await client.sendMessage(userNumber, statusMessage);
            broadcastEvent({ type: "new_message", sessionId, from: userNumber, body: message.body, timestamp: new Date().toISOString() });
            broadcastEvent({ type: "new_message", sessionId, from: "SYSTEM", to: userNumber, body: statusMessage, timestamp: new Date().toISOString() });
            return;
        }
        
        const ruleEngineHandled = runRuleBasedEngine(message, sessionId);
        if (ruleEngineHandled) {
            broadcastEvent({ type: "new_message", sessionId, from: userNumber, body: message.body, timestamp: new Date().toISOString() });
            return;
        }

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
            
            // --- INÍCIO DA NOVA INSTRUÇÃO DE IA (v2.9) ---
            let systemInstruction;
            
            if (knowledge.trim() === "") {
                // MODO ESPECIALISTA LIVRE (sem base de dados)
                systemInstruction = `Você é a "Arcade Master", uma IA especialista em tudo relacionado a fliperamas, arcades e controles. Sua personalidade é amigável, prestativa e entusiasta. Converse com os usuários sobre este universo, explicando sobre peças, sistemas, jogos e história. Responda em português do Brasil.`;
            } else {
                // MODO ESPECIALISTA DA EMPRESA (com base de dados)
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
            // --- FIM DA NOVA INSTRUÇÃO DE IA ---

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
