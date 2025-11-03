# 🚀 SETUP COMPLETO - SISTEMA FOGUETE

## **Data:** 31 de Outubro de 2025
## **Objetivo:** Migrar projeto da conta do sócio para sua infraestrutura completa

---

## **📊 STATUS ATUAL DO AMBIENTE**

### ✅ **O QUE JÁ ESTÁ FUNCIONANDO:**
- ✅ Git instalado (v2.48.1)
- ✅ Node.js instalado (v22.15.1)
- ✅ Projeto está em: `c:\Sistemafoguete`
- ✅ Git inicializado (branch main)
- ✅ Arquivo `.env` existe com credenciais Supabase
- ✅ `.gitignore` configurado (protege node_modules, dist, etc.)

### ⚠️ **O QUE PRECISA SER CONFIGURADO:**
- ❌ PostgreSQL local NÃO está instalado
- ❌ Remote do GitHub não está configurado
- ❌ Vercel não está conectado
- ❌ Supabase ainda está na conta do sócio

---

## **🎯 PLANO DE MIGRAÇÃO (5 PASSOS)**

---

## **PASSO 1: CONFIGURAR GIT + GITHUB** ⚡

### **1.1 - Configurar Remote do GitHub**

```powershell
# Entrar na pasta do projeto
cd c:\Sistemafoguete

# Adicionar remote do GitHub (seu repositório)
git remote add origin https://github.com/andrehoffmannbr/SistemaFoguete.git

# Verificar se foi adicionado
git remote -v
```

**Resultado esperado:**
```
origin  https://github.com/andrehoffmannbr/SistemaFoguete.git (fetch)
origin  https://github.com/andrehoffmannbr/SistemaFoguete.git (push)
```

---

### **1.2 - Adicionar arquivos de auditoria ao Git**

```powershell
# Adicionar pasta de auditoria
git add auditoria/

# Verificar o que será commitado
git status
```

---

### **1.3 - Fazer primeiro commit com auditoria**

```powershell
# Commit das mudanças
git commit -m "feat: adiciona scripts de auditoria do banco de dados

- Adiciona 5 scripts SQL para auditoria de integridade
- Verifica subscriptions órfãs (FK faltando)
- Verifica pix_charges sem customer_id
- Verifica JSONB inválidos
- Verifica CPFs incorretos
- Verifica performance e índices
- Adiciona guia completo de execução (README_AUDITORIA.md)
- Fase 0: Somente leitura, sem alterações em produção"

# Push para o GitHub
git push -u origin main
```

---

### **1.4 - POSSÍVEL PROBLEMA: Autenticação GitHub**

Se der erro de autenticação, você tem 2 opções:

#### **Opção A: Personal Access Token (Recomendado)**

1. Acesse: https://github.com/settings/tokens
2. Clique em: **Generate new token** → **Classic**
3. Marque: `repo` (Full control of private repositories)
4. Copie o token gerado (guarde bem!)
5. Quando pedir senha no `git push`, cole o token

#### **Opção B: GitHub CLI**

```powershell
# Instalar GitHub CLI
winget install --id GitHub.cli

# Autenticar
gh auth login

# Seguir instruções no terminal
```

---

## **PASSO 2: PROTEGER ARQUIVO .ENV** 🔒

### **2.1 - Verificar se .env está no .gitignore**

O arquivo `.env` contém suas credenciais Supabase e **NÃO PODE** ir para o GitHub!

```powershell
# Verificar se .env está protegido
cat .gitignore | Select-String ".env"
```

**Se NÃO aparecer `.env`**, você precisa adicionar:

```powershell
# Adicionar .env ao .gitignore
Add-Content -Path .gitignore -Value "`n# Environment variables`n.env`n.env.local`n.env.production`n"
```

---

### **2.2 - Criar .env.example (template)**

Vamos criar um arquivo de exemplo para outros devs:

```powershell
# Criar .env.example
@"
# Supabase Configuration
VITE_SUPABASE_PROJECT_ID="seu-project-id-aqui"
VITE_SUPABASE_PUBLISHABLE_KEY="sua-public-key-aqui"
VITE_SUPABASE_URL="https://seu-projeto.supabase.co"

# Mercado Pago (futuro)
# VITE_MERCADO_PAGO_PUBLIC_KEY=""
# MERCADO_PAGO_ACCESS_TOKEN=""
"@ | Out-File -FilePath .env.example -Encoding utf8
```

**Commit o .env.example:**
```powershell
git add .env.example
git commit -m "chore: adiciona template de variáveis de ambiente"
git push
```

---

## **PASSO 3: INSTALAR POSTGRESQL LOCAL** 🐘

### **Por que PostgreSQL local?**
- ✅ Testar migrações SEM afetar produção
- ✅ Desenvolver offline
- ✅ Rodar testes automatizados
- ✅ Simular Supabase localmente

---

### **3.1 - Baixar PostgreSQL**

**Opção A: Via Instalador Oficial (Mais simples)**

1. Acesse: https://www.postgresql.org/download/windows/
2. Baixe o instalador (versão 16.x recomendada)
3. Execute o instalador
4. **IMPORTANTE:** Anote a senha do usuário `postgres`
5. Porta padrão: `5432`
6. Instale também: pgAdmin 4 (interface visual)

**Opção B: Via Chocolatey (Mais rápido)**

```powershell
# Instalar Chocolatey (se não tiver)
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Instalar PostgreSQL
choco install postgresql16 -y

# Reiniciar terminal após instalação
```

---

### **3.2 - Verificar instalação**

```powershell
# Testar se psql está acessível
psql --version

# Resultado esperado: psql (PostgreSQL) 16.x
```

---

### **3.3 - Criar banco de dados local**

```powershell
# Conectar ao PostgreSQL
psql -U postgres

# Dentro do psql, executar:
CREATE DATABASE sistemafoguete_dev;
\q
```

---

### **3.4 - Atualizar .env para ambiente local**

Crie um arquivo `.env.local` para desenvolvimento:

```env
# .env.local (NÃO COMMITAR)

# Supabase (produção - conta do sócio)
VITE_SUPABASE_PROJECT_ID="fjfeydaisukgftwcuygp"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
VITE_SUPABASE_URL="https://fjfeydaisukgftwcuygp.supabase.co"

# PostgreSQL Local (desenvolvimento)
DATABASE_URL="postgresql://postgres:SUA_SENHA@localhost:5432/sistemafoguete_dev"
```

---

## **PASSO 4: CONFIGURAR VERCEL** 🔺

### **4.1 - Instalar Vercel CLI**

```powershell
npm install -g vercel
```

---

### **4.2 - Fazer login na Vercel**

```powershell
vercel login
```

Siga as instruções (vai abrir o browser para autenticar).

---

### **4.3 - Conectar projeto ao Vercel**

```powershell
# Na pasta do projeto
cd c:\Sistemafoguete

# Inicializar Vercel
vercel

# Responder as perguntas:
# ? Set up and deploy? [Y/n] → Y
# ? Which scope? → Sua conta pessoal
# ? Link to existing project? [y/N] → N
# ? What's your project's name? → SistemaFoguete
# ? In which directory is your code located? → ./
# ? Want to override the settings? [y/N] → N
```

---

### **4.4 - Configurar variáveis de ambiente na Vercel**

No dashboard da Vercel:
1. Acesse: https://vercel.com/dashboard
2. Selecione o projeto **SistemaFoguete**
3. Vá em: **Settings** → **Environment Variables**
4. Adicione:
   - `VITE_SUPABASE_PROJECT_ID` = (seu project ID)
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = (sua public key)
   - `VITE_SUPABASE_URL` = (sua URL Supabase)

---

### **4.5 - Deploy automático**

A partir de agora, todo `git push` vai fazer deploy automático! 🎉

```powershell
git push origin main
# Vercel vai detectar e fazer deploy automaticamente
```

---

## **PASSO 5: CRIAR SUA PRÓPRIA CONTA SUPABASE** 🔧

### **5.1 - Criar novo projeto Supabase**

1. Acesse: https://supabase.com
2. Faça login com sua conta
3. Clique em: **New Project**
4. Preencha:
   - **Name:** Sistema Foguete
   - **Database Password:** (anote bem!)
   - **Region:** South America (São Paulo) - mais próximo
   - **Pricing Plan:** Free (para começar)

---

### **5.2 - Copiar credenciais**

Após criar, vá em: **Settings** → **API**

Copie:
- **Project URL:** `https://seu-projeto.supabase.co`
- **Project ID:** (exemplo: `abcd1234`)
- **anon/public key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

---

### **5.3 - Atualizar .env**

```env
VITE_SUPABASE_PROJECT_ID="seu-novo-project-id"
VITE_SUPABASE_PUBLISHABLE_KEY="sua-nova-public-key"
VITE_SUPABASE_URL="https://seu-novo-projeto.supabase.co"
```

---

### **5.4 - Migrar schema do sócio para seu Supabase**

#### **Opção A: Export/Import via Supabase Dashboard**

1. **No Supabase do sócio:**
   - Vá em: **SQL Editor**
   - Clique em: **New Query**
   - Execute: 
     ```sql
     -- Exportar schema
     SELECT 'CREATE TABLE ' || schemaname || '.' || tablename || ' (...);'
     FROM pg_tables
     WHERE schemaname = 'public';
     ```
   - Copie todos os CREATE TABLE, CREATE FUNCTION, etc.

2. **No seu Supabase:**
   - Vá em: **SQL Editor**
   - Cole e execute os comandos

#### **Opção B: Via Supabase CLI (Mais completo)**

```powershell
# Instalar Supabase CLI
npm install -g supabase

# Login
supabase login

# Link ao projeto do sócio (temporário)
supabase link --project-ref fjfeydaisukgftwcuygp

# Gerar migrations do schema atual
supabase db pull

# Link ao SEU projeto
supabase link --project-ref seu-novo-project-id

# Aplicar migrations no seu projeto
supabase db push
```

---

### **5.5 - Migrar dados (se necessário)**

Se quiser copiar os dados também:

```powershell
# Exportar dados do projeto do sócio
pg_dump "postgresql://postgres:[SENHA_SOCIO]@db.fjfeydaisukgftwcuygp.supabase.co:5432/postgres" > backup_producao.sql

# Importar no seu projeto
psql "postgresql://postgres:[SUA_SENHA]@db.seu-projeto.supabase.co:5432/postgres" < backup_producao.sql
```

---

## **📋 CHECKLIST FINAL**

Execute na ordem e marque conforme concluir:

### **Git + GitHub**
- [ ] `git remote add origin https://github.com/andrehoffmannbr/SistemaFoguete.git`
- [ ] `git add auditoria/`
- [ ] `git commit -m "feat: adiciona scripts de auditoria"`
- [ ] `git push -u origin main`
- [ ] Verificar se .env está no .gitignore
- [ ] Criar .env.example e commitar

### **PostgreSQL Local**
- [ ] Baixar e instalar PostgreSQL 16
- [ ] Anotar senha do usuário postgres
- [ ] Verificar: `psql --version`
- [ ] Criar banco: `CREATE DATABASE sistemafoguete_dev;`
- [ ] Criar .env.local com DATABASE_URL

### **Vercel**
- [ ] Instalar: `npm install -g vercel`
- [ ] Login: `vercel login`
- [ ] Deploy: `vercel`
- [ ] Configurar variáveis de ambiente no dashboard
- [ ] Testar deploy automático com git push

### **Supabase**
- [ ] Criar novo projeto em supabase.com
- [ ] Anotar Project ID, URL e anon key
- [ ] Atualizar .env com novas credenciais
- [ ] Instalar Supabase CLI: `npm install -g supabase`
- [ ] Exportar schema do projeto do sócio
- [ ] Importar schema no seu projeto
- [ ] (Opcional) Migrar dados de produção

### **Verificação Final**
- [ ] Atualizar variáveis na Vercel com novo Supabase
- [ ] Fazer deploy e testar aplicação
- [ ] Confirmar que está usando SEU banco
- [ ] Documentar credenciais em local seguro (1Password, Bitwarden, etc.)

---

## **🆘 SE PRECISAR DE AJUDA**

### **Problemas Comuns:**

**1. Git push pede senha:**
→ Use Personal Access Token do GitHub

**2. psql não encontrado:**
→ Adicione PostgreSQL ao PATH: `C:\Program Files\PostgreSQL\16\bin`

**3. Vercel não detecta deploy:**
→ Verifique se tem `vercel.json` ou deixe config automática

**4. Supabase CLI não funciona:**
→ Rode: `npm install -g supabase@latest`

---

## **🚀 PRÓXIMOS PASSOS APÓS SETUP**

1. ✅ Setup completo (este documento)
2. ✅ Executar auditoria do banco (scripts já criados)
3. ✅ Analisar resultados da auditoria
4. ✅ Aplicar correções de segurança e integridade
5. ✅ Implementar Mercado Pago
6. ✅ Deploy em produção na SUA infraestrutura

---

**Boa sorte! 🚀 Qualquer dúvida, estou aqui para ajudar!**
