import { useQuery } from "@tanstack/react-query";
import { Check, Crown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@shared/schema";

export default function Billing() {
  const { user } = useAuth();
  const { toast } = useToast();

  const plans = [
    {
      id: 'free',
      name: 'Free Trial',
      price: 'Grátis',
      period: '1 mês',
      description: 'Experimente todas as funcionalidades',
      features: [
        'Todas as funcionalidades por 1 mês',
        '1 dispositivo WhatsApp',
        'Editor de lógicas JSON',
        'IA Gemini básica',
        'Chat em tempo real',
        'Templates prontos',
      ],
      recommended: false,
    },
    {
      id: 'basic',
      name: 'Básico',
      price: 'R$ 29,90',
      period: 'por mês',
      description: 'Para pequenos negócios',
      features: [
        '2 dispositivos WhatsApp',
        'Editor de lógicas JSON completo',
        'Upload de JSON customizado',
        'Templates prontos',
        'Chat em tempo real',
        'Base de conhecimento',
        'Suporte por email',
      ],
      recommended: true,
    },
    {
      id: 'full',
      name: 'Full',
      price: 'R$ 99,00',
      period: 'por mês',
      description: 'Recursos ilimitados',
      features: [
        'Dispositivos WhatsApp ilimitados',
        'Lógicas JSON avançadas',
        'IA Gemini completa',
        'Comportamentos IA personalizados',
        'Gerador automático de lógicas',
        'Análise de sentimento',
        'Webhooks e integrações',
        'Suporte prioritário 24/7',
      ],
      recommended: false,
    },
  ];

  const handleSubscribe = async (planId: string) => {
    if (!user) {
      window.location.href = '/api/login';
      return;
    }

    if (planId === 'free') {
      toast({
        title: "Plano Free",
        description: "Você já está no trial gratuito",
      });
      return;
    }

    if (planId === user.currentPlan) {
      toast({
        title: "Plano Atual",
        description: "Você já está neste plano",
      });
      return;
    }

    // Redirect to Stripe checkout
    toast({
      title: "Redirecionando",
      description: "Você será redirecionado para o pagamento seguro...",
    });

    try {
      // Call backend to create checkout session
      const response = await fetch(`/api/create-checkout-session?plan=${planId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast({
        title: "Erro",
        description: "Não foi possível processar o pagamento. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const getPlanExpiryText = () => {
    if (!user || !user.planExpiresAt) return null;
    const expiryDate = new Date(user.planExpiresAt);
    const now = new Date();
    const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysLeft <= 0) {
      return <Badge variant="destructive">Plano expirado</Badge>;
    } else if (daysLeft <= 7) {
      return <Badge variant="secondary">Expira em {daysLeft} dias</Badge>;
    }
    return <Badge variant="outline">Expira em {expiryDate.toLocaleDateString('pt-BR')}</Badge>;
  };

  return (
    <div className="p-6 md:p-8 space-y-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">Planos e Assinatura</h1>
          <p className="text-muted-foreground">
            Escolha o plano ideal para o seu negócio
          </p>
          {user && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <p className="text-sm">Plano atual:</p>
              <Badge variant="default" data-testid="badge-current-plan">
                {plans.find(p => p.id === user.currentPlan)?.name || 'Free'}
              </Badge>
              {getPlanExpiryText()}
            </div>
          )}
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {plans.map((plan) => {
            const isCurrentPlan = user?.currentPlan === plan.id;
            return (
              <Card
                key={plan.id}
                className={`relative ${plan.recommended ? 'border-2 border-primary' : ''}`}
                data-testid={`plan-card-${plan.id}`}
              >
                {plan.recommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="px-3 py-1">
                      <Crown className="w-3 h-3 mr-1" />
                      Recomendado
                    </Badge>
                  </div>
                )}

                <CardHeader>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="pt-4">
                    <div className="text-4xl font-bold">
                      {plan.price}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{plan.period}</p>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full"
                    variant={isCurrentPlan ? "outline" : plan.recommended ? "default" : "outline"}
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={isCurrentPlan}
                    data-testid={`button-subscribe-${plan.id}`}
                  >
                    {isCurrentPlan ? "Plano Atual" : "Assinar Agora"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Payment History */}
        {user?.stripeCustomerId && (
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Pagamentos</CardTitle>
              <CardDescription>Suas transações recentes</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma transação ainda
              </p>
            </CardContent>
          </Card>
        )}

        {/* FAQ */}
        <Card>
          <CardHeader>
            <CardTitle>Perguntas Frequentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="font-medium mb-1">Posso cancelar a qualquer momento?</p>
              <p className="text-sm text-muted-foreground">
                Sim, você pode cancelar sua assinatura a qualquer momento sem taxas adicionais.
              </p>
            </div>
            <div>
              <p className="font-medium mb-1">O que acontece após o trial?</p>
              <p className="text-sm text-muted-foreground">
                Após 30 dias, você pode escolher um dos planos pagos para continuar usando a plataforma.
              </p>
            </div>
            <div>
              <p className="font-medium mb-1">Posso fazer upgrade/downgrade?</p>
              <p className="text-sm text-muted-foreground">
                Sim, você pode alterar seu plano a qualquer momento. A diferença será calculada proporcionalmente.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
