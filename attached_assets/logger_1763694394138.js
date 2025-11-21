// services/logger.js
let wss;
function setWss(webSocketServer) { wss = webSocketServer; }

function broadcast(level, message) {
    if (wss) {
        const data = JSON.stringify({ type: "log", level, message: `[${new Date().toLocaleTimeString()}] ${message}` });
        wss.clients.forEach(c => { if (c.readyState === c.OPEN) c.send(data); });
    }
}
const logger = {
    log: (m) => { console.log(m); broadcast("INFO", m); },
    error: (m, e) => { const msg = e ? `${m} - ${e.message||e}` : m; console.error(msg); broadcast("ERROR", msg); },
    warn: (m) => { console.warn(m); broadcast("WARN", m); }
};
module.exports = { setWss, logger };
