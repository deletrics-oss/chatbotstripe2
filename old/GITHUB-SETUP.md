# 📦 Como Exportar para GitHub

## 🔑 Usando Personal Access Token (PAT)

**IMPORTANTE:** Use seu GitHub Personal Access Token (PAT) para autenticação. 
**NUNCA** compartilhe ou comite seu PAT em repositórios públicos!

### Opção 1: Exportar via Replit UI (Recomendado)

1. Clique no ícone de "Git" no painel lateral esquerdo do Replit
2. Clique em "Connect to GitHub"  
3. Cole seu Personal Access Token quando solicitado
4. Selecione ou crie o repositório: `deletrics-oss/chatbotstripe2`
5. Clique em "Push to GitHub"

### Opção 2: Exportar via Shell (Manual)

Se preferir usar o terminal no Replit:

```bash
# 1. Configure o remote do GitHub
git remote add origin https://github.com/deletrics-oss/chatbotstripe2.git

# 2. Adicione todos os arquivos
git add .

# 3. Faça o commit
git commit -m "Deploy completo - Dashboard WhatsApp com auth local, porta 3035, Chromium Ubuntu"

# 4. Faça push usando seu PAT
# Substitua SEU_PAT_AQUI pelo seu token
git push https://SEU_PAT_AQUI@github.com/deletrics-oss/chatbotstripe2.git main
```

## 🚀 Após o Push para GitHub

### No seu servidor Ubuntu 22.04:

```bash
# 1. Clone o repositório
git clone https://github.com/deletrics-oss/chatbotstripe2.git
cd chatbotstripe2

# 2. Execute o script de deploy
chmod +x deploy.sh
./deploy.sh

# 3. Configure o .env com suas credenciais
nano .env

# 4. Instale o Chromium
sudo apt install chromium-browser

# 5. Verifique se tudo está rodando
pm2 status
pm2 logs chatbot-whatsapp
```

## 📝 Checklist Pós-Deploy

- [ ] Aplicação rodando na porta 3035
- [ ] PostgreSQL configurado e conectado
- [ ] Chromium instalado
- [ ] QR Code do WhatsApp aparecendo
- [ ] Login funcionando
- [ ] PM2 configurado para auto-start
- [ ] Backups automáticos configurados (opcional)
- [ ] Firewall configurado (opcional)
- [ ] Nginx + SSL configurado (opcional)

## 🔄 Atualizar Código no Servidor

Quando fizer mudanças no código e quiser atualizar no servidor:

```bash
cd chatbotstripe2
git pull origin main
npm install
npm run build
pm2 restart chatbot-whatsapp
```

## 🐛 Problemas Comuns

### "Permission denied" ao fazer push

Verifique se o PAT tem permissões de "repo" habilitadas no GitHub.

### "Repository not found"

Certifique-se de que o repositório existe em: https://github.com/deletrics-oss/chatbotstripe2

### Build falha no servidor

```bash
# Verificar versão do Node.js (deve ser 18+)
node -v

# Limpar node_modules e reinstalar
rm -rf node_modules package-lock.json
npm install
npm run build
```

---

**Importante:** Guarde seu PAT em local seguro! Ele dá acesso total ao seu repositório GitHub.
