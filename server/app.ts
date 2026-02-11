import { type Server } from "node:http";

import express, {
  type Express,
  type Request,
  Response,
  NextFunction,
} from "express";

import { registerRoutes } from "./routes";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  limit: '50mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

export default async function runApp(
  setup: (app: Express, server: Server) => Promise<void>,
) {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
  });

  // importantly run the final setup after setting up all the other routes so
  // the catch-all route doesn't interfere with the other routes
  await setup(app, server);

  // Serve the app on the port specified in the environment variable PORT
  // Priority: process.env.PORT > 3025
  const port = parseInt(process.env.PORT || '3025', 10);

  log(`Tentando iniciar servidor na porta ${port}...`, "express");

  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`Servidor rodando com sucesso na porta ${port}`, "express");

    // Restore WhatsApp sessions only after server is ready
    log("Iniciando restauração de sessões do WhatsApp...", "whatsapp");
    import("./whatsappManager").then(({ restoreWhatsAppSessions }) => {
      restoreWhatsAppSessions()
        .then(() => log("Restauração de sessões do WhatsApp concluída", "whatsapp"))
        .catch(err => log(`Erro na restauração de sessões: ${err}`, "whatsapp"));
    });
  });

  // Handle server errors (like EADDRINUSE)
  server.on('error', (error: any) => {
    if (error.code === 'EADDRINUSE') {
      log(`ERRO CRÍTICO: A porta ${port} já está em uso!`, "express");
      log(`Verifique se há outro processo PM2 rodando ou use: fuser -k ${port}/tcp`, "express");
    } else {
      log(`Erro no servidor: ${error.message}`, "express");
    }
  });

  // Global Safety Nets to prevent crash loops on VPS
  process.on('uncaughtException', (err) => {
    log(`🛡️ SAFETY NET: Uncaught Exception: ${err.message}`, "error");
    console.error(err.stack);
  });

  process.on('unhandledRejection', (reason, promise) => {
    log(`CRITICAL: Unhandled Rejection at: ${promise} reason: ${reason}`, "error");
    // In production, we keep the process alive
  });
}
