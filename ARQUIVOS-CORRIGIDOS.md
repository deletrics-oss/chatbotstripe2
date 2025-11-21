# 📦 Arquivos Corrigidos para Copiar no Servidor

## Instruções:

1. Copie cada arquivo abaixo para o local indicado no servidor
2. Substitua o `.env` pelas configurações atualizadas
3. Execute `npm run build && pm2 restart chatbot-whatsapp`

---

## Arquivo 1: `.env` (SUBSTITUIR COMPLETAMENTE)

**Local:** `/root/chatbotstripe2/.env`

```env
# Server Configuration
PORT=3035
NODE_ENV=production

# Database Configuration (PostgreSQL)
DATABASE_URL=postgresql://bot:Dan14276642@localhost:5432/chatbot_whatsapp

# Session Secret (strong random string)
SESSION_SECRET=63c311dc6b5cf12f75ffeee11e95501bb3fd3402e090ae3ed5db77e6190836097e8b45464778faa77732c86c7b598ca3171481264ef8a0f0ca62e4bff8900de2

# Stripe Configuration (for payments)
STRIPE_SECRET_KEY=sk_test_51STeJ7Am6vHvVWOZCN8kisKfD8RVj7xNyqkis4pga5zUHqEFS3aT0qOO5Nb0Ok5hdw4O2hETlYMKXsdXuQVyIo6U00jaHymGVx
VITE_STRIPE_PUBLIC_KEY=pk_test_51OaB1y2eZvKYlo2C2X4YCL00l2X4YCL

# Stripe Price IDs (produtos criados no Stripe)
STRIPE_PRICE_BASIC=price_1SVGswAm6vHvVWOZP4gSw9xF
STRIPE_PRICE_FULL=price_1SVGtNAm6vHvVWOZ5QF0FNq2

# Gemini AI Configuration (for AI-powered logic)
GEMINI_API_KEY=AIzaSyCqzRGzEbXLQ4IclSKFDCfeeSS1139NC3k

# Puppeteer Configuration (for WhatsApp)
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

---

## Arquivo 2: `client/src/pages/register.tsx` (CRIAR NOVO)

**Local:** `/root/chatbotstripe2/client/src/pages/register.tsx`

```tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function Register() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, email: email || undefined }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Erro ao criar conta");
      }

      toast({
        title: "Conta criada!",
        description: "Você foi logado automaticamente. Bem-vindo!",
      });

      window.location.href = "/";
    } catch (error: any) {
      toast({
        title: "Erro ao criar conta",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Criar Conta Grátis</CardTitle>
          <CardDescription>
            Comece seu trial de 30 dias com 1 dispositivo WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Usuário *</Label>
              <Input
                id="username"
                type="text"
                placeholder="seu_usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={isLoading}
                data-testid="input-username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha *</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={isLoading}
                data-testid="input-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email (opcional)</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                data-testid="input-email"
              />
              <p className="text-xs text-muted-foreground">
                Necessário apenas para upgrades pagos via Stripe
              </p>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
              data-testid="button-register"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando conta...
                </>
              ) : (
                "Começar Trial Grátis"
              )}
            </Button>

            <div className="text-center text-sm">
              <span className="text-muted-foreground">Já tem uma conta? </span>
              <a href="/login" className="text-primary hover:underline" data-testid="link-login">
                Fazer login
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Arquivo 3: `client/src/pages/login.tsx` (CRIAR NOVO)

**Local:** `/root/chatbotstripe2/client/src/pages/login.tsx`

```tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Erro ao fazer login");
      }

      toast({
        title: "Login bem-sucedido!",
        description: "Bem-vindo de volta!",
      });

      window.location.href = "/";
    } catch (error: any) {
      toast({
        title: "Erro ao fazer login",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>
            Entre com suas credenciais
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Usuário</Label>
              <Input
                id="username"
                type="text"
                placeholder="seu_usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={isLoading}
                data-testid="input-username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                data-testid="input-password"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
              data-testid="button-login"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </Button>

            <div className="text-center text-sm">
              <span className="text-muted-foreground">Não tem uma conta? </span>
              <a href="/register" className="text-primary hover:underline" data-testid="link-register">
                Criar conta grátis
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

Continua no próximo arquivo...
