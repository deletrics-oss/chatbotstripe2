import bcrypt from "bcryptjs";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import createMemoryStore from "memorystore";
import { storage } from "./storage";
import { registerUserSchema, loginUserSchema } from "@shared/schema";
import { z } from "zod";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const MemoryStore = createMemoryStore(session);
  const sessionStore = new MemoryStore({
    checkPeriod: sessionTtl,
  });

  // Ensure SESSION_SECRET is set in production
  const sessionSecret = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === 'production' && (!sessionSecret || sessionSecret === "default-secret-change-in-production")) {
    console.error("⚠️  CRITICAL: SESSION_SECRET not set in production! Set a strong random value in .env");
    process.exit(1);
  }

  return session({
    secret: sessionSecret || "default-secret-change-in-production",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  // Register endpoint
  app.post("/api/auth/register", async (req, res) => {
    try {
      // Validate input with Zod
      const validatedData = registerUserSchema.parse(req.body);
      const { username, password, email } = validatedData;

      // Check if user already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Usuário já existe" });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Set default plan expiry for new users (1 month free trial)
      const planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      // Create user
      const user = await storage.createUser({
        username,
        passwordHash,
        email: email || null,
        firstName: null,
        lastName: null,
        currentPlan: 'free',
        planExpiresAt,
      });

      // Set session
      (req.session as any).userId = user.id;

      res.json({ message: "Usuário criado com sucesso", user: { id: user.id, username: user.username, currentPlan: user.currentPlan } });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      console.error("Error registering user:", error);
      res.status(500).json({ message: "Erro ao criar usuário" });
    }
  });

  // Login endpoint
  app.post("/api/auth/login", async (req, res) => {
    try {
      // Validate input with Zod
      const validatedData = loginUserSchema.parse(req.body);
      const { username, password } = validatedData;

      // Find user
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Credenciais inválidas" });
      }

      // Verify password
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ message: "Credenciais inválidas" });
      }

      // Set session
      (req.session as any).userId = user.id;

      res.json({ message: "Login bem-sucedido", user: { id: user.id, username: user.username, currentPlan: user.currentPlan } });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      console.error("Error logging in:", error);
      res.status(500).json({ message: "Erro ao fazer login" });
    }
  });

  // Logout endpoint
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Erro ao fazer logout" });
      }
      res.clearCookie('connect.sid');
      res.json({ message: "Logout bem-sucedido" });
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const userId = (req.session as any)?.userId;

  if (!userId) {
    return res.status(401).json({ message: "Não autenticado" });
  }

  try {
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({ message: "Usuário não encontrado" });
    }

    // Attach user to request
    (req as any).user = { claims: { sub: user.id } };
    next();
  } catch (error) {
    console.error("Error verifying authentication:", error);
    res.status(401).json({ message: "Erro de autenticação" });
  }
};
