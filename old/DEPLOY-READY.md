# ✅ Projeto Pronto para Deploy no Ubuntu 22.04

## 🎉 Mudanças Implementadas

### 1. **Autenticação Local Completa**
- ✅ Sistema de username/password com bcrypt
- ✅ Sessões Express com MemoryStore
- ✅ Validação Zod em todos endpoints
- ✅ Endpoints: `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`
- ✅ Middleware de autenticação `isAuthenticated`
- ✅ Verificação de SESSION_SECRET em produção (app fecha se não configurado)

### 2. **Configuração de Produção**
- ✅ Porta padrão: **3035** (configurável via PORT env var)
- ✅ WhatsApp Manager detecta Chromium do sistema (via PUPPETEER_EXECUTABLE_PATH)
- ✅ Build de produção testado e funcionando

### 3. **Arquivos de Deploy Criados**
- ✅ `.env.example` - Template de variáveis de ambiente
- ✅ `deploy.sh` - Script de deploy automatizado
- ✅ `ecosystem.config.js` - Configuração PM2
- ✅ `.gitignore` - Proteção de arquivos sensíveis
- ✅ `README-UBUNTU.md` - Guia completo de instalação
- ✅ `PRODUCTION.md` - Documentação de manutenção e troubleshooting
- ✅ `GITHUB-SETUP.md` - Instruções de export para GitHub

## 📦 Próximos Passos para Deploy

### Passo 1: Exportar para GitHub

**Via Replit UI (Recomendado):**
1. Clique no ícone "Git" no painel lateral
2. Clique em "Connect to GitHub"
3. Cole seu Personal Access Token
4. Selecione o repositório: `deletrics-oss/chatbotstripe2`
5. Clique em "Push to GitHub"

**Via Shell (Alternativo):**
```bash
# Adicionar todos os arquivos
git add .

# Commit
git commit -m "Deploy completo - Dashboard WhatsApp com auth local, porta 3035, Chromium Ubuntu"

# Push (substitua SEU_PAT pelo seu token)
git push https://SEU_PAT@github.com/deletrics-oss/chatbotstripe2.git main
```

### Passo 2: No Servidor Ubuntu 22.04

```bash
# 1. Clone o repositório
git clone https://github.com/deletrics-oss/chatbotstripe2.git
cd chatbotstripe2

# 2. Configure o .env
cp .env.example .env
nano .env
# Preencha: DATABASE_URL, SESSION_SECRET, STRIPE_SECRET_KEY, GEMINI_API_KEY

# 3. Execute o script de deploy
chmod +x deploy.sh
./deploy.sh

# 4. Instale Chromium
sudo apt install chromium-browser

# 5. Verifique se está rodando
pm2 status
pm2 logs chatbot-whatsapp
```

## 🔐 Variáveis de Ambiente Obrigatórias

Configure no arquivo `.env` no servidor:

```env
# Porta do servidor
PORT=3035
NODE_ENV=production

# PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/chatbot_whatsapp

# Session Secret (CRÍTICO - gere uma string aleatória forte!)
SESSION_SECRET=cole_uma_string_aleatoria_muito_longa_aqui

# Stripe
STRIPE_SECRET_KEY=sk_live_seu_stripe_key

# Gemini AI
GEMINI_API_KEY=sua_gemini_api_key

# Chromium Path
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

**⚠️ IMPORTANTE:** Gere um SESSION_SECRET forte! Exemplo:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## 🚀 Após o Deploy

### Verificar Status
```bash
pm2 status
pm2 logs chatbot-whatsapp
curl http://localhost:3035/api/auth/user
```

### Acessar Aplicação
Navegue para: `http://seu-servidor-ip:3035`

## 📚 Documentação Completa

Consulte os arquivos para mais detalhes:

- **README-UBUNTU.md** - Guia completo de instalação com pré-requisitos
- **PRODUCTION.md** - Manutenção, backups, troubleshooting
- **GITHUB-SETUP.md** - Instruções de export para GitHub
- **.env.example** - Template de variáveis de ambiente

## 🔧 Comandos Úteis

```bash
# Ver logs em tempo real
pm2 logs chatbot-whatsapp

# Reiniciar aplicação
pm2 restart chatbot-whatsapp

# Parar aplicação
pm2 stop chatbot-whatsapp

# Ver status
pm2 status

# Monitoramento
pm2 monit
```

## ✨ Funcionalidades Implementadas

- ✅ **Autenticação Local** - Login com username/password (sem email)
- ✅ **Planos** - Free (1 device/1 logic), Basic (2 devices), Full (unlimited + AI)
- ✅ **WhatsApp Integration** - QR Code para conectar dispositivos
- ✅ **Lógicas JSON** - Editor Monaco para lógicas manuais
- ✅ **Lógicas com IA** - Gemini gera lógicas automaticamente (plano Full)
- ✅ **Lógicas HÍBRIDAS** - Combina JSON + IA
- ✅ **Stripe Payments** - Upgrade de planos
- ✅ **Dashboard em Tempo Real** - WebSocket para chat ao vivo
- ✅ **Base de Conhecimento** - Armazenar informações do bot

## 🔒 Segurança

✅ Senhas com bcrypt (salt rounds: 10)
✅ Sessões HTTP-only cookies
✅ Validação Zod em todos endpoints
✅ SESSION_SECRET obrigatório em produção
✅ .env não commitado no Git
✅ HTTPS recomendado (configure Nginx + Certbot)

## 🎯 Checklist Pós-Deploy

- [ ] PostgreSQL instalado e rodando
- [ ] Chromium instalado (`chromium-browser`)
- [ ] Variáveis .env configuradas
- [ ] `deploy.sh` executado com sucesso
- [ ] PM2 rodando a aplicação
- [ ] Porta 3035 acessível
- [ ] Primeiro usuário criado via `/api/auth/register`
- [ ] QR Code do WhatsApp aparecendo
- [ ] Backups automáticos configurados (opcional)
- [ ] Firewall configurado (opcional)
- [ ] Nginx + SSL configurado (opcional)

## 📞 Suporte

Se encontrar problemas, consulte:
1. **PRODUCTION.md** - Seção de troubleshooting
2. Logs do PM2: `pm2 logs chatbot-whatsapp --err`
3. Logs do PostgreSQL: `sudo tail -f /var/log/postgresql/*.log`

---

**Desenvolvido com ❤️ para Ubuntu 22.04 LTS**

**Porta padrão:** 3035
**Autenticação:** Local (username/password)
**Banco:** PostgreSQL
**WhatsApp:** Chromium via puppeteer
