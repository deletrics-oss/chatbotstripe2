import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
    CreditCard,
    Smartphone,
    Banknote,
    Save,
    Loader2,
    Info,
    ShieldCheck
} from "lucide-react";

interface BillingConfig {
    billingMode: 'manual' | 'automatic';
    stripeEnabled: boolean;
    stripePublicKey: string;
    stripeSecretKey: string;
    stripeWebhookSecret: string;
    nupayEnabled: boolean;
    nupayClientId: string;
    nupayClientSecret: string;
    pixEnabled: boolean;
    pixKey: string;
    pixBeneficiary: string;
    pixBank: string;
    basicName: string;
    basicPrice: number;
    basicPriceId: string;
    basicFeatures: string;
    proName: string;
    proPrice: number;
    proPriceId: string;
    proFeatures: string;
    enterpriseName: string;
    enterprisePrice: number;
    enterprisePriceId: string;
    enterpriseFeatures: string;
    trialDays: number;
}

export default function BillingConfigPage() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testingStripe, setTestingStripe] = useState(false);

    const [config, setConfig] = useState<BillingConfig>({
        billingMode: 'manual',
        stripeEnabled: false,
        stripePublicKey: '',
        stripeSecretKey: '',
        stripeWebhookSecret: '',
        nupayEnabled: false,
        nupayClientId: '',
        nupayClientSecret: '',
        pixEnabled: true,
        pixKey: '',
        pixBeneficiary: '',
        pixBank: '',
        basicName: 'Básico',
        basicPrice: 29.99,
        basicPriceId: '',
        basicFeatures: 'Até 100 agendamentos/mês\n1 Profissional\nSuporte por email',
        proName: 'Profissional',
        proPrice: 69.99,
        proPriceId: '',
        proFeatures: 'Agendamentos ilimitados\n5 Profissionais\nWhatsApp Bot\nSuporte prioritário',
        enterpriseName: 'Full',
        enterprisePrice: 99.99,
        enterprisePriceId: '',
        enterpriseFeatures: 'Tudo do Pro\nProfissionais ilimitados\nIA Avançada\nSuporte 24/7',
        trialDays: 30
    });

    useEffect(() => {
        fetch('/api/billing/config')
            .then(res => res.json())
            .then(data => {
                if (!data.error) {
                    setConfig(prev => ({ ...prev, ...data }));
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/billing/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            if (res.ok) {
                toast({ title: "Sucesso", description: "Configurações de cobrança salvas." });
            } else {
                throw new Error();
            }
        } catch (error) {
            toast({ title: "Erro", description: "Falha ao salvar configurações.", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const testStripe = async () => {
        setTestingStripe(true);
        try {
            const res = await fetch('/api/billing/test-stripe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ secretKey: config.stripeSecretKey })
            });
            const data = await res.json();
            if (data.success) {
                toast({ title: "Conexão OK", description: `Stripe conectado com sucesso!` });
            } else {
                toast({ title: "Erro na conexão", description: data.error, variant: "destructive" });
            }
        } catch (error) {
            toast({ title: "Erro", description: "Falha ao testar Stripe.", variant: "destructive" });
        } finally {
            setTestingStripe(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h1 className="text-3xl font-bold">Configuração de Cobrança</h1>
                    <p className="text-muted-foreground">Gerencie planos e formas de pagamento.</p>
                </div>
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Salvar
                </Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Payment Methods */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Métodos de Pagamento</CardTitle>
                        <CardDescription>Configure as integrações.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="pix">
                            <TabsList className="grid w-full grid-cols-2 mb-6">
                                <TabsTrigger value="pix" className="gap-2">
                                    <Smartphone className="w-4 h-4" /> PIX
                                </TabsTrigger>
                                <TabsTrigger value="stripe" className="gap-2">
                                    <CreditCard className="w-4 h-4" /> Stripe
                                </TabsTrigger>
                            </TabsList>

                            {/* PIX */}
                            <TabsContent value="pix" className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                                    <div className="flex gap-3">
                                        <Smartphone className="w-5 h-5 text-green-600" />
                                        <div className="text-sm">
                                            <p className="font-semibold text-green-700 dark:text-green-300">PIX Manual</p>
                                            <p className="text-muted-foreground">Cliente envia comprovante, você libera manualmente.</p>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={config.pixEnabled}
                                        onCheckedChange={(v) => setConfig({ ...config, pixEnabled: v })}
                                    />
                                </div>

                                <div className="grid gap-4">
                                    <div className="space-y-2">
                                        <Label>Chave PIX</Label>
                                        <Input
                                            placeholder="CNPJ, E-mail ou Telefone"
                                            value={config.pixKey}
                                            onChange={(e) => setConfig({ ...config, pixKey: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Beneficiário</Label>
                                        <Input
                                            placeholder="Nome ou Empresa"
                                            value={config.pixBeneficiary}
                                            onChange={(e) => setConfig({ ...config, pixBeneficiary: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Banco</Label>
                                        <Input
                                            placeholder="Ex: Nubank"
                                            value={config.pixBank}
                                            onChange={(e) => setConfig({ ...config, pixBank: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </TabsContent>

                            {/* Stripe */}
                            <TabsContent value="stripe" className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                                    <div className="flex gap-3">
                                        <ShieldCheck className="w-5 h-5 text-blue-500" />
                                        <div className="text-sm">
                                            <p className="font-semibold text-blue-700 dark:text-blue-300">Stripe (Automático)</p>
                                            <p className="text-muted-foreground">Cobrança recorrente via Cartão.</p>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={config.stripeEnabled}
                                        onCheckedChange={(v) => setConfig({ ...config, stripeEnabled: v })}
                                    />
                                </div>

                                <div className="grid gap-4">
                                    <div className="space-y-2">
                                        <Label>Publishable Key</Label>
                                        <Input
                                            placeholder="pk_live_..."
                                            value={config.stripePublicKey}
                                            onChange={(e) => setConfig({ ...config, stripePublicKey: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Secret Key</Label>
                                        <Input
                                            type="password"
                                            placeholder="sk_live_..."
                                            value={config.stripeSecretKey}
                                            onChange={(e) => setConfig({ ...config, stripeSecretKey: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Webhook Secret</Label>
                                        <Input
                                            type="password"
                                            placeholder="whsec_..."
                                            value={config.stripeWebhookSecret}
                                            onChange={(e) => setConfig({ ...config, stripeWebhookSecret: e.target.value })}
                                        />
                                    </div>
                                    <Button variant="outline" onClick={testStripe} disabled={testingStripe || !config.stripeSecretKey}>
                                        {testingStripe ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                        Testar Conexão
                                    </Button>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>

                {/* Mode and Trial */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Modo do Sistema</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 gap-2">
                                <Button
                                    variant={config.billingMode === 'manual' ? 'default' : 'outline'}
                                    className="justify-start gap-2"
                                    onClick={() => setConfig({ ...config, billingMode: 'manual' })}
                                >
                                    <Banknote className="w-4 h-4" /> Manual / PIX
                                </Button>
                                <Button
                                    variant={config.billingMode === 'automatic' ? 'default' : 'outline'}
                                    className="justify-start gap-2"
                                    onClick={() => setConfig({ ...config, billingMode: 'automatic' })}
                                >
                                    <CreditCard className="w-4 h-4" /> Automático
                                </Button>
                            </div>
                            <div className="p-3 bg-muted rounded-md text-xs text-muted-foreground">
                                <Info className="w-4 h-4 mb-2" />
                                {config.billingMode === 'manual'
                                    ? "Admin libera créditos após confirmar PIX."
                                    : "Cobranças via Stripe automaticamente."
                                }
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Dias de Trial</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Input
                                type="number"
                                value={config.trialDays}
                                onChange={(e) => setConfig({ ...config, trialDays: parseInt(e.target.value) || 30 })}
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Plans Configuration */}
            <Card>
                <CardHeader>
                    <CardTitle>Configuração dos Planos</CardTitle>
                    <CardDescription>Defina nome, preço e funcionalidades de cada plano.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid md:grid-cols-3 gap-6">
                        {/* Basic Plan */}
                        <div className="p-4 border rounded-lg space-y-3">
                            <h4 className="font-semibold text-primary">Plano Básico</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-xs">Nome</Label>
                                    <Input value={config.basicName} onChange={(e) => setConfig({ ...config, basicName: e.target.value })} />
                                </div>
                                <div>
                                    <Label className="text-xs">Preço (R$)</Label>
                                    <Input type="number" step="0.01" value={config.basicPrice} onChange={(e) => setConfig({ ...config, basicPrice: parseFloat(e.target.value) || 0 })} />
                                </div>
                            </div>
                            <div>
                                <Label className="text-xs">Stripe Price ID</Label>
                                <Input placeholder="price_..." value={config.basicPriceId} onChange={(e) => setConfig({ ...config, basicPriceId: e.target.value })} />
                            </div>
                            <div>
                                <Label className="text-xs">Features (uma por linha)</Label>
                                <textarea className="w-full p-2 border rounded text-sm min-h-[80px] bg-background" value={config.basicFeatures} onChange={(e) => setConfig({ ...config, basicFeatures: e.target.value })} />
                            </div>
                        </div>

                        {/* Pro Plan */}
                        <div className="p-4 border rounded-lg space-y-3 border-primary/30 bg-primary/5">
                            <h4 className="font-semibold text-primary">Plano Pro ⭐</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-xs">Nome</Label>
                                    <Input value={config.proName} onChange={(e) => setConfig({ ...config, proName: e.target.value })} />
                                </div>
                                <div>
                                    <Label className="text-xs">Preço (R$)</Label>
                                    <Input type="number" step="0.01" value={config.proPrice} onChange={(e) => setConfig({ ...config, proPrice: parseFloat(e.target.value) || 0 })} />
                                </div>
                            </div>
                            <div>
                                <Label className="text-xs">Stripe Price ID</Label>
                                <Input placeholder="price_..." value={config.proPriceId} onChange={(e) => setConfig({ ...config, proPriceId: e.target.value })} />
                            </div>
                            <div>
                                <Label className="text-xs">Features (uma por linha)</Label>
                                <textarea className="w-full p-2 border rounded text-sm min-h-[80px] bg-background" value={config.proFeatures} onChange={(e) => setConfig({ ...config, proFeatures: e.target.value })} />
                            </div>
                        </div>

                        {/* Full Plan */}
                        <div className="p-4 border rounded-lg space-y-3">
                            <h4 className="font-semibold text-primary">Plano Full</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-xs">Nome</Label>
                                    <Input value={config.enterpriseName} onChange={(e) => setConfig({ ...config, enterpriseName: e.target.value })} />
                                </div>
                                <div>
                                    <Label className="text-xs">Preço (R$)</Label>
                                    <Input type="number" step="0.01" value={config.enterprisePrice} onChange={(e) => setConfig({ ...config, enterprisePrice: parseFloat(e.target.value) || 0 })} />
                                </div>
                            </div>
                            <div>
                                <Label className="text-xs">Stripe Price ID</Label>
                                <Input placeholder="price_..." value={config.enterprisePriceId} onChange={(e) => setConfig({ ...config, enterprisePriceId: e.target.value })} />
                            </div>
                            <div>
                                <Label className="text-xs">Features (uma por linha)</Label>
                                <textarea className="w-full p-2 border rounded text-sm min-h-[80px] bg-background" value={config.enterpriseFeatures} onChange={(e) => setConfig({ ...config, enterpriseFeatures: e.target.value })} />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
