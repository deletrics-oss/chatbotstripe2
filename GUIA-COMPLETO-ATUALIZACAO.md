# 🚀 Guia Completo de Atualização - ChatBot WhatsApp

## 📋 Resumo das Mudanças

✅ **Plano FREE funciona sem Stripe** - Botão leva direto para criar conta  
✅ **Planos pagos integrados com Stripe** - Usando seus Price IDs corretos  
✅ **Preços atualizados** - R$ 29,90 (Básico) e R$ 99,90 (Full)  
✅ **Descrições corretas** - 30 dias free, 1 device (Básico), 3 devices (Full)  
✅ **Páginas de Login e Registro criadas** - Auth funcional  

---

## 🎯 Passo a Passo

### 1️⃣ Substituir o arquivo .env no servidor

```bash
# No servidor Ubuntu
cd /root/chatbotstripe2
nano .env
```

**Cole este conteúdo COMPLETO** (substitua tudo):

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

Salve com `Ctrl+O`, `Enter`, `Ctrl+X`

---

### 2️⃣ Atualizar código do GitHub e fazer pull

**No Replit ou no seu computador:**

1. Faça commit das alterações
2. Faça push para o GitHub

**No servidor Ubuntu:**

```bash
cd /root/chatbotstripe2

# Fazer backup do .env atual (importante!)
cp .env .env.backup

# Fazer pull das atualizações
git pull origin main

# Restaurar o .env com as configurações corretas
cp .env.backup .env
```

---

### 3️⃣ Rebuild e restart da aplicação

```bash
cd /root/chatbotstripe2

# Build
npm run build

# Restart PM2
pm2 restart chatbot-whatsapp

# Verificar logs
pm2 logs chatbot-whatsapp
```

---

## ✅ Testar Funcionalidades

### Teste 1: Plano FREE (Sem Stripe)

1. Acesse: `http://72.60.246.250:3035`
2. Clique em **"Começar Agora"** ou **"Começar Trial"** (plano FREE)
3. Deve abrir página de registro `/register`
4. Preencha: username, senha (email opcional)
5. Clique em **"Começar Trial Grátis"**
6. Deve criar conta e logar automaticamente ✅

### Teste 2: Planos Pagos (Com Stripe)

1. Na landing page, clique em **"Assinar Agora"** (plano R$ 29,90 ou R$ 99,90)
2. Deve abrir página de login `/login`
3. Faça login com a conta criada
4. Vá para `/billing`
5. Clique novamente em um plano pago
6. Deve redirecionar para checkout do Stripe ✅

---

## 🎨 Mudanças Visuais

### Landing Page ANTES:
- ❌ Botão "Começar Trial" levava para `/api/login` (quebrado)
- ❌ Preço Full: R$ 99,00
- ❌ Descrições genéricas

### Landing Page DEPOIS:
- ✅ Botão "Começar Trial" leva para `/register` (criar conta grátis)
- ✅ Preço Full: R$ 99,90
- ✅ Descrições específicas:
  - **FREE**: 30 dias, 1 device, JSON estático
  - **Básico (R$ 29,90)**: 1 device, JSON estático
  - **Full (R$ 99,90)**: 3 devices, JSON + IA Gemini

---

## 📊 Arquivos Alterados

1. ✅ `client/src/pages/register.tsx` - NOVO (página de cadastro)
2. ✅ `client/src/pages/login.tsx` - NOVO (página de login)
3. ✅ `client/src/pages/landing.tsx` - ATUALIZADO (preços e botões)
4. ✅ `client/src/App.tsx` - ATUALIZADO (rotas /register e /login)
5. ✅ `.env` - ATUALIZADO (Price IDs do Stripe)

---

## 🔧 Troubleshooting

### Erro: "Cannot GET /register"

```bash
# Verificar se build foi feito
npm run build
pm2 restart chatbot-whatsapp
```

### Erro: Stripe checkout não funciona

```bash
# Verificar variáveis no .env
cat .env | grep STRIPE

# Deve mostrar:
# STRIPE_SECRET_KEY=sk_test_...
# VITE_STRIPE_PUBLIC_KEY=pk_test_...
# STRIPE_PRICE_BASIC=price_1SVG...
# STRIPE_PRICE_FULL=price_1SVGt...
```

### Erro: "Não autenticado"

```bash
# Verificar se SESSION_SECRET está configurado
cat .env | grep SESSION_SECRET

# Ver logs
pm2 logs chatbot-whatsapp
```

---

## 🎯 Fluxo Completo Esperado

### Usuário NOVO (Sem conta):

1. Acessa `http://72.60.246.250:3035`
2. Vê landing page com 3 planos
3. Clica em **"Começar Trial"** (FREE)
4. Preenche formulário de registro
5. Conta criada automaticamente (plano FREE, 30 dias)
6. Redirecionado para dashboard
7. Pode conectar 1 dispositivo WhatsApp
8. Pode criar lógicas JSON

### Usuário que quer UPGRADE:

1. Faz login
2. Vai em `/billing`
3. Clica em **"Assinar Agora"** (R$ 29,90 ou R$ 99,90)
4. Redirecionado para Stripe Checkout
5. Paga com cartão
6. Stripe webhook atualiza plano no banco
7. Ganha acesso às features do plano pago

---

## 📞 Suporte

Se algo não funcionar:

1. Ver logs: `pm2 logs chatbot-whatsapp --err`
2. Ver status: `pm2 status`
3. Ver .env: `cat .env | grep -v SECRET | grep -v KEY` (não mostra senhas)

---

**Pronto! Agora está tudo configurado corretamente!** 🎉

Landing page funciona, plano FREE cria conta sem Stripe, planos pagos redirecionam para checkout do Stripe com os Price IDs corretos!
