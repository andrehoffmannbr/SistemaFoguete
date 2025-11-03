# 💳 Integração Mercado Pago - Guia Completo

## 📋 Visão Geral

O sistema **Foguete Gestão Empresarial** agora possui integração completa com o Mercado Pago para pagamentos via PIX. A integração permite:

- ✅ Gerar cobranças PIX com QR Code
- ✅ Receber confirmação automática de pagamento via webhook
- ✅ Atualizar transações financeiras automaticamente
- ✅ Marcar agendamentos como pagos
- ✅ Tracking completo do status de pagamento

---

## 🔧 Passo 1: Obter Credenciais do Mercado Pago

### 1.1 Criar Conta no Mercado Pago (se não tiver)
1. Acesse: https://www.mercadopago.com.br/
2. Clique em "Criar conta"
3. Complete o cadastro

### 1.2 Acessar o Painel de Desenvolvedores
1. Faça login na sua conta Mercado Pago
2. Acesse: https://www.mercadopago.com.br/developers/panel/app
3. Clique em "Criar aplicação" (se não tiver uma)
4. Dê um nome para sua aplicação: **"Foguete Gestão Empresarial"**
5. Selecione: **"Pagamentos online"** e **"Pagamentos presenciais"**

### 1.3 Obter Credenciais de TESTE
1. No painel da aplicação, clique em **"Credenciais de teste"**
2. Copie o **Access Token** (começa com `TEST-`)
3. Copie a **Public Key** (começa com `TEST-`)

⚠️ **Importante**: Use credenciais de TESTE para desenvolvimento!

### 1.4 Obter Credenciais de PRODUÇÃO (para produção)
1. Complete o processo de ativação da conta no Mercado Pago
2. No painel, clique em **"Credenciais de produção"**
3. Copie o **Access Token** (começa com `APP_USR-`)
4. Copie a **Public Key** (começa com `APP_USR-`)

---

## 🔐 Passo 2: Configurar Variáveis de Ambiente

### 2.1 Configurar no Arquivo `.env`

Edite o arquivo `.env` na raiz do projeto:

```bash
# Mercado Pago Configuration (TESTE)
VITE_MERCADO_PAGO_ACCESS_TOKEN=TEST-1234567890123456-123456-abcdef1234567890abcdef1234567890-123456789
VITE_MERCADO_PAGO_PUBLIC_KEY=TEST-abcdef12-3456-7890-abcd-ef1234567890
```

⚠️ **Substitua pelos seus tokens reais!**

### 2.2 Configurar no Supabase (Edge Functions)

As Edge Functions precisam acessar o token do Mercado Pago:

1. Acesse o Dashboard do Supabase: https://supabase.com/dashboard/project/sirkjzhohglvcwtruazq
2. Vá em **Settings → Edge Functions**
3. Clique em **"Add secret"**
4. Adicione:
   - **Name**: `MERCADO_PAGO_ACCESS_TOKEN`
   - **Value**: Seu Access Token do Mercado Pago

---

## 🌐 Passo 3: Configurar Webhook no Mercado Pago

O webhook permite que o Mercado Pago notifique nosso sistema quando um pagamento é confirmado.

### 3.1 Obter URL do Webhook

Sua URL do webhook Supabase é:
```
https://sirkjzhohglvcwtruazq.supabase.co/functions/v1/pix-webhook
```

### 3.2 Configurar no Painel do Mercado Pago

1. Acesse: https://www.mercadopago.com.br/developers/panel/app
2. Selecione sua aplicação
3. Vá em **"Webhooks"** no menu lateral
4. Clique em **"Configurar notificações"**
5. Configure:
   - **URL de produção**: `https://sirkjzhohglvcwtruazq.supabase.co/functions/v1/pix-webhook`
   - **Eventos**: Marque **"Pagamentos"** (Payments)
6. Clique em **"Salvar"**

### 3.3 Testar Webhook (Opcional)

O Mercado Pago oferece uma ferramenta de teste:
1. No painel de Webhooks, clique em **"Testar"**
2. Envie um evento de teste
3. Verifique nos logs do Supabase se o webhook foi recebido

---

## 📦 Passo 4: Deploy das Edge Functions

As Edge Functions precisam estar deployadas no Supabase.

### 4.1 Instalar Supabase CLI (se não tiver)

```powershell
# Windows (PowerShell como Administrador)
scoop install supabase
```

Ou baixe em: https://github.com/supabase/cli/releases

### 4.2 Fazer Login no Supabase

```powershell
supabase login
```

### 4.3 Linkar ao Projeto

```powershell
supabase link --project-ref sirkjzhohglvcwtruazq
```

### 4.4 Deploy das Funções

```powershell
# Deploy da função generate-pix
supabase functions deploy generate-pix

# Deploy da função pix-webhook
supabase functions deploy pix-webhook
```

---

## 🧪 Passo 5: Testar a Integração

### 5.1 Testar Localmente (Modo Mock)

Se você NÃO configurou as credenciais, o sistema funciona em modo MOCK:

1. Execute o sistema: `npm run dev`
2. Faça login
3. Vá em **Propostas** ou **Agendamentos**
4. Tente gerar um pagamento PIX
5. Você verá uma mensagem: **"PIX gerado em modo de demonstração"**
6. Um QR Code mock será exibido

### 5.2 Testar com Credenciais Reais (TESTE)

1. Configure as credenciais de TEST no `.env`
2. Configure o secret no Supabase
3. Reinicie o servidor: `npm run dev`
4. Gere um pagamento PIX
5. O QR Code **real** do Mercado Pago será exibido

### 5.3 Testar Pagamento com Usuário de Teste

O Mercado Pago oferece usuários de teste para simular pagamentos:

1. Acesse: https://www.mercadopago.com.br/developers/panel/app
2. Vá em **"Usuários de teste"**
3. Crie um usuário de teste **"Vendedor"** e um **"Comprador"**
4. Use o QR Code gerado no app de teste
5. Confirme o pagamento
6. O webhook será chamado automaticamente
7. O status no sistema mudará para **"Pago"** ✅

---

## 📱 Passo 6: Usar no Sistema

### 6.1 Gerar PIX em Propostas

```typescript
// Exemplo de uso no componente Propostas.tsx
import { usePixPayment } from "@/hooks/usePixPayment";
import { PixPaymentDialog } from "@/components/PixPaymentDialog";

const { generatePixCharge, pixCharge } = usePixPayment();
const [pixDialogOpen, setPixDialogOpen] = useState(false);

// Gerar PIX para entrada da proposta
const handleGenerateDepositPix = async (proposal) => {
  const charge = await generatePixCharge({
    amount: proposal.deposit_amount,
    customerName: proposal.customers.name,
    customerPhone: proposal.customers.phone,
    description: `Entrada - ${proposal.title}`,
    proposalId: proposal.id
  });
  
  if (charge) {
    setPixDialogOpen(true);
  }
};

// Exibir dialog com QR Code
<PixPaymentDialog
  open={pixDialogOpen}
  onOpenChange={setPixDialogOpen}
  pixCharge={pixCharge}
  onPaymentConfirmed={() => {
    // Recarregar dados após pagamento
    fetchProposals();
  }}
/>
```

### 6.2 Gerar PIX em Agendamentos

```typescript
// Exemplo de uso no componente Agendamentos.tsx
const handleGeneratePaymentPix = async (appointment) => {
  const charge = await generatePixCharge({
    amount: appointment.price,
    customerName: appointment.customers.name,
    customerPhone: appointment.customers.phone,
    description: `Agendamento - ${appointment.title}`,
    appointmentId: appointment.id
  });
  
  if (charge) {
    setPixDialogOpen(true);
  }
};
```

---

## 🔍 Monitoramento e Logs

### 7.1 Ver Logs das Edge Functions

```powershell
# Ver logs da função generate-pix
supabase functions logs generate-pix

# Ver logs da função pix-webhook
supabase functions logs pix-webhook
```

### 7.2 Ver Pagamentos no Dashboard do Mercado Pago

1. Acesse: https://www.mercadopago.com.br/activities
2. Veja todos os pagamentos recebidos
3. Filtre por status, data, etc.

### 7.3 Consultar no Banco de Dados

```sql
-- Ver todas as cobranças PIX
SELECT * FROM pix_charges ORDER BY created_at DESC;

-- Ver cobranças pendentes
SELECT * FROM pix_charges WHERE status = 'pending';

-- Ver cobranças pagas
SELECT * FROM pix_charges WHERE status = 'paid';

-- Ver transações financeiras relacionadas
SELECT 
  pc.*,
  ft.status as transaction_status,
  ft.amount as transaction_amount
FROM pix_charges pc
LEFT JOIN financial_transactions ft ON pc.transaction_id = ft.id
ORDER BY pc.created_at DESC;
```

---

## 🚀 Passo 7: Produção

### 7.1 Checklist Antes de Ir para Produção

- [ ] Credenciais de PRODUÇÃO configuradas (não TEST)
- [ ] Webhook configurado com URL de produção
- [ ] Edge Functions deployadas
- [ ] Secrets configurados no Supabase
- [ ] Testado com pagamento real
- [ ] Conta do Mercado Pago ativada e verificada

### 7.2 Trocar de Teste para Produção

1. No `.env`, substitua credenciais TEST por PRODUÇÃO:
```bash
VITE_MERCADO_PAGO_ACCESS_TOKEN=APP_USR-1234567890123456-123456-abcdef1234567890-123456789
VITE_MERCADO_PAGO_PUBLIC_KEY=APP_USR-abcdef12-3456-7890-abcd-ef1234567890
```

2. No Supabase, atualize o secret:
   - Vá em **Settings → Edge Functions**
   - Edite `MERCADO_PAGO_ACCESS_TOKEN`
   - Cole o token de PRODUÇÃO

3. Faça redeploy das Edge Functions:
```powershell
supabase functions deploy generate-pix
supabase functions deploy pix-webhook
```

4. Teste com um pagamento real de valor baixo (R$ 0,01)

---

## 🆘 Troubleshooting

### Erro: "Mercado Pago não configurado, usando modo MOCK"

**Causa**: `MERCADO_PAGO_ACCESS_TOKEN` não está configurado no Supabase.

**Solução**:
1. Vá em: https://supabase.com/dashboard/project/sirkjzhohglvcwtruazq/settings/functions
2. Adicione o secret `MERCADO_PAGO_ACCESS_TOKEN`
3. Redeploy a função: `supabase functions deploy generate-pix`

### Erro: "Error fetching payment from Mercado Pago"

**Causa**: Token inválido ou expirado.

**Solução**:
1. Verifique se o token está correto no painel do Mercado Pago
2. Regenere o token se necessário
3. Atualize no Supabase

### Webhook não está sendo chamado

**Causa**: URL do webhook incorreta ou não configurada.

**Solução**:
1. Verifique a URL no painel do Mercado Pago
2. Teste manualmente:
```powershell
curl -X POST https://sirkjzhohglvcwtruazq.supabase.co/functions/v1/pix-webhook \
  -H "Content-Type: application/json" \
  -d '{"type":"payment","data":{"id":"123456"}}'
```

### Status do pagamento não atualiza

**Causa**: Webhook não está processando corretamente.

**Solução**:
1. Verifique os logs: `supabase functions logs pix-webhook`
2. Verifique se o `txid` na tabela `pix_charges` corresponde ao ID do pagamento no Mercado Pago

---

## 📚 Recursos Adicionais

- **Documentação Mercado Pago**: https://www.mercadopago.com.br/developers/pt/docs
- **API de Pagamentos**: https://www.mercadopago.com.br/developers/pt/reference/payments/_payments/post
- **Webhooks**: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
- **Supabase Edge Functions**: https://supabase.com/docs/guides/functions

---

## ✅ Conclusão

A integração com Mercado Pago está completa e pronta para uso! Siga os passos deste guia para configurar e testar.

**Modo de Operação**:
- ✅ **Sem credenciais**: Modo MOCK (demonstração)
- ✅ **Com credenciais TEST**: Ambiente de testes do Mercado Pago
- ✅ **Com credenciais PRODUÇÃO**: Pagamentos reais

**Próximos Passos Recomendados**:
1. Testar em modo TEST
2. Validar webhook
3. Integrar em mais pontos do sistema (assinaturas recorrentes)
4. Adicionar notificações WhatsApp após pagamento

🚀 **Sistema pronto para receber pagamentos via PIX!**
