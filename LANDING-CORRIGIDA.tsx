// Arquivo: client/src/pages/landing.tsx
// SUBSTITUIR O ARQUIVO EXISTENTE POR ESTE

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, MessageSquare, Smartphone, Zap, Bot } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center space-y-6 max-w-3xl mx-auto mb-16">
          <h1 className="text-4xl md:text-6xl font-bold" data-testid="text-hero-title">
            ChatBot Host v2.5
          </h1>
          <p className="text-xl text-muted-foreground" data-testid="text-hero-subtitle">
            Dashboard de Gerenciamento de Chatbot WhatsApp com IA
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button size="lg" asChild data-testid="button-start-trial">
              <a href="/register">
                Começar Agora
              </a>
            </Button>
            <Button size="lg" variant="outline" asChild data-testid="button-plans">
              <a href="#plans">
                Ver Planos
              </a>
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card>
            <CardHeader>
              <MessageSquare className="w-10 h-10 text-primary mb-2" />
              <CardTitle>Chat em Tempo Real</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Gerencie todas as conversas do WhatsApp em uma interface moderna e intuitiva
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Smartphone className="w-10 h-10 text-primary mb-2" />
              <CardTitle>Múltiplos Dispositivos</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Conecte vários números WhatsApp com QR Code de forma simples e rápida
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Bot className="w-10 h-10 text-primary mb-2" />
              <CardTitle>IA Gemini</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Chatbot inteligente com respostas automáticas personalizadas por IA
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Zap className="w-10 h-10 text-primary mb-2" />
              <CardTitle>Lógicas JSON</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Crie e edite comportamentos do bot com editor visual de lógicas JSON
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Pricing Section */}
        <div id="plans" className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">Escolha seu Plano</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {/* Free Plan */}
            <Card>
              <CardHeader>
                <CardTitle>Free Trial</CardTitle>
                <div className="text-3xl font-bold">Grátis</div>
                <CardDescription>30 dias de acesso</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary" />
                    <span className="text-sm">1 sessão/dispositivo WhatsApp</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary" />
                    <span className="text-sm">Lógicas JSON estáticas</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary" />
                    <span className="text-sm">Editor de lógicas JSON</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary" />
                    <span className="text-sm">Suporte por email</span>
                  </li>
                </ul>
                <Button className="w-full" variant="outline" asChild data-testid="button-free-trial">
                  <a href="/register">Começar Trial</a>
                </Button>
              </CardContent>
            </Card>

            {/* Basic Plan */}
            <Card className="border-2 border-primary">
              <CardHeader>
                <CardTitle>Básico</CardTitle>
                <div className="text-3xl font-bold">R$ 29,90<span className="text-base font-normal">/mês</span></div>
                <CardDescription>Bot estático profissional</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary" />
                    <span className="text-sm">1 sessão/dispositivo WhatsApp</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary" />
                    <span className="text-sm">Lógicas JSON estáticas</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary" />
                    <span className="text-sm">Editor de lógicas JSON completo</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary" />
                    <span className="text-sm">Upload de JSON customizado</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary" />
                    <span className="text-sm">Templates prontos</span>
                  </li>
                </ul>
                <Button className="w-full" asChild data-testid="button-basic-plan">
                  <a href="/login">Assinar Agora</a>
                </Button>
              </CardContent>
            </Card>

            {/* Full Plan */}
            <Card>
              <CardHeader>
                <CardTitle>Full</CardTitle>
                <div className="text-3xl font-bold">R$ 99,90<span className="text-base font-normal">/mês</span></div>
                <CardDescription>Bot inteligente com IA</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary" />
                    <span className="text-sm">3 sessões/dispositivos WhatsApp</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary" />
                    <span className="text-sm">Lógicas JSON + IA Gemini</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary" />
                    <span className="text-sm">Bot inteligente que aprende</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary" />
                    <span className="text-sm">Respostas IA personalizadas</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary" />
                    <span className="text-sm">Gerador automático de lógicas</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary" />
                    <span className="text-sm">Suporte prioritário 24/7</span>
                  </li>
                </ul>
                <Button className="w-full" variant="default" asChild data-testid="button-full-plan">
                  <a href="/login">Assinar Full</a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2025 ChatBot Host. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
