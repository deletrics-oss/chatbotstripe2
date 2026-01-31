import { useState, useEffect } from "react";
import { Check, Crown, Loader2, ExternalLink, Smartphone, CreditCard } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useSearch } from "wouter";

interface Plan {
  id: string;
  name: string;
  price: number;
  priceId: string;
  features: string[];
  recommended?: boolean;
}

interface PlansData {
  plans: Plan[];
  trialDays: number;
  stripeEnabled: boolean;
  pixEnabled: boolean;
  pixKey?: string;
  pixBeneficiary?: string;
  pixBank?: string;
}

interface Subscription {
  planId: string;
  planName: string;
  status: string;
  currentPeriodEnd?: string;
  isTrialing: boolean;
  trialDaysLeft?: number;
}

export default function Billing() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const search = useSearch();
  const [plansData, setPlansData] = useState<PlansData | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Handle success/cancel from Stripe
    const params = new URLSearchParams(search);
    if (params.get('success') === 'true') {
      toast({ title: "Pagamento realizado!", description: "Sua assinatura está ativa." });
    }
    if (params.get('canceled') === 'true') {
      toast({ title: "Pagamento cancelado", variant: "destructive" });
    }
  }, [search, toast]);

  useEffect(() => {
    Promise.all([
      fetch('/api/plans').then(r => r.json()),
      fetch('/api/subscription').then(r => r.json())
    ]).then(([plans, sub]) => {
      setPlansData(plans);
      setSubscription(sub);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSubscribe = async (plan: Plan) => {
    if (!plan.priceId && plan.price > 0) {
      toast({ title: "Plano indisponível", description: "Configure o Stripe Price ID.", variant: "destructive" });
      return;
    }

    if (plan.price === 0) {
      toast({ title: "Você já está no Free Trial", variant: "default" });
      return;
    }

    setLoadingPlan(plan.id);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id, priceId: plan.priceId })
      });
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Erro ao iniciar checkout');
      }
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      setLoadingPlan(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const plans = plansData?.plans || [];

  return (
    <div className="p-6 md:p-8 space-y-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">Planos e Assinatura</h1>
          <p className="text-muted-foreground">Escolha o plano ideal para o seu negócio</p>

          {plansData?.trialDays && (
            <Badge variant="secondary" className="mt-4">
              🎁 {plansData.trialDays} dias de teste grátis
            </Badge>
          )}
        </div>

        {/* Current Subscription */}
        {subscription && subscription.status !== 'none' && (
          <Card className="mb-8 border-green-500/30 bg-green-50 dark:bg-green-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-300">
                <Check className="w-5 h-5" />
                {subscription.isTrialing ? 'Período de Teste' : 'Assinatura Ativa'}
              </CardTitle>
              <CardDescription className="text-green-600 dark:text-green-400">
                Você está no plano <strong>{subscription.planName}</strong>
                {subscription.trialDaysLeft !== undefined && subscription.trialDaysLeft > 0 && (
                  <> • {subscription.trialDaysLeft} dias restantes</>
                )}
                {subscription.currentPeriodEnd && !subscription.isTrialing && (
                  <> • Renova em {new Date(subscription.currentPeriodEnd).toLocaleDateString('pt-BR')}</>
                )}
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Payment Methods Info */}
        <div className="flex justify-center gap-4 text-sm text-muted-foreground mb-8">
          {plansData?.stripeEnabled && (
            <div className="flex items-center gap-1">
              <CreditCard className="w-4 h-4" /> Cartão
            </div>
          )}
          {plansData?.pixEnabled && (
            <div className="flex items-center gap-1">
              <Smartphone className="w-4 h-4" /> PIX
            </div>
          )}
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {plans.map((plan) => {
            const isCurrent = subscription?.planId === plan.id;
            const isLoading = loadingPlan === plan.id;

            return (
              <Card
                key={plan.id}
                className={`relative transition-all hover:scale-105 duration-300 ${isCurrent ? 'border-primary shadow-lg bg-primary/5' :
                    plan.recommended ? 'border-2 border-purple-500/50 shadow-purple-500/20 shadow-xl' : ''
                  }`}
                data-testid={`plan-card-${plan.id}`}
              >
                {plan.recommended && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1">
                      <Crown className="w-3 h-3 mr-1" />
                      RECOMENDADO
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                  <CardDescription>
                    <span className="text-3xl font-bold text-foreground">
                      {plan.price === 0 ? 'Grátis' : `R$ ${plan.price.toFixed(2).replace('.', ',')}`}
                    </span>
                    {plan.price > 0 && <span className="text-sm">/mês</span>}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 pt-4">
                  <ul className="space-y-3">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className={`p-1 rounded-full ${plan.recommended ? 'bg-purple-100 text-purple-600' : 'bg-primary/10 text-primary'}`}>
                          <Check className="w-3 h-3" />
                        </div>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter>
                  <Button
                    className={`w-full ${plan.recommended ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700' : ''}`}
                    variant={isCurrent ? "outline" : "default"}
                    onClick={() => !isCurrent && !isLoading && handleSubscribe(plan)}
                    disabled={isCurrent || isLoading || (plan.price > 0 && !plan.priceId && plansData?.stripeEnabled)}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Redirecionando...
                      </>
                    ) : isCurrent ? (
                      "Plano Atual"
                    ) : plan.price === 0 ? (
                      "Plano Atual"
                    ) : !plan.priceId && plansData?.stripeEnabled ? (
                      "Em breve"
                    ) : (
                      <>
                        Assinar Agora
                        <ExternalLink className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* PIX Info */}
        {plansData?.pixEnabled && plansData.pixKey && (
          <Card className="max-w-lg mx-auto border-green-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-300">
                <Smartphone className="w-5 h-5" />
                Pagamento via PIX
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><strong>Chave:</strong> {plansData.pixKey}</p>
              {plansData.pixBeneficiary && <p><strong>Beneficiário:</strong> {plansData.pixBeneficiary}</p>}
              {plansData.pixBank && <p><strong>Banco:</strong> {plansData.pixBank}</p>}
              <p className="text-muted-foreground text-xs mt-2">
                Após o pagamento, envie o comprovante para ativação.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="text-center text-sm text-muted-foreground mt-8">
          <p>Pagamentos processados de forma segura.</p>
          <p>Cancele a qualquer momento.</p>
        </div>
      </div>
    </div>
  );
}
