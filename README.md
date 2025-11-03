# 🚀 Foguete Gestão Empresarial

Sistema completo de ERP para gestão empresarial com foco em agendamentos, vendas, financeiro, estoque e relacionamento com clientes.

## 🎯 Funcionalidades

- ✅ **Agendamentos**: Sistema completo de agendamento com calendário
- ✅ **Clientes**: Gestão de clientes com histórico e fidelização
- ✅ **Financeiro**: Controle de receitas e despesas
- ✅ **Propostas**: Criação e acompanhamento de orçamentos
- ✅ **Estoque**: Controle de inventário e movimentações
- ✅ **Assinaturas**: Planos recorrentes e gestão de mensalidades
- ✅ **Tarefas**: Sistema de follow-up automatizado
- ✅ **PIX**: Integração para cobranças via PIX
- ✅ **Fidelidade**: Programa de pontos e cupons

## 🛠️ Tecnologias

- **Frontend**: React 18 + TypeScript + Vite
- **UI**: Tailwind CSS + ShadCN UI + Radix UI
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts
- **Icons**: Lucide React
- **Date**: date-fns + React Day Picker

## 📋 Pré-requisitos

- Node.js 18+ instalado
- Conta no Supabase (configurada)
- Editor de código (VS Code recomendado)

## 🚀 Instalação e Execução

### 1. Instale as dependências

```powershell
npm install
```

### 2. Execute o projeto

```powershell
npm run dev
```

O sistema estará disponível em: **http://localhost:8080**

## 🔌 Conexão com Banco de Dados

### Via SQLTools no VS Code:

1. Pressione `Ctrl+Shift+P`
2. Digite: **SQLTools: Connect**
3. Selecione: **Supabase - Foguete Gestão**
4. Digite a senha do banco quando solicitado

### Acesso direto ao Supabase:

- Dashboard: https://supabase.com/dashboard/project/sirkjzhohglvcwtruazq
- SQL Editor disponível no dashboard

## 📊 Estrutura do Banco de Dados

O banco possui 19 tabelas principais:

### Core
- `business_settings` - Configurações do negócio
- `customers` - Clientes
- `appointments` - Agendamentos
- `blocked_slots` - Horários bloqueados

### Financeiro
- `financial_categories` - Categorias financeiras
- `financial_transactions` - Transações financeiras
- `pix_charges` - Cobranças PIX

### Relacionamento com Cliente
- `reviews` - Avaliações
- `coupons` - Cupons de desconto
- `loyalty_cards` - Cartões fidelidade
- `loyalty_stamps` - Carimbos de fidelidade

### Vendas
- `proposals` - Propostas/Orçamentos

### Assinaturas
- `subscription_plans` - Planos de assinatura
- `subscriptions` - Assinaturas ativas
- `subscription_usage` - Uso de assinaturas

### Operacional
- `tasks` - Tarefas e follow-ups
- `inventory_items` - Itens de estoque
- `stock_movements` - Movimentações de estoque
- `notification_views` - Visualizações de notificações

## 🔐 Segurança

- ✅ Row Level Security (RLS) ativado em todas as tabelas
- ✅ Autenticação via Supabase Auth
- ✅ Políticas de acesso por usuário
- ✅ Dados isolados por user_id

## 🎨 Comandos de Desenvolvimento

```powershell
npm run dev         # Inicia servidor de desenvolvimento
npm run build       # Build para produção
npm run preview     # Preview do build de produção
npm run lint        # Verifica erros de código
```

## 📁 Estrutura do Projeto

```
src/
├── components/           # Componentes React
│   ├── ui/              # Componentes base (ShadCN UI)
│   ├── AppSidebar.tsx   # Menu lateral
│   ├── Layout.tsx       # Layout principal
│   └── ...              # Componentes específicos
├── pages/               # Páginas da aplicação
│   ├── Auth.tsx        # Login/Registro
│   ├── Dashboard.tsx   # Dashboard principal
│   ├── Clientes.tsx    # Gestão de clientes
│   ├── Agendamentos.tsx # Agendamentos
│   ├── Financeiro.tsx  # Controle financeiro
│   ├── Estoque.tsx     # Gestão de estoque
│   └── ...             # Outras páginas
├── integrations/        # Integrações externas
│   └── supabase/       # Cliente e tipos Supabase
├── hooks/              # Custom React hooks
└── lib/                # Utilitários e helpers
```

## 🌐 Deploy para Produção

### Vercel (Recomendado)

1. Instale o Vercel CLI:
   ```powershell
   npm i -g vercel
   ```

2. Execute o deploy:
   ```powershell
   vercel
   ```

3. Siga as instruções no terminal

### Variáveis de Ambiente

As credenciais já estão configuradas no código. Para alterar:

Edite `src/integrations/supabase/client.ts`:
```typescript
const SUPABASE_URL = "sua_url_aqui";
const SUPABASE_PUBLISHABLE_KEY = "sua_chave_aqui";
```

## 📈 Próximas Funcionalidades

- [ ] Integração com Mercado Pago
- [ ] Envio de mensagens WhatsApp
- [ ] Relatórios em PDF
- [ ] Dashboard de métricas avançadas
- [ ] App mobile (React Native)
- [ ] Backup automático

## 🐛 Solução de Problemas

### Erro de conexão com Supabase
- Verifique se as credenciais estão corretas
- Teste a conexão via dashboard do Supabase

### Erro ao instalar dependências
```powershell
rm -rf node_modules package-lock.json
npm install
```

### Erro ao executar o projeto
- Certifique-se que a porta 8080 está livre
- Tente: `npm run dev -- --port 3000`

## 📞 Suporte

Para dúvidas ou problemas técnicos:
1. Verifique os logs do console do navegador
2. Verifique os logs do Supabase
3. Consulte a documentação oficial das tecnologias

## 📝 Documentação Adicional

- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/)
- [Supabase](https://supabase.com/docs)
- [TailwindCSS](https://tailwindcss.com/)
- [ShadCN UI](https://ui.shadcn.com/)

---

**🚀 Desenvolvido para revolucionar a gestão empresarial**

*Sistema pronto para deploy e uso em produção*
