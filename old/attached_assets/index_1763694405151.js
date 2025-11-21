// index.js
const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();
const http = require("http");
const { WebSocketServer } = require("ws");
const db = require("./services/db");
const { createSession } = require("./services/whatsappManager");
const { setWss: setWhatsappWss } = require("./services/whatsappManager");
const { setWss: setLoggerWss, logger } = require("./services/logger");

const app = express();
const PORT = process.env.PORT || 3035;

app.use(cors());
app.use(express.json());
app.use("/api", require("./routes/api"));

// Servir o dashboard na rota principal
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

setWhatsappWss(wss);
setLoggerWss(wss);

wss.on("connection", ws => {
    logger.log("🔌 Novo cliente conectado ao WebSocket.");
    ws.on("close", () => logger.log("🔌 Cliente WebSocket desconectado."));
    ws.on("error", err => logger.error("WebSocket Error", err));
});

function initializeBots() {
    logger.log("--- Iniciando Sincronização de Bots ---");
    const devices = db.getDevices();
    if (devices.length > 0) {
        logger.log(`Encontrados ${devices.length} dispositivos para iniciar: ${devices.join(", ")}`);
        devices.forEach(id => createSession(id));
    } else {
        logger.log("Nenhum dispositivo salvo para iniciar.");
    }
    logger.log("--- Sincronização Concluída ---");
}

server.listen(PORT, () => {
    logger.log(`🚀 Servidor HTTP e WebSocket v2.5 rodando na porta ${PORT}`);
    logger.log(`📱 Dashboard disponível em: http://72.60.246.250:${PORT}`);
    initializeBots();
});
