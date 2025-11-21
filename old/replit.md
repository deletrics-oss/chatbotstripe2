# ChatBot Host SaaS Platform

## Visão Geral
Plataforma SaaS completa multi-tenant para hospedagem de chatbots WhatsApp com três tiers de assinatura:
- **Free (Trial)**: 1 mês gratuito com acesso completo, 1 device, 1 lógica
- **Básico (R$29.90/mês)**: Editor JSON de lógicas, 2 devices, lógicas ilimitadas
- **Full (R$99/mês)**: Todas as funcionalidades + IA Gemini avançada, devices ilimitados

## Arquitetura do Sistema

### Frontend (React + TypeScript + Vite)
- **Landing Page**: Hero section, features, pricing comparison
- **Dashboard**: Métricas em tempo real, resumo de conversas
- **Devices**: Gerenciamento de dispositivos WhatsApp com QR Code
- **Chat**: Interface de mensagens em tempo real com WebSocket
- **Logic Editor**: Editor Monaco para lógicas JSON com syntax highlighting
- **Billing**: Planos Stripe com upgrade flow
- **Settings**: Configurações de usuário e conta

### Backend (Express + TypeScript)
- **Auth**: Replit Auth com multi-tenant support
- **Database**: PostgreSQL (Neon) com Drizzle ORM
- **Payments**: Stripe Checkout + Webhooks para assinaturas
- **WhatsApp**: Endpoints para conexão, QR code, envio/recebimento mensagens
- **Real-time**: WebSocket para chat ao vivo
- **AI**: Integração Gemini 2.0 para geração de lógicas (plano Full only)

## Database Schema

### users
- id, email, firstName, lastName, profileImageUrl
- stripeCustomerId, stripeSubscriptionId
- currentPlan ('free', 'basic', 'full')
- planExpiresAt

### whatsapp_devices  
- id, userId, name, phoneNumber
- connectionStatus, qrCode, lastConnectedAt

### conversations
- id, deviceId, contactName, contactPhone
- lastMessageAt, unreadCount, isActive

### messages
- id, conversationId, direction, content
- isFromBot, timestamp

### logic_configs
- id, userId, deviceId, name, description
- **logicType** ('json', 'ai') - determina se usa AI
- logicJson, isActive, isTemplate

### knowledge_base
- id, userId, title, content, category

## Feature Flags por Plano

### Free Plan (Trial 1 Mês)
- 1 WhatsApp device
- 1 lógica JSON
- Chat básico
- Acesso a todas as features por 1 mês

### Basic Plan (R$29.90/mês)
- 2 WhatsApp devices
- Lógicas JSON ilimitadas
- Editor JSON completo
- **SEM** acesso a IA Gemini

### Full Plan (R$99/mês)
- Devices ilimitados
- Lógicas ilimitadas (JSON + AI)
- **Gemini AI** para geração automática de lógicas
- Chatbot com comportamentos IA avançados

## Enforcement Server-Side

### Logic CRUD
✅ POST /api/logics - Valida logicType, bloqueia 'ai' para não-Full
✅ PATCH /api/logics/:id - Verifica logicType final, enforces Full para 'ai'
✅ GET /api/logics/:id - Ownership verification
✅ DELETE /api/logics/:id - Ownership verification

### AI Endpoints
✅ POST /api/ai/generate-logic - Requer plano Full

### Device Management
✅ POST /api/devices - Check plan limits antes de criar
✅ POST /api/devices/:id/reconnect - Auth + ownership required

## Integrations Configuradas

### Replit Auth
- Autenticação automática via OAuth
- Multi-tenant support
- Session management

### Stripe
- Checkout Sessions para upgrade
- Webhooks para sincronização de subscriptions
- **⚠️ Produção**: Configurar STRIPE_PRICE_BASIC e STRIPE_PRICE_FULL env vars

### Gemini AI
- Model: gemini-2.0-flash-exp
- Geração de lógicas JSON a partir de prompts
- **⚠️ Produção**: Configurar GEMINI_API_KEY

### Firebase (Preparado para Deploy)
- Hosting para frontend
- Functions para backend
- **⚠️ Configurar**: VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID

## Environment Variables Necessárias

### Desenvolvimento (já configuradas)
- DATABASE_URL - PostgreSQL connection
- SESSION_SECRET - Express sessions
- PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE

### Produção (configurar antes de deploy)
- **GEMINI_API_KEY** - Google AI Studio
- **STRIPE_SECRET_KEY** - Stripe Dashboard
- **VITE_STRIPE_PUBLIC_KEY** - Stripe publishable key
- **STRIPE_PRICE_BASIC** - Stripe Price ID para plano Básico
- **STRIPE_PRICE_FULL** - Stripe Price ID para plano Full
- **VITE_FIREBASE_API_KEY** - Firebase Console
- **VITE_FIREBASE_PROJECT_ID** - Firebase Console
- **VITE_FIREBASE_APP_ID** - Firebase Console

## Limitações Conhecidas & Next Steps

### MVP Scope (Implementado)
✅ Multi-tenant authentication
✅ 3-tier subscription system com feature flags
✅ WhatsApp device management com QR code
✅ Chat interface com WebSocket
✅ JSON logic editor com Monaco
✅ Gemini AI integration (Full plan only)
✅ Stripe billing integration
✅ Server-side plan enforcement

### Para Produção Completa
- [ ] Validação profunda de conteúdo logicJson para prevenir bypass de feature flags
- [ ] Implementação real de WhatsApp Business API (atualmente mock)
- [ ] Execução de chatbot com lógicas salvas
- [ ] Rate limiting e throttling de API
- [ ] Monitoring e alertas (Sentry, DataDog)
- [ ] Testes E2E completos de todos os fluxos
- [ ] CI/CD pipeline para Firebase
- [ ] Documentação de API completa
- [ ] Admin dashboard para suporte

## Como Rodar

```bash
# Instalar dependências (já feito via packager)
npm install

# Push schema para database
npm run db:push

# Iniciar servidor (já configurado no workflow)
npm run dev
```

Server roda em http://localhost:5000

## Estrutura de Arquivos

```
/client/src
  /pages - Todas as páginas da aplicação
  /components - Componentes reutilizáveis
  /hooks - Custom hooks (useAuth)
  /lib - Utilities (queryClient, utils)

/server
  routes.ts - Todos os endpoints da API
  storage.ts - Interface de armazenamento
  db.ts - Drizzle DB client
  replitAuth.ts - Configuração auth
  
/shared
  schema.ts - Tipos e schemas compartilhados

design_guidelines.md - Especificações de design
```

## Última Atualização
21 de Novembro de 2025

## Status
✅ MVP Completo e Funcional
🚀 Pronto para configurar APIs e fazer deploy Firebase
