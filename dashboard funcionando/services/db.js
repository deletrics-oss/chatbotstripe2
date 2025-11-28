// services/db.js
const fs = require("fs");
const path = require("path");
const { logger } = require("./logger");
const DB_PATH = path.join(__dirname, "..", "db", "database.json");

const db = {
    read: () => {
        try {
            if (!fs.existsSync(DB_PATH)) {
                fs.writeFileSync(DB_PATH, JSON.stringify({ devices: [] }, null, 2), "utf8");
            }
            const data = fs.readFileSync(DB_PATH, "utf8");
            return JSON.parse(data);
        } catch (error) {
            logger.error("Erro ao ler o banco de dados, retornando estado vazio.", error);
            return { devices: [] };
        }
    },
    write: (data) => {
        try {
            fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf8");
        } catch (error) {
            logger.error("Erro ao escrever no banco de dados.", error);
        }
    },
    addDevice: (sessionId) => {
        const data = db.read();
        if (!data.devices.includes(sessionId)) {
            data.devices.push(sessionId);
            db.write(data);
            logger.log(`Dispositivo "${sessionId}" adicionado ao banco de dados.`);
        }
    },
    removeDevice: (sessionId) => {
        const data = db.read();
        const index = data.devices.indexOf(sessionId);
        if (index > -1) {
            data.devices.splice(index, 1);
            db.write(data);
            logger.log(`Dispositivo "${sessionId}" removido do banco de dados.`);
        }
    },
    getDevices: () => {
        return db.read().devices;
    }
};

module.exports = db;
