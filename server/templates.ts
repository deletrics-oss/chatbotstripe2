import { LogicJson } from "./logicExecutor";

export interface LogicTemplate {
    id: string;
    name: string;
    description: string;
    category: string;
    logic: LogicJson;
}

export const LOGIC_TEMPLATES: LogicTemplate[] = [
    {
        id: "lcmelo-template",
        name: "LC Melo Parafusos",
        description: "Modelo completo de atendimento para indústria/loja (LC Melo).",
        category: "Exemplos Reais",
        logic: {
            default_reply: "Desculpe, não entendi sua solicitação. Por favor, escolha uma das opções numeradas.\n\nPara falar com um atendente, digite *5*.\nDigite *menu* para voltar ao início.",
            pause_bot_after_reply: false,
            rules: [
                {
                    keywords: ["oi", "ola", "olá", "bom dia", "boa tarde", "boa noite", "menu", "ajuda", "inicio", "início", "start", "voltar", "sair", "opcoes", "opções"],
                    reply: "Olá! 👋 Sou o assistente virtual da LC Melo Parafusos e Gabaritos.\n\nSe preferir, digite *5* para falar diretamente com um atendente.\n\nComo posso ajudar?\n\n1️⃣ - Sobre a LC Melo\n2️⃣ - Ver Produtos\n3️⃣ - Solicitar Orçamento / Falar com Vendas\n4️⃣ - Falar com o Financeiro\n5️⃣ - Outros assuntos Diversos",
                    pause_bot_after_reply: false
                },
                {
                    keywords: ["1"],
                    reply: "Com 30 anos de mercado, a LCM INDÚSTRIA conta com uma equipe de profissionais altamente qualificados. Desenvolve produtos para profissionais do setor moveleiro, parafusos e prolongadores para pastas e mostruários.\n\nEstamos localizados na Rua Honório Maia, 864 galpão D, Tatuapé - CEP 03072-000 - São Paulo -SP\n\nNosso site: www.lcmelo.com.br\nInstagram: https://www.instagram.com/lcmgabaritos/\nNossa Loja: www.lcmgabaritos.com.br\n\nDigite *menu* para voltar.",
                    pause_bot_after_reply: false
                },
                {
                    keywords: ["2"],
                    reply: "Ótimo! Sobre quais produtos você gostaria de saber mais? (Digite *P + o número*):\n\nP1 – Parafusos\nP2 – Gabaritos\n\nDigite *menu* para voltar.",
                    pause_bot_after_reply: false
                },
                {
                    keywords: ["p1", "parafusos"],
                    reply: "Aqui estão nossos parafusos. Veja mais em nossa loja:\n\n👉 https://www.lcmgabaritos.com.br/parafusos/\n\nDigite *2* para voltar ao menu de produtos ou *menu* para o início.",
                    pause_bot_after_reply: false
                },
                {
                    keywords: ["p2", "gabaritos"],
                    reply: "Aqui estão nossos gabaritos. Veja mais em nossa loja:\n\n👉 https://www.lcmgabaritos.com.br/gabaritos/\n\nDigite *2* para voltar ao menu de produtos ou *menu* para o início.",
                    pause_bot_after_reply: false
                },
                {
                    keywords: ["3", "orcamento", "cotacao", "preco", "comprar", "pedido", "vendas", "vendedor", "comercial"],
                    reply: "Entendi. Para cotações, disponibilidade, preços e para falar com nossa equipe comercial, por favor, entre em contato:\n\n📞 Telefone: *(11) 2641-3508*\n📱 WhatsApp Vendas: *11 95323-9904*\n📧 E-mail: *atendimento@lcmelo.com.br*\n\n*O assistente virtual será pausado para não atrapalhar.* Para reativá-lo, basta digitar *menu*. 🙂",
                    pause_bot_after_reply: true
                },
                {
                    keywords: ["4", "financeiro", "boleto", "pagamento", "nfe"],
                    reply: "Para falar com o Financeiro, por favor, entre em contato pelo WhatsApp:\n\n📱 WhatsApp Financeiro: *11 98810-7493*\n\n*O assistente virtual será pausado para não atrapalhar.* Para reativá-lo, basta digitar *menu*. 🙂",
                    pause_bot_after_reply: true
                },
                {
                    keywords: ["5", "contato", "falar com atendente", "atendente", "falar com alguem", "humano", "outros", "diversos", "outros assuntos"],
                    reply: "Entendido. Para falar com nossa equipe sobre outros assuntos, por favor, use um dos canais abaixo:\n\n📱 WhatsApp Atendimento: *11 95323-9904*\n📧 E-mail: *atendimento@lcmelo.com.br*\n\n*O assistente virtual será pausado para não atrapalhar.* Para reativá-lo, basta digitar *menu*. 🙂",
                    pause_bot_after_reply: true
                }
            ]
        }
    },
    {
        id: "fight-arcade-template",
        name: "Fight Arcade",
        description: "Loja de controles e fliperamas - atendimento completo com FAQ.",
        category: "Exemplos Reais",
        logic: {
            default_reply: "Olá! Bem-vindo à Fight Arcade! 🎮\n\nSou o assistente virtual e estou aqui para ajudar. Como posso te auxiliar hoje?\n\n1️⃣ - Ver Produtos\n2️⃣ - Informações sobre Envio\n3️⃣ - Formas de Pagamento\n4️⃣ - Garantia e Devolução\n5️⃣ - Falar com Atendente\n\nDigite o número da opção desejada ou faça sua pergunta!",
            pause_bot_after_reply: false,
            rules: [
                {
                    keywords: ["oi", "ola", "olá", "bom dia", "boa tarde", "boa noite", "menu", "ajuda", "inicio", "início"],
                    reply: "Olá! Bem-vindo à Fight Arcade! 🎮\n\nSou o assistente virtual e estou aqui para ajudar. Como posso te auxiliar hoje?\n\n1️⃣ - Ver Produtos\n2️⃣ - Informações sobre Envio\n3️⃣ - Formas de Pagamento\n4️⃣ - Garantia e Devolução\n5️⃣ - Falar com Atendente\n\nDigite o número da opção desejada ou faça sua pergunta!",
                    pause_bot_after_reply: false
                },
                {
                    keywords: ["1", "produtos", "controles", "fliperamas", "arcade"],
                    reply: "Temos diversos produtos incríveis! 🕹️\n\nAcesse nossa loja completa:\n👉 https://www.fightarcade.com.br/\n\nOu veja nossas plataformas:\n🛒 Mercado Livre: https://www.mercadolivre.com.br/perfil/FIGHTARCADEOFICIAL\n🛍️ Shopee: https://shopee.com.br/fightarcade\n\nPosso ajudar com algo mais?",
                    pause_bot_after_reply: false
                },
                {
                    keywords: ["2", "entrega", "envio", "frete", "rastreamento", "prazo"],
                    reply: "Fazemos entregas em todo o Brasil! 📦\n\n- **Frete e Prazo:** Calculados no checkout (Mercado Livre/Shopee) ou informados pelo atendente.\n- **Entrega no Mesmo Dia:** Grande São Paulo via motoboy (consulte disponibilidade).\n- **Rastreamento:** Você receberá o código por e-mail após o despacho.\n\nPosso ajudar com algo mais?",
                    pause_bot_after_reply: false
                },
                {
                    keywords: ["3", "pagamento", "pagar", "parcelamento", "pix", "boleto", "cartao"],
                    reply: "Aceitamos diversas formas de pagamento:\n\n- **Cartão de Crédito:** Parcelado em até 12x\n- **PIX:** Geralmente com desconto especial!\n- **Boleto Bancário**\n\nPosso ajudar com algo mais?",
                    pause_bot_after_reply: false
                },
                {
                    keywords: ["4", "garantia", "devolucao", "defeito", "arrependimento"],
                    reply: "Sua tranquilidade é nossa prioridade! ✅\n\n- **Garantia:** 1 ano para placas controladoras, 90 dias para demais componentes (contra defeitos de fabricação).\n- **Devolução:** 7 dias corridos após recebimento (produto na embalagem original, sem uso).\n*Obs: Não se aplica a produtos personalizados.*\n\nPosso ajudar com algo mais?",
                    pause_bot_after_reply: false
                },
                {
                    keywords: ["5", "atendente", "humano", "falar com alguem", "contato"],
                    reply: "Claro! Para falar com nossa equipe:\n\n📱 WhatsApp: (11) 97898-4413\n📧 E-mail: contato@fightarcade.com.br\n🕐 Horário: Segunda a Sexta, 9h às 18h\n\n*O assistente será pausado. Digite 'menu' para reativá-lo.*",
                    pause_bot_after_reply: true
                },
                {
                    keywords: ["instagram", "redes sociais", "facebook"],
                    reply: "Siga-nos no Instagram! 📸\n\n👉 @fightarcadeoficial\n\nFique por dentro de novidades, promoções e veja nossos produtos em ação!\n\nPosso ajudar com algo mais?",
                    pause_bot_after_reply: false
                }
            ]
        }
    },
    {
        id: "ai-assistant",
        name: "Assistente com IA (Híbrido)",
        description: "Bot inteligente que usa IA para responder o que não estiver nas regras.",
        category: "Inteligência Artificial",
        logic: {
            default_reply: "",
            pause_bot_after_reply: false,
            rules: [
                {
                    keywords: ["falar", "humano", "atendente"],
                    reply: "Vou chamar um especialista humano para te ajudar.",
                    pause_bot_after_reply: true
                },
                {
                    keywords: ["preço", "valor", "custo"],
                    reply: "Nossos planos começam a partir de R$ 29,90. Quer saber mais?",
                    pause_bot_after_reply: false
                }
            ]
        }
    }
];
