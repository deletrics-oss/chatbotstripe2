import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Check, MessageSquare, Smartphone, Zap, Bot, Crown, Sparkles, ArrowRight,
  Clock, Users, ShoppingCart, Calendar, Building2, Stethoscope, GraduationCap,
  Utensils, Car, Briefcase, HeartPulse, Store, ChevronDown, Play, Shield,
  BarChart3, Globe, Headphones, FileJson, Brain, Send, BookOpen
} from "lucide-react";

interface Plan {
  id: string;
  name: string;
  price: number;
  features: string[];
  recommended?: boolean;
}

interface PlansData {
  plans: Plan[];
  trialDays: number;
}

const useCases = [
  { icon: Store, title: "Lojas e E-commerce", desc: "Atendimento automático, consulta de pedidos, status de entrega" },
  { icon: Utensils, title: "Restaurantes e Delivery", desc: "Receber pedidos, cardápio digital, reservas automáticas" },
  { icon: Stethoscope, title: "Clínicas e Consultórios", desc: "Agendamento de consultas, confirmações, lembretes" },
  { icon: Building2, title: "Imobiliárias", desc: "Responder sobre imóveis, agendar visitas, qualificar leads" },
  { icon: GraduationCap, title: "Escolas e Cursos", desc: "Informações sobre matriculas, horários, comunicados" },
  { icon: Car, title: "Oficinas e Funilarias", desc: "Orçamentos, status de serviços, agendamentos" },
  { icon: Briefcase, title: "Escritórios e Serviços", desc: "Atendimento inicial, triagem de clientes, suporte" },
  { icon: HeartPulse, title: "Academia e Personal", desc: "Horários, planos, acompanhamento de alunos" },
];

const features = [
  {
    icon: Smartphone,
    title: "Multi-Dispositivos WhatsApp",
    desc: "Conecte múltiplos números via QR Code. Gerencie todos em um único painel.",
    details: ["Até 3 dispositivos por conta", "QR Code instantâneo", "Reconexão automática", "Status em tempo real"]
  },
  {
    icon: FileJson,
    title: "Editor de Lógicas JSON",
    desc: "Crie fluxos de conversa com regras personalizadas de forma visual.",
    details: ["Keywords e respostas", "Templates prontos", "Upload de JSON", "Regras condicionais"]
  },
  {
    icon: Bot,
    title: "IA Gemini Integrada",
    desc: "Bot inteligente que entende contexto e responde naturalmente.",
    details: ["Respostas humanizadas", "Aprende com o contexto", "Base de conhecimento", "Personalidade configurável"]
  },
  {
    icon: MessageSquare,
    title: "Chat em Tempo Real",
    desc: "Visualize e intervenha em conversas quando necessário.",
    details: ["Histórico completo", "Intervenção manual", "Notificações", "Busca de mensagens"]
  },
  {
    icon: Send,
    title: "Disparo em Massa",
    desc: "Envie mensagens para centenas de contatos de forma segura.",
    details: ["Agendamento", "Delay configurável", "Mídia (fotos/vídeos)", "Relatórios de envio"]
  },
  {
    icon: Brain,
    title: "Comportamentos do Bot",
    desc: "Configure tom, personalidade e estilo de resposta.",
    details: ["Profissional, Amigável, Vendas", "Instruções customizadas", "Presets prontos", "Ajuste fino"]
  },
  {
    icon: BookOpen,
    title: "Base de Conhecimento",
    desc: "Alimente o bot com informações do seu negócio.",
    details: ["Produtos e serviços", "Perguntas frequentes", "Políticas", "Contatos"]
  },
  {
    icon: Globe,
    title: "Assistentes Web",
    desc: "Widget de chat para incorporar no seu site.",
    details: ["Customização visual", "Embed fácil", "Mesmo bot do WhatsApp", "Respostas instantâneas"]
  },
];

const benefits = [
  { icon: Clock, title: "Atendimento 24/7", desc: "Nunca perca um cliente por falta de resposta" },
  { icon: Users, title: "Escale sem contratar", desc: "Atenda milhares simultaneamente" },
  { icon: BarChart3, title: "Aumente conversões", desc: "Respostas rápidas = mais vendas" },
  { icon: Shield, title: "Segurança total", desc: "Seus dados protegidos" },
];

const faqs = [
  { q: "Preciso ter conhecimento técnico?", a: "Não! O sistema foi feito para ser simples. Você configura tudo pelo painel visual, sem programar." },
  { q: "Funciona em qualquer número?", a: "Sim, funciona com qualquer número de WhatsApp. Você escaneia o QR Code e pronto." },
  { q: "O WhatsApp pode me bloquear?", a: "Seguimos as melhores práticas. Delays configuráveis e comportamento natural minimizam riscos." },
  { q: "Posso testar antes de pagar?", a: "Sim! Oferecemos período de teste grátis com todas as funcionalidades liberadas." },
  { q: "Como funciona o suporte?", a: "Temos suporte via WhatsApp, email e o próprio Guru do Sistema (IA) dentro do painel." },
];

export default function Landing() {
  const [plansData, setPlansData] = useState<PlansData | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/plans')
      .then(res => res.json())
      .then(data => setPlansData(data))
      .catch(() => { });
  }, []);

  const plans = plansData?.plans || [
    { id: 'free', name: 'Free Trial', price: 0, features: ['30 dias grátis', '1 dispositivo', 'Todas funcionalidades'], recommended: false },
    { id: 'basic', name: 'Básico', price: 29.90, features: ['2 dispositivos', 'Templates prontos', 'Suporte'], recommended: true },
    { id: 'full', name: 'Full', price: 99.90, features: ['3 dispositivos', 'IA Gemini', 'Prioridade'], recommended: false },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="text-center space-y-8 max-w-4xl mx-auto mb-20">
          <Badge variant="secondary" className="px-4 py-2 text-sm bg-white/10 text-white border-white/20">
            <Sparkles className="w-4 h-4 mr-2" />
            {plansData?.trialDays || 30} dias grátis para testar
          </Badge>

          <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight" data-testid="text-hero-title">
            Automatize seu
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent"> WhatsApp</span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-300" data-testid="text-hero-subtitle">
            Dashboard completo para gerenciamento de Chatbot WhatsApp com Inteligência Artificial.
            Atenda clientes 24 horas, agende mensagens e aumente suas vendas.
          </p>

          <div className="flex gap-4 justify-center flex-wrap pt-4">
            <Button size="lg" className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 h-14 text-lg" asChild data-testid="button-start-trial">
              <a href="/register">
                Começar Grátis
                <ArrowRight className="ml-2 w-5 h-5" />
              </a>
            </Button>
            <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 px-8 h-14 text-lg" asChild>
              <a href="#demo">
                <Play className="mr-2 w-5 h-5" />
                Ver Demonstração
              </a>
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 pt-12 max-w-2xl mx-auto">
            <div className="text-center">
              <p className="text-4xl font-bold text-white">24/7</p>
              <p className="text-gray-400 text-sm">Atendimento</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold text-white">+500</p>
              <p className="text-gray-400 text-sm">Empresas ativas</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold text-white">98%</p>
              <p className="text-gray-400 text-sm">Satisfação</p>
            </div>
          </div>
        </div>

        {/* Problem/Solution Section */}
        <div className="max-w-5xl mx-auto mb-20 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Cansado de perder clientes por não responder a tempo?
          </h2>
          <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
            Enquanto você dorme ou está ocupado, clientes mandam mensagens e vão para a concorrência.
            Com o ChatBot Host, seu WhatsApp responde <strong className="text-purple-400">automaticamente</strong>,
            qualifica leads, agenda atendimentos e <strong className="text-purple-400">nunca perde uma venda</strong>.
          </p>
        </div>

        {/* Use Cases Section */}
        <div className="max-w-6xl mx-auto mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Para Quem é Ideal?</h2>
            <p className="text-gray-400">Funciona para diversos tipos de negócios</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {useCases.map((useCase, i) => (
              <Card key={i} className="bg-white/5 border-white/10 hover:bg-white/10 transition-all hover:scale-105 cursor-default">
                <CardContent className="p-6">
                  <useCase.icon className="w-10 h-10 text-purple-400 mb-3" />
                  <h3 className="font-semibold text-white mb-2">{useCase.title}</h3>
                  <p className="text-sm text-gray-400">{useCase.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Features Section */}
        <div id="features" className="max-w-6xl mx-auto mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Funcionalidades Completas</h2>
            <p className="text-gray-400">Tudo que você precisa para automatizar seu atendimento</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature, i) => (
              <Card key={i} className="bg-white/5 border-white/10 hover:bg-white/10 transition-all">
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-purple-500/20">
                      <feature.icon className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                      <CardTitle className="text-white text-lg">{feature.title}</CardTitle>
                      <CardDescription className="text-gray-400 mt-1">{feature.desc}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="grid grid-cols-2 gap-2">
                    {feature.details.map((detail, j) => (
                      <li key={j} className="flex items-center gap-2 text-sm text-gray-300">
                        <Check className="w-4 h-4 text-green-400 shrink-0" />
                        {detail}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Benefits Section */}
        <div className="max-w-4xl mx-auto mb-20">
          <div className="grid md:grid-cols-4 gap-6">
            {benefits.map((benefit, i) => (
              <div key={i} className="text-center p-6">
                <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center mb-4">
                  <benefit.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="font-semibold text-white mb-2">{benefit.title}</h3>
                <p className="text-sm text-gray-400">{benefit.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* How it Works */}
        <div className="max-w-4xl mx-auto mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Como Funciona?</h2>
            <p className="text-gray-400">Em 3 passos simples você está pronto</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "1", title: "Conecte seu WhatsApp", desc: "Escaneie o QR Code no painel e seu número estará conectado em segundos." },
              { step: "2", title: "Configure o Bot", desc: "Escolha um template pronto ou crie suas próprias regras de resposta." },
              { step: "3", title: "Deixe a IA Trabalhar", desc: "O bot responde automaticamente enquanto você foca no que importa." },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-xl mb-4">
                  {item.step}
                </div>
                <h3 className="font-semibold text-white text-lg mb-2">{item.title}</h3>
                <p className="text-gray-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing Section */}
        <div id="plans" className="max-w-5xl mx-auto mb-20 scroll-mt-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Planos e Preços</h2>
            <p className="text-gray-400">Comece gratuitamente e faça upgrade quando precisar</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className={`relative bg-white/5 border-white/10 backdrop-blur-sm hover:scale-105 transition-all duration-300 ${plan.recommended ? 'border-2 border-purple-500 shadow-2xl shadow-purple-500/20' : ''
                  }`}
              >
                {plan.recommended && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-1">
                      <Crown className="w-3 h-3 mr-1" />
                      RECOMENDADO
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-2xl font-bold text-white">{plan.name}</CardTitle>
                  <div className="pt-4">
                    <span className="text-4xl font-bold text-white">
                      {plan.price === 0 ? 'Grátis' : `R$ ${plan.price.toFixed(2).replace('.', ',')}`}
                    </span>
                    {plan.price > 0 && <span className="text-gray-400 text-sm">/mês</span>}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <ul className="space-y-3">
                    {plan.features.map((feature, j) => (
                      <li key={j} className="flex items-center gap-2 text-gray-300">
                        <div className="p-1 rounded-full bg-purple-500/20">
                          <Check className="w-3 h-3 text-purple-400" />
                        </div>
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className={`w-full ${plan.recommended ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700' : 'bg-white/10 hover:bg-white/20'}`}
                    asChild
                  >
                    <a href={plan.price === 0 ? "/register" : "/login"}>
                      {plan.price === 0 ? "Começar Trial" : "Assinar Agora"}
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Perguntas Frequentes</h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="bg-white/5 border border-white/10 rounded-lg overflow-hidden"
              >
                <button
                  className="w-full p-4 text-left flex items-center justify-between text-white font-medium hover:bg-white/5"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  {faq.q}
                  <ChevronDown className={`w-5 h-5 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4 text-gray-400">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Final CTA */}
        <div className="max-w-3xl mx-auto text-center mb-20">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Pronto para Automatizar seu Atendimento?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Junte-se a centenas de empresas que já economizam tempo e aumentam vendas com ChatBot Host.
          </p>
          <Button size="lg" className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-12 h-16 text-xl" asChild>
            <a href="/register">
              Começar Agora - É Grátis
              <ArrowRight className="ml-3 w-6 h-6" />
            </a>
          </Button>
          <p className="text-gray-500 text-sm mt-4">Sem cartão de crédito • Cancele quando quiser</p>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-bold text-white mb-4">ChatBot Host</h3>
              <p className="text-gray-400 text-sm">Dashboard completo para automação de WhatsApp com IA.</p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Recursos</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#features" className="hover:text-white">Funcionalidades</a></li>
                <li><a href="#plans" className="hover:text-white">Planos</a></li>
                <li><a href="/login" className="hover:text-white">Login</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Suporte</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>Documentação</li>
                <li>WhatsApp</li>
                <li>Email</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>Termos de Uso</li>
                <li>Privacidade</li>
              </ul>
            </div>
          </div>
          <div className="text-center text-sm text-gray-500 pt-8 border-t border-white/10">
            <p>© 2025 ChatBot Host. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
