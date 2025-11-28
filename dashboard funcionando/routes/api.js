// routes/api.js
const express = require("express");
const router = express.Router();
const whatsappManager = require("../services/whatsappManager");
const db = require("../services/db");
const { logger } = require("../services/logger");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join("uploads", req.params.sessionId);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => { cb(null, file.originalname); }
});
const upload = multer({ storage });

router.post("/login", (req, res) => {
    const { username, password } = req.body;
    if (username === "admin" && password === "suporte@1") {
        logger.log(`Login bem-sucedido para usuário: ${username}`);
        res.status(200).json({ success: true });
    } else {
        logger.warn(`Tentativa de login falhou para usuário: ${username}`);
        res.status(401).json({ success: false, message: "Credenciais inválidas" });
    }
});

router.get("/health/gemini", async (req, res) => {
    const health = await whatsappManager.checkGeminiHealth();
    res.status(200).json(health);
});

router.get("/sessions", (req, res) => res.status(200).json(whatsappManager.getAllSessions()));
router.post("/sessions", (req, res) => {
    const { sessionId } = req.body;
    db.addDevice(sessionId);
    whatsappManager.createSession(sessionId);
    res.status(201).json({ message: `Sessão "${sessionId}" iniciada.` });
});
router.delete("/sessions/:sessionId", async (req, res) => {
    const { sessionId } = req.params;
    db.removeDevice(sessionId);
    const result = await whatsappManager.destroySession(sessionId);
    res.status(result ? 200 : 404).json({ message: result ? "Sessão removida." : "Sessão não encontrada." });
});
router.post("/sessions/:sessionId/restart", async (req, res) => {
    const { sessionId } = req.params;
    await whatsappManager.destroySession(sessionId);
    whatsappManager.createSession(sessionId);
    res.status(201).json({ message: `Sessão "${sessionId}" reiniciada.` });
});
router.get("/sessions/:sessionId/status", (req, res) => res.status(200).json({ status: whatsappManager.getSessionStatus(req.params.sessionId) }));
router.get("/sessions/:sessionId/qr", (req, res) => {
    const qrCodeUrl = whatsappManager.getQRCode(req.params.sessionId);
    res.status(qrCodeUrl ? 200 : 404).json({ qrCodeUrl });
});

router.post("/sessions/:sessionId/send", async (req, res) => {
    const { number, text } = req.body;
    const result = await whatsappManager.sendMessage(req.params.sessionId, number, text);
    res.status(result ? 200 : 404).json({ message: result ? "Mensagem enviada." : "Falha ao enviar." });
});

router.get("/sessions/:sessionId/logics", (req, res) => {
    const dir = path.join("uploads", req.params.sessionId);
    if (!fs.existsSync(dir)) return res.json([]);
    res.json(fs.readdirSync(dir));
});
router.post("/sessions/:sessionId/logics/text", (req, res) => {
    const { fileName, content } = req.body;
    const dir = path.join("uploads", req.params.sessionId);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, fileName), content, "utf8");
    logger.log(`Lógica em texto "${fileName}" salva para a sessão "${req.params.sessionId}"`);
    res.status(201).send("Lógica salva.");
});
router.delete("/sessions/:sessionId/logics/:fileName", (req, res) => {
    const filePath = path.join("uploads", req.params.sessionId, req.params.fileName);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.log(`Arquivo de lógica "${req.params.fileName}" deletado da sessão "${req.params.sessionId}"`);
        res.status(200).json({ message: "Arquivo deletado." });
    }
});

module.exports = router;
