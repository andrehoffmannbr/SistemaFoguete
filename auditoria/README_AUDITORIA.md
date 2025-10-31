# 📊 AUDITORIA DE DADOS - SISTEMA FOGUETE

## **Data:** 31 de Outubro de 2025
## **Status:** Fase 0 - Verificação Inicial (SOMENTE LEITURA)

---

## **🎯 OBJETIVO**

Mapear o estado atual do banco de dados ANTES de aplicar qualquer correção, identificando:
- Dados órfãos (FKs faltando)
- JSONB inválidos
- CPFs incorretos
- Oportunidades de otimização

---

## **📁 ARQUIVOS DA AUDITORIA**

### **01_verificacao_subscriptions.sql**
- Verifica integridade de `subscriptions`
- Identifica subscriptions órfãs (customer ou plan deletado)
- Prepara para adicionar Foreign Keys

### **02_verificacao_pix_charges.sql**
- Verifica `pix_charges` sem `customer_id`
- Identifica cobranças órfãs
- Mapeia estratégia de recuperação de dados

### **03_verificacao_jsonb.sql**
- Verifica estrutura de campos JSONB em todas tabelas
- Identifica dados inválidos que impediriam CHECK constraints
- Prioriza correções por criticidade

### **04_verificacao_cpf.sql**
- Verifica qualidade dos CPFs cadastrados
- Identifica CPFs inválidos (tamanho, sequências, caracteres)
- Prepara para validação de dígito verificador

### **05_verificacao_performance.sql**
- Analisa tamanho das tabelas
- Verifica índices existentes
- Identifica sequential scans (table scans)
- Recomenda índices para otimização

---

## **🚀 COMO EXECUTAR**

### **Opção 1: Via Supabase Dashboard (Recomendado)**

1. Acesse: https://app.supabase.com
2. Selecione seu projeto
3. Vá em: **SQL Editor**
4. Copie e cole o conteúdo de cada arquivo `.sql`
5. Clique em **Run**
6. Anote os resultados

### **Opção 2: Via psql (Linha de comando)**

```bash
# Conectar ao banco Supabase
psql "postgresql://postgres:[SUA-SENHA]@db.fjfeydaisukgftwcuygp.supabase.co:5432/postgres"

# Executar cada script
\i c:/Sistemafoguete/auditoria/01_verificacao_subscriptions.sql
\i c:/Sistemafoguete/auditoria/02_verificacao_pix_charges.sql
\i c:/Sistemafoguete/auditoria/03_verificacao_jsonb.sql
\i c:/Sistemafoguete/auditoria/04_verificacao_cpf.sql
\i c:/Sistemafoguete/auditoria/05_verificacao_performance.sql
```

---

## **📋 CHECKLIST DE EXECUÇÃO**

Execute os scripts nesta ordem e anote os resultados:

- [ ] **01_verificacao_subscriptions.sql**
  - Quantidade de subscriptions órfãas (customer): ______
  - Quantidade de subscriptions órfãas (plan): ______
  - ✅ Se ambos = 0: SEGURO para FK
  - ⚠️ Se > 0: PRECISA LIMPAR antes

- [ ] **02_verificacao_pix_charges.sql**
  - PIX sem customer_id: ______
  - PIX com customer deletado: ______
  - Podem ser recuperados via appointment: ______
  - Podem ser recuperados via subscription: ______
  - ✅ Se total = 0: SEGURO para NOT NULL
  - ⚠️ Se > 0: PRECISA POPULAR antes

- [ ] **03_verificacao_jsonb.sql**
  - subscription_plans com JSONB inválido: ______
  - business_settings com JSONB inválido: ______
  - proposals com JSONB inválido: ______
  - ✅ Se todos = 0: SEGURO para CHECK
  - ⚠️ Se > 0: PRECISA CORRIGIR antes

- [ ] **04_verificacao_cpf.sql**
  - CPFs com tamanho incorreto: ______
  - CPFs com sequências inválidas: ______
  - CPFs com caracteres estranhos: ______
  - Total de CPFs para limpar: ______
  - ✅ Se = 0: SEGURO para validação
  - ⚠️ Se > 0: PRECISA LIMPAR antes

- [ ] **05_verificacao_performance.sql**
  - Tabela maior: ______ (tamanho: ______)
  - Total de registros em appointments: ______
  - Total de seq_scans em appointments: ______
  - ℹ️ Se seq_scans alto: CONSIDERAR índices

---

## **📊 TEMPLATE DE RESULTADOS**

Copie este template e preencha com os resultados:

```
===========================================
RESULTADOS DA AUDITORIA - Sistema Foguete
Data: 31/10/2025
===========================================

1. SUBSCRIPTIONS
   - Total: ______
   - Órfãs (customer): ______
   - Órfãs (plan): ______
   - Status: [ ] ✅ OK para FK  [ ] ⚠️ Precisa limpar

2. PIX_CHARGES
   - Total: ______
   - Sem customer_id: ______
   - Customer deletado: ______
   - Status: [ ] ✅ OK para NOT NULL  [ ] ⚠️ Precisa popular

3. JSONB
   - Plans inválidos: ______
   - Settings inválidos: ______
   - Proposals inválidos: ______
   - Status: [ ] ✅ OK para CHECK  [ ] ⚠️ Precisa corrigir

4. CPF
   - Inválidos: ______
   - Status: [ ] ✅ OK para validação  [ ] ⚠️ Precisa limpar

5. PERFORMANCE
   - Maior tabela: ______
   - Índices faltando: ______
   - Status: [ ] ✅ Performance OK  [ ] ⚠️ Precisa otimizar

===========================================
DECISÃO: 
[ ] Prosseguir com correções (tudo OK)
[ ] Limpar dados primeiro (há problemas)
===========================================
```

---

## **⚠️ IMPORTANTE**

### **ESTES SCRIPTS SÃO 100% SEGUROS:**
- ✅ Somente fazem SELECT (leitura)
- ✅ NÃO alteram dados
- ✅ NÃO criam/deletam tabelas
- ✅ NÃO afetam sistema em produção
- ✅ Podem ser executados quantas vezes quiser

### **PRÓXIMOS PASSOS APÓS AUDITORIA:**
1. Analisar resultados
2. Decidir estratégia de limpeza (se necessário)
3. Criar scripts de correção personalizados
4. Aplicar correções em ordem segura
5. Validar após cada etapa

---

## **🆘 EM CASO DE DÚVIDA**

Se algum resultado parecer estranho ou preocupante:
1. ❌ **NÃO** execute correções ainda
2. ✅ **ANOTE** o resultado
3. ✅ **COMPARTILHE** para análise
4. ✅ **AGUARDE** orientação

**Lembre-se:** Melhor ser cauteloso do que apressado! 🐢💪

---

**Próxima Fase:** Fase 1 - Limpeza de Dados (se necessário)
