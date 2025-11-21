import { Check, Crown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";

export default function Billing() {
  const { user } = useAuth();

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
      ],
      recommended: true,
      badge: 'Disponível em Breve'
    },
    {
      id: 'full',
      name: 'Full',
      price: 'R$ 99,90',
      period: 'por mês',
      description: 'Bot inteligente com IA',
      features: [
        '3 dispositivos WhatsApp',
        'Lógicas JSON + IA Gemini',
        'Bot inteligente que aprende',
        'Respostas IA personalizadas',
        'Gerador automático de lógicas',
        'Webhooks e integrações',
      ],
      recommended: false,
      badge: 'Disponível em Breve'
    },
  ];

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
                
                {plan.badge && (
                  <div className="absolute top-4 right-4">
                    <Badge variant="secondary" className="text-xs">
                      {plan.badge}
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
                    disabled={isCurrentPlan || plan.badge !== undefined}
                    data-testid={`button-subscribe-${plan.id}`}
                  >
                    {isCurrentPlan ? "Plano Atual" : plan.badge || "Assinar Agora"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Sobre os Planos</CardTitle>
            <CardDescription>Como funcionam nossas assinaturas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Free Trial</h4>
              <p className="text-sm text-muted-foreground">
                Experimente todas as funcionalidades gratuitamente por 1 mês. Após expiração, você continua com acesso limitado ao plano Free.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Planos Pagos</h4>
              <p className="text-sm text-muted-foreground">
                Os planos Básico e Full estarão disponíveis em breve. Você receberá uma notificação quando forem ativados.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
