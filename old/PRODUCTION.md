# 📚 Documentação de Produção

Guia completo para manutenção e operação do Chatbot WhatsApp em produção.

## 🔄 Backup e Restore

### Backup Automático do Banco de Dados

Crie um script de backup automático:

```bash
# Criar diretório de backups
mkdir -p ~/backups/chatbot-whatsapp

# Criar script de backup
nano ~/backup-chatbot.sh
```

Adicione o seguinte conteúdo:

```bash
#!/bin/bash
BACKUP_DIR="$HOME/backups/chatbot-whatsapp"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="chatbot_whatsapp"
DB_USER="chatbot_user"

# Criar backup
pg_dump -U $DB_USER $DB_NAME > "$BACKUP_DIR/backup_$TIMESTAMP.sql"

# Manter apenas últimos 30 backups
ls -t "$BACKUP_DIR"/backup_*.sql | tail -n +31 | xargs rm -f

echo "Backup criado: backup_$TIMESTAMP.sql"
```

```bash
# Tornar executável
chmod +x ~/backup-chatbot.sh

# Adicionar ao crontab (backup diário às 3h)
crontab -e
```

Adicione a linha:
```
0 3 * * * ~/backup-chatbot.sh >> ~/backups/chatbot-whatsapp/backup.log 2>&1
```

### Restaurar Backup

```bash
# Parar aplicação
pm2 stop chatbot-whatsapp

# Restaurar banco
psql -U chatbot_user chatbot_whatsapp < ~/backups/chatbot-whatsapp/backup_20250120_030000.sql

# Reiniciar aplicação
pm2 restart chatbot-whatsapp
```

## 📊 Monitoramento de Logs

### Logs do PM2

```bash
# Ver todos os logs em tempo real
pm2 logs chatbot-whatsapp

# Ver apenas erros
pm2 logs chatbot-whatsapp --err

# Ver apenas saída padrão
pm2 logs chatbot-whatsapp --out

# Ver últimas 100 linhas
pm2 logs chatbot-whatsapp --lines 100

# Limpar logs
pm2 flush chatbot-whatsapp
```

### Logs do PostgreSQL

```bash
# Ver logs do PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-14-main.log

# Buscar erros
sudo grep "ERROR" /var/log/postgresql/postgresql-14-main.log
```

### Rotação de Logs

O PM2 já faz rotação automática, mas você pode configurar:

```bash
# Instalar módulo de rotação
pm2 install pm2-logrotate

# Configurar tamanho máximo (10MB)
pm2 set pm2-logrotate:max_size 10M

# Manter apenas 7 dias de logs
pm2 set pm2-logrotate:retain 7

# Comprimir logs antigos
pm2 set pm2-logrotate:compress true
```

## 🚨 Troubleshooting Comum

### 1. Aplicação não inicia

```bash
# Verificar logs de erro
pm2 logs chatbot-whatsapp --err

# Verificar se porta está em uso
sudo lsof -i :3035

# Testar build manualmente
npm run build

# Verificar variáveis de ambiente
cat .env | grep -v "SECRET\|KEY"
```

### 2. QR Code não aparece no WhatsApp

```bash
# Verificar se Chromium está instalado
which chromium-browser

# Testar Chromium
chromium-browser --version

# Verificar variável de ambiente
cat .env | grep PUPPETEER_EXECUTABLE_PATH

# Verificar logs do WhatsApp
pm2 logs chatbot-whatsapp | grep -i "whatsapp\|qr"

# Limpar cache do WhatsApp
rm -rf .wwebjs_auth/
pm2 restart chatbot-whatsapp
```

### 3. Banco de Dados desconectado

```bash
# Verificar status do PostgreSQL
sudo systemctl status postgresql

# Reiniciar PostgreSQL
sudo systemctl restart postgresql

# Testar conexão
psql -U chatbot_user -d chatbot_whatsapp -h localhost

# Verificar DATABASE_URL no .env
cat .env | grep DATABASE_URL
```

### 4. Alta utilização de memória

```bash
# Ver consumo de memória
pm2 monit

# Reiniciar aplicação
pm2 restart chatbot-whatsapp

# Aumentar limite de memória no ecosystem.config.js
# max_memory_restart: '2G'
```

### 5. Stripe webhook não funciona

```bash
# Verificar logs
pm2 logs chatbot-whatsapp | grep -i "stripe\|webhook"

# Testar endpoint manualmente
curl -X POST http://localhost:3035/api/stripe/webhook \
  -H "Content-Type: application/json" \
  -d '{"type":"test"}'

# Verificar chave Stripe
cat .env | grep STRIPE
```

## 🔧 Manutenção Regular

### Atualizar Dependências

```bash
# Verificar updates disponíveis
npm outdated

# Atualizar dependências (cuidado!)
npm update

# Rebuild e restart
npm run build
pm2 restart chatbot-whatsapp
```

### Limpar Dados Antigos

```bash
# Limpar sessões WhatsApp inativas
rm -rf .wwebjs_auth/*-disconnected/

# Limpar logs antigos
pm2 flush chatbot-whatsapp

# Limpar cache npm
npm cache clean --force
```

### Otimização do Banco de Dados

```bash
# Conectar ao banco
psql -U chatbot_user chatbot_whatsapp

# Executar dentro do psql:
VACUUM ANALYZE;
REINDEX DATABASE chatbot_whatsapp;
\q
```

## 📈 Métricas e Performance

### Monitoramento com PM2

```bash
# Dashboard interativo
pm2 monit

# Ver métricas
pm2 show chatbot-whatsapp

# Histórico de CPU/memória
pm2 describe chatbot-whatsapp
```

### Monitoramento de Disco

```bash
# Espaço em disco
df -h

# Tamanho do banco de dados
sudo -u postgres psql -c "SELECT pg_size_pretty(pg_database_size('chatbot_whatsapp'));"

# Tamanho dos logs
du -sh logs/
```

## 🔐 Segurança em Produção

### Checklist de Segurança

- [ ] SESSION_SECRET alterado para valor aleatório forte
- [ ] HTTPS configurado (Nginx + Certbot)
- [ ] Firewall configurado (apenas portas necessárias)
- [ ] Banco de dados com senha forte
- [ ] Backups automatizados configurados
- [ ] Logs rotacionados
- [ ] Sistema atualizado regularmente
- [ ] .env não commitado no Git

### Hardening do PostgreSQL

Edite `/etc/postgresql/14/main/postgresql.conf`:

```ini
# Permitir apenas conexões locais
listen_addresses = 'localhost'

# Limitar conexões
max_connections = 100

# Logging
logging_collector = on
log_directory = '/var/log/postgresql'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
```

Reinicie PostgreSQL:
```bash
sudo systemctl restart postgresql
```

### Firewall (UFW)

```bash
# Bloquear tudo por padrão
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Permitir SSH
sudo ufw allow 22

# Permitir aplicação
sudo ufw allow 3035

# Permitir HTTP/HTTPS (se usar Nginx)
sudo ufw allow 80
sudo ufw allow 443

# Ativar firewall
sudo ufw enable

# Verificar status
sudo ufw status verbose
```

## 🚀 Deploy de Atualizações

```bash
# 1. Fazer backup do banco
~/backup-chatbot.sh

# 2. Puxar código atualizado
git pull origin main

# 3. Instalar novas dependências
npm install

# 4. Rebuild
npm run build

# 5. Rodar migrations (se houver)
npm run db:push

# 6. Reiniciar aplicação
pm2 restart chatbot-whatsapp

# 7. Verificar se está rodando
pm2 status
pm2 logs chatbot-whatsapp --lines 50
```

## 📞 Comandos Úteis

```bash
# Status geral
pm2 status && sudo systemctl status postgresql

# Logs em tempo real
pm2 logs chatbot-whatsapp --lines 100

# Reiniciar tudo
pm2 restart all && sudo systemctl restart postgresql

# Ver uso de recursos
htop

# Espaço em disco
df -h

# Tamanho dos diretórios
du -sh */ | sort -hr | head -10
```

## 🆘 Recuperação de Desastres

### Aplicação travou

```bash
pm2 stop chatbot-whatsapp
pm2 delete chatbot-whatsapp
pm2 start ecosystem.config.js
```

### Banco de dados corrompido

```bash
# Restaurar último backup
cd ~/backups/chatbot-whatsapp
ls -lt backup_*.sql | head -1
psql -U chatbot_user chatbot_whatsapp < backup_[DATA].sql
pm2 restart chatbot-whatsapp
```

### Servidor sem espaço em disco

```bash
# Limpar logs
pm2 flush
sudo journalctl --vacuum-time=7d

# Limpar cache
npm cache clean --force
rm -rf node_modules
npm install

# Limpar backups antigos
find ~/backups -type f -mtime +30 -delete
```

---

**Mantenha esta documentação atualizada conforme adicionar novos recursos ou procedimentos!**
