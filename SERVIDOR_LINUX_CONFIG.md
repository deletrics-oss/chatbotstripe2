# 🚀 Configuração do Servidor Linux (Ubuntu)

## 📋 Pré-requisitos

- Ubuntu 22.04 ou 24.04
- Nginx instalado
- Node.js 18+ instalado
- PostgreSQL instalado
- Domínio apontando para o servidor (ex: seudominio.com)

---

## 1️⃣ CONFIGURAR SSL COM CERTBOT (Obrigatório para Stripe)

### Instalar Certbot

```bash
# Atualizar pacotes
sudo apt update

# Instalar Certbot e plugin Nginx
sudo apt install certbot python3-certbot-nginx -y
```

### Configurar SSL automático

```bash
# Trocar seudominio.com pelo seu domínio real
sudo certbot --nginx -d seudominio.com -d www.seudominio.com
```

Durante a configuração:
1. Digite seu email
2. Aceite os termos de serviço
3. Escolha "Yes" para redirecionar HTTP → HTTPS

### Testar renovação automática

```bash
# Testar renovação (não renova de verdade)
sudo certbot renew --dry-run

# Verificar timer de renovação
sudo systemctl status certbot.timer
```

### Abrir portas no firewall

```bash
sudo ufw allow 'Nginx Full'
sudo ufw status
```

### Verificar SSL

Acesse: `https://www.ssllabs.com/ssltest/analyze.html?d=seudominio.com`

✅ **Deve mostrar "Grade A" ou "Grade A+"**

---

## 2️⃣ CONFIGURAR ENVIRONMENT VARIABLES (.env)

Crie o arquivo `.env` na raiz do projeto:

```bash
# No servidor, execute:
cd /caminho/do/projeto
nano .env
```

Cole este conteúdo (ajustando os valores):

```env
# ============ NODE ============
NODE_ENV=production
PORT=5000

# ============ DATABASE (PostgreSQL) ============
DATABASE_URL=postgresql://usuario:senha@localhost:5432/chatbot_db
PGHOST=localhost
PGUSER=seu_usuario_postgres
PGPASSWORD=sua_senha_postgres
PGDATABASE=chatbot_db
PGPORT=5432

# ============ SESSION ============
SESSION_SECRET=sua_chave_secreta_super_longa_aqui

# ============ GEMINI AI ============
# IMPORTANTE: Use GEMINI_API_KEY (não GOOGLE_API_KEY)
GEMINI_API_KEY=sua_chave_gemini_do_google_ai_studio

# ============ STRIPE ============
STRIPE_SECRET_KEY=sk_live_...
VITE_STRIPE_PUBLIC_KEY=pk_live_...
STRIPE_PRICE_BASIC=price_1234567890  # Price ID do plano Básico
STRIPE_PRICE_FULL=price_9876543210   # Price ID do plano Full
STRIPE_WEBHOOK_SECRET=whsec_...      # Secret do webhook
```

### Como conseguir as chaves:

#### Gemini API Key
1. Acesse: https://aistudio.google.com/app/apikey
2. Clique em "Get API Key"
3. Copie a chave que começa com `AIza...`
4. Cole em `GEMINI_API_KEY=`

#### Stripe Keys
1. Acesse: https://dashboard.stripe.com/apikeys
2. **Live Mode** (não test mode)
3. Copie:
   - **Secret key** → `STRIPE_SECRET_KEY`
   - **Publishable key** → `VITE_STRIPE_PUBLIC_KEY`

#### Stripe Price IDs (Planos)
1. Acesse: https://dashboard.stripe.com/products
2. Crie 2 produtos:
   - **Plano Básico**: R$ 29,90/mês
   - **Plano Full**: R$ 99,90/mês
3. Copie os **Price IDs** (começam com `price_...`)
4. Cole em `STRIPE_PRICE_BASIC` e `STRIPE_PRICE_FULL`

#### Stripe Webhook Secret
1. Acesse: https://dashboard.stripe.com/webhooks
2. Clique em "+ Add endpoint"
3. URL do endpoint: `https://seudominio.com/api/stripe/webhook`
4. Selecione eventos:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Clique em "Add endpoint"
6. Copie o **Signing secret** (começa com `whsec_...`)
7. Cole em `STRIPE_WEBHOOK_SECRET`

---

## 3️⃣ TROCAR PARA DATABASE STORAGE

No arquivo `server/storage.ts`, linha 622:

```typescript
// ANTES (desenvolvimento com MemStorage):
export const storage = new MemStorage();

// DEPOIS (produção com PostgreSQL):
export const storage = new DatabaseStorage();
```

---

## 4️⃣ EXECUTAR MIGRAÇÃO DO BANCO DE DADOS

```bash
# Criar tabelas no PostgreSQL
npm run db:push
```

Se der aviso de perda de dados:
```bash
# Forçar push (cuidado: apaga dados existentes)
npm run db:push --force
```

---

## 5️⃣ INSTALAR E RODAR COM PM2

```bash
# Instalar PM2 globalmente
npm install -g pm2

# Instalar dependências do projeto
npm install

# Buildar frontend
npm run build

# Iniciar aplicação com PM2
pm2 start npm --name "chatbot" -- run dev

# Salvar configuração PM2
pm2 save

# Auto-start no boot do servidor
pm2 startup
```

### Comandos úteis PM2:

```bash
# Ver logs em tempo real
pm2 logs chatbot

# Reiniciar aplicação
pm2 restart chatbot

# Parar aplicação
pm2 stop chatbot

# Status da aplicação
pm2 status

# Monitorar recursos
pm2 monit
```

---

## 6️⃣ CONFIGURAR NGINX

Edite a configuração do Nginx:

```bash
sudo nano /etc/nginx/sites-available/seudominio.com
```

Cole esta configuração:

```nginx
server {
    listen 80;
    server_name seudominio.com www.seudominio.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name seudominio.com www.seudominio.com;
    
    # SSL configurado pelo Certbot
    ssl_certificate /etc/letsencrypt/live/seudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seudominio.com/privkey.pem;
    
    # TLS 1.2+ (exigido pelo Stripe)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    
    # Proxy para aplicação Node.js
    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    
    # Webhook do Stripe (importante!)
    location /api/stripe/webhook {
        proxy_pass http://localhost:5000/api/stripe/webhook;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Ative o site e reinicie Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/seudominio.com /etc/nginx/sites-enabled/
sudo nginx -t  # Testar configuração
sudo systemctl reload nginx
```

---

## 7️⃣ TESTAR TUDO

### Testar SSL
```bash
curl -I https://seudominio.com
# Deve retornar: HTTP/2 200
```

### Testar aplicação
```bash
# Ver se está rodando
pm2 status

# Ver logs
pm2 logs chatbot --lines 100
```

### Testar Stripe Webhook
1. Acesse: https://dashboard.stripe.com/webhooks
2. Clique no seu webhook
3. Clique em "Send test webhook"
4. Selecione `checkout.session.completed`
5. Enviar
6. ✅ Deve retornar **200 OK**

---

## 8️⃣ BACKUP AUTOMÁTICO DO BANCO

```bash
# Criar script de backup
sudo nano /usr/local/bin/backup-chatbot-db.sh
```

Cole:

```bash
#!/bin/bash
BACKUP_DIR="/root/backups/chatbot"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

pg_dump -U seu_usuario_postgres chatbot_db > $BACKUP_DIR/chatbot_$DATE.sql

# Manter apenas últimos 7 backups
ls -t $BACKUP_DIR/*.sql | tail -n +8 | xargs rm -f
```

Tornar executável e agendar:

```bash
sudo chmod +x /usr/local/bin/backup-chatbot-db.sh

# Adicionar ao cron (todo dia às 3h da manhã)
sudo crontab -e
```

Adicione:
```
0 3 * * * /usr/local/bin/backup-chatbot-db.sh
```

---

## 9️⃣ MONITORAMENTO E LOGS

### Ver logs do Nginx
```bash
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### Ver logs da aplicação
```bash
pm2 logs chatbot --lines 100
```

### Monitorar recursos
```bash
pm2 monit
```

---

## 🔟 TROUBLESHOOTING

### Erro: "Gemini AI not configured"
✅ Verifique se `GEMINI_API_KEY` está no `.env`
✅ Reinicie a aplicação: `pm2 restart chatbot`

### Erro: "DATABASE_URL not found"
✅ Verifique se `DATABASE_URL` está no `.env`
✅ Teste conexão: `psql -U seu_usuario -d chatbot_db`

### Stripe webhook retorna erro
✅ Certifique-se que SSL está ativo (HTTPS)
✅ URL do webhook deve ser `https://...` (não `http://`)
✅ Verifique `STRIPE_WEBHOOK_SECRET` no `.env`

### WhatsApp não conecta
✅ Instale dependências do Chrome:
```bash
sudo apt install -y chromium-browser chromium-chromedriver
sudo apt install -y libgobject-2.0-0 libx11-xcb1 libxcomposite1 libxcursor1 libxdamage1 libxi6 libxtst6 libnss3 libcups2 libxss1 libxrandr2 libasound2 libpangocairo-1.0-0 libatk1.0-0 libatk-bridge2.0-0 libgtk-3-0
```

### Aplicação não inicia
```bash
# Ver erros completos
pm2 logs chatbot --err --lines 200
```

---

## ✅ CHECKLIST FINAL

- [ ] SSL configurado (HTTPS funcionando)
- [ ] `.env` criado com todas as chaves
- [ ] PostgreSQL rodando e database criado
- [ ] `npm run db:push` executado com sucesso
- [ ] `storage.ts` usando `DatabaseStorage`
- [ ] PM2 rodando a aplicação
- [ ] Nginx configurado e rodando
- [ ] Stripe webhook configurado e testado
- [ ] Backup automático agendado
- [ ] Firewall configurado (portas 80, 443, 5432)

---

## 📞 SUPORTE

Se algo não funcionar:
1. Verifique logs: `pm2 logs chatbot`
2. Teste SSL: https://www.ssllabs.com/ssltest/
3. Teste Stripe webhook no dashboard
4. Verifique conexão do banco: `psql -U usuario -d chatbot_db`

**✅ Seu sistema está pronto para produção!**
