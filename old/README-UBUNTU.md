# 🤖 Chatbot WhatsApp - Guia de Deploy Ubuntu 22.04

Dashboard de gerenciamento de chatbots WhatsApp com integração Stripe, IA Gemini e sistema de lógicas JSON/AI/HÍBRIDO.

## 📋 Pré-requisitos

- Ubuntu 22.04 LTS
- Node.js 18 ou superior
- PostgreSQL 14 ou superior
- Chromium Browser
- Git

## 🚀 Instalação Rápida

### 1. Instalar Dependências do Sistema

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Instalar PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Instalar Chromium (OBRIGATÓRIO para WhatsApp)
sudo apt install -y chromium-browser

# Instalar PM2 (gerenciador de processos)
sudo npm install -g pm2

# Instalar Git (se não tiver)
sudo apt install -y git
```

### 2. Clonar o Repositório

```bash
git clone https://github.com/deletrics-oss/chatbotstripe2.git
cd chatbotstripe2
```

### 3. Configurar Banco de Dados

```bash
# Entrar no PostgreSQL
sudo -u postgres psql

# Criar banco de dados e usuário
CREATE DATABASE chatbot_whatsapp;
CREATE USER chatbot_user WITH ENCRYPTED PASSWORD 'sua_senha_aqui';
GRANT ALL PRIVILEGES ON DATABASE chatbot_whatsapp TO chatbot_user;
\q
```

### 4. Configurar Variáveis de Ambiente

```bash
# Copiar arquivo de exemplo
cp .env.example .env

# Editar configurações
nano .env
```

Preencha as seguintes variáveis no arquivo `.env`:

```env
# Porta do servidor (padrão: 3035)
PORT=3035
NODE_ENV=production

# Database URL (ajuste com suas credenciais)
DATABASE_URL=postgresql://chatbot_user:sua_senha_aqui@localhost:5432/chatbot_whatsapp

# Session Secret (gere uma chave aleatória)
SESSION_SECRET=cole-uma-string-aleatoria-muito-longa-aqui

# Stripe (para pagamentos)
STRIPE_SECRET_KEY=sk_live_seu_stripe_secret_key

# Gemini AI (para lógicas com IA)
GEMINI_API_KEY=sua_gemini_api_key

# Chromium Path (Ubuntu)
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

### 5. Deploy Automático

```bash
# Tornar script executável
chmod +x deploy.sh

# Executar deploy
./deploy.sh
```

O script automaticamente:
- ✅ Instala dependências npm
- ✅ Faz build do projeto
- ✅ Roda migrations do banco
- ✅ Configura PM2
- ✅ Inicia a aplicação

## 📊 Gerenciamento com PM2

```bash
# Ver status
pm2 status

# Ver logs em tempo real
pm2 logs chatbot-whatsapp

# Reiniciar aplicação
pm2 restart chatbot-whatsapp

# Parar aplicação
pm2 stop chatbot-whatsapp

# Monitoramento
pm2 monit
```

## 🔧 Configuração Avançada

### Firewall (UFW)

```bash
# Permitir acesso na porta 3035
sudo ufw allow 3035

# Verificar status
sudo ufw status
```

### Nginx Reverse Proxy (Opcional)

```bash
# Instalar Nginx
sudo apt install -y nginx

# Configurar site
sudo nano /etc/nginx/sites-available/chatbot-whatsapp
```

Adicione:

```nginx
server {
    listen 80;
    server_name seu-dominio.com;

    location / {
        proxy_pass http://localhost:3035;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Ativar site
sudo ln -s /etc/nginx/sites-available/chatbot-whatsapp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### SSL com Certbot (HTTPS)

```bash
# Instalar Certbot
sudo apt install -y certbot python3-certbot-nginx

# Gerar certificado
sudo certbot --nginx -d seu-dominio.com
```

## 🔐 Segurança

1. **Altere o SESSION_SECRET** para uma string aleatória forte
2. **Use HTTPS** em produção (Nginx + Certbot)
3. **Configure firewall** para permitir apenas portas necessárias
4. **Mantenha o sistema atualizado** com `sudo apt update && sudo apt upgrade`
5. **Não exponha .env** no Git (já incluído no .gitignore)

## 🗄️ Backup do Banco de Dados

```bash
# Fazer backup
pg_dump -U chatbot_user chatbot_whatsapp > backup_$(date +%Y%m%d_%H%M%S).sql

# Restaurar backup
psql -U chatbot_user chatbot_whatsapp < backup_20250120_143000.sql
```

## 🐛 Troubleshooting

### Erro: "QR Code não aparece"

```bash
# Verificar se Chromium está instalado
which chromium-browser

# Verificar variável PUPPETEER_EXECUTABLE_PATH no .env
cat .env | grep PUPPETEER
```

### Erro: "Database connection failed"

```bash
# Verificar se PostgreSQL está rodando
sudo systemctl status postgresql

# Testar conexão
psql -U chatbot_user -d chatbot_whatsapp -h localhost
```

### Erro: "Port 3035 already in use"

```bash
# Ver qual processo está usando a porta
sudo lsof -i :3035

# Parar PM2
pm2 stop chatbot-whatsapp
```

### Aplicação não inicia

```bash
# Ver logs de erro
pm2 logs chatbot-whatsapp --err

# Verificar build
npm run build
```

## 📱 Funcionalidades

- ✅ **Autenticação Local** - Login com username/password (sem necessidade de email)
- ✅ **Planos** - Free (1 device/1 logic), Basic (2 devices), Full (unlimited + AI)
- ✅ **WhatsApp Integration** - Conectar múltiplos dispositivos via QR Code
- ✅ **Lógicas JSON** - Criar regras de conversação manualmente
- ✅ **Lógicas com IA** - Gemini gera lógicas automaticamente
- ✅ **Lógicas HÍBRIDAS** - JSON + IA trabalhando juntos
- ✅ **Stripe Payments** - Upgrade de planos via pagamento
- ✅ **Dashboard em Tempo Real** - WebSocket para monitoramento
- ✅ **Base de Conhecimento** - Armazenar informações para o bot

## 🔑 API Endpoints

### Autenticação
- `POST /api/auth/register` - Criar conta
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/user` - Dados do usuário logado

### Dispositivos WhatsApp
- `GET /api/devices` - Listar dispositivos
- `POST /api/devices` - Adicionar dispositivo
- `DELETE /api/devices/:id` - Remover dispositivo

### Lógicas
- `GET /api/logics` - Listar lógicas
- `POST /api/logics` - Criar lógica
- `PATCH /api/logics/:id` - Editar lógica
- `DELETE /api/logics/:id` - Deletar lógica

### IA Gemini
- `POST /api/ai/generate-logic` - Gerar lógica com IA (preview)
- `POST /api/ai/generate-and-save-logic` - Gerar e salvar lógica

## 📞 Suporte

Em caso de problemas, verifique:
1. Logs do PM2: `pm2 logs chatbot-whatsapp`
2. Logs do PostgreSQL: `sudo tail -f /var/log/postgresql/postgresql-14-main.log`
3. Status dos serviços: `pm2 status` e `sudo systemctl status postgresql`

## 📄 Licença

MIT License

---

**Desenvolvido com ❤️ para Ubuntu 22.04**
