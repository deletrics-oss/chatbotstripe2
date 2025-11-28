# Guia de Instalação no Ubuntu

## Pré-requisitos

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Instalar dependências do Puppeteer (necessário para scraping de sites)
sudo apt install -y \
  chromium-browser \
  libx11-xcb1 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxi6 \
  libxtst6 \
  libnss3 \
  libcups2 \
  libxss1 \
  libxrandr2 \
  libasound2 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libpangocairo-1.0-0 \
  libgtk-3-0 \
  libgbm1

# Instalar Git (se ainda não tiver)
sudo apt install -y git
```

## Instalação do Projeto

```bash
# 1. Navegar até a pasta do projeto
cd /caminho/para/chatbotstripe2/chatbotstripe2

# 2. Instalar dependências
npm install

# 3. Configurar variáveis de ambiente
# Editar o arquivo .env com suas chaves do Stripe e Gemini
nano .env
```

## Configuração do .env

Certifique-se de que o arquivo `.env` contém:

```env
PORT=3025
GEMINI_API_KEY=sua_chave_aqui
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_BASIC=price_...
STRIPE_PRICE_FULL=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Executar o Projeto

### Modo Desenvolvimento

```bash
npm run dev
```

O servidor estará disponível em: http://localhost:3025

### Modo Produção

```bash
# 1. Compilar o projeto
npm run build

# 2. Executar
npm start
```

## Executar como Serviço (Systemd)

Para manter o servidor rodando permanentemente:

```bash
# 1. Criar arquivo de serviço
sudo nano /etc/systemd/system/chatbotstripe.service
```

Cole o seguinte conteúdo:

```ini
[Unit]
Description=ChatBot Stripe Server
After=network.target

[Service]
Type=simple
User=seu_usuario
WorkingDirectory=/caminho/completo/para/chatbotstripe2/chatbotstripe2
Environment="NODE_ENV=production"
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# 2. Recarregar daemon
sudo systemctl daemon-reload

# 3. Habilitar e iniciar o serviço
sudo systemctl enable chatbotstripe
sudo systemctl start chatbotstripe

# 4. Verificar status
sudo systemctl status chatbotstripe

# 5. Ver logs
sudo journalctl -u chatbotstripe -f
```

## Configurar Firewall (UFW)

```bash
# Permitir tráfego na porta 3025
sudo ufw allow 3025/tcp

# Verificar status
sudo ufw status
```

## Nginx como Proxy Reverso (Opcional)

Se quiser usar um domínio e HTTPS:

```bash
# 1. Instalar Nginx
sudo apt install -y nginx

# 2. Criar configuração
sudo nano /etc/nginx/sites-available/chatbot
```

Cole:

```nginx
server {
    listen 80;
    server_name seu_dominio.com;

    location / {
        proxy_pass http://localhost:3025;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# 3. Ativar site
sudo ln -s /etc/nginx/sites-available/chatbot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# 4. Instalar SSL com Certbot (HTTPS grátis)
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d seu_dominio.com
```

## Solução de Problemas

### Erro: "chromium-browser not found"

```bash
# Configurar variável de ambiente para Puppeteer
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
# Ou adicione ao .bashrc:
echo 'export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser' >> ~/.bashrc
```

### Erro: "Permission denied" no WhatsApp

```bash
# Dar permissões à pasta de dados
chmod -R 755 server/data
```

### Porta 3025 já em uso

```bash
# Encontrar processo usando a porta
sudo lsof -i :3025

# Matar o processo (substitua PID pelo número mostrado)
sudo kill -9 PID
```

## Monitoramento

```bash
# Ver logs em tempo real
sudo journalctl -u chatbotstripe -f

# Ver logs do npm (modo dev)
# Os logs aparecem diretamente no terminal onde você executou npm run dev

# Verificar uso de memória
free -h
htop
```

## Backup dos Dados

```bash
# Fazer backup da pasta de dados (contém DB JSON e sessões WhatsApp)
tar -czf backup-$(date +%Y%m%d).tar.gz server/data/

# Restaurar backup
tar -xzf backup-20250128.tar.gz
```

## Atualização do Projeto

```bash
# 1. Parar o serviço
sudo systemctl stop chatbotstripe

# 2. Fazer backup
tar -czf backup-antes-update-$(date +%Y%m%d).tar.gz server/data/

# 3. Atualizar código (se usar git)
git pull

# 4. Reinstalar dependências (se houve mudanças)
npm install

# 5. Recompilar
npm run build

# 6. Reiniciar serviço
sudo systemctl start chatbotstripe
```

## Checklist de Verificação

- [ ] Node.js 20+ instalado
- [ ] Dependências do Puppeteer instaladas
- [ ] Arquivo .env configurado com todas as chaves
- [ ] npm install executado sem erros
- [ ] Porta 3025 liberada no firewall
- [ ] Servidor iniciado com sucesso
- [ ] Consegue acessar http://localhost:3025
- [ ] Login funciona corretamente
- [ ] Promoção a Admin funciona (código: admin123)

## Comandos Úteis

```bash
# Verificar versão do Node
node --version  # Deve ser 20.x ou superior

# Verificar status do serviço
sudo systemctl status chatbotstripe

# Reiniciar serviço
sudo systemctl restart chatbotstripe

# Ver logs em tempo real
sudo journalctl -u chatbotstripe -f

# Testar TypeScript
npm run check

# Limpar caches
rm -rf node_modules package-lock.json
npm install
```
