# Validação Ambiental CAR - Azure Functions

Este repositório contém uma Azure Function para análise ambiental de CARs (Cadastro Ambiental Rural), consultando dados do SICAR e PRODES via agrobr.

## Arquivos

- `function_app.py` - Código principal da Azure Function
- `requirements.txt` - Dependências Python
- `host.json` - Configuração da Azure Function

## Como criar o repositório no GitHub

1. Acesse [GitHub.com](https://github.com) e faça login
2. Clique em "New repository"
3. Nomeie como `car-environmental-validation` ou similar
4. Marque como público ou privado
5. Não inicialize com README (já temos um)
6. Clique em "Create repository"

## Como fazer upload dos arquivos

### Opção 1: Git (recomendado)

Certifique-se de ter Git instalado. No terminal, na pasta do projeto:

```bash
# Inicializar repositório
git init

# Adicionar todos os arquivos
git add .

# Primeiro commit
git commit -m "Initial commit - CAR environmental validation Azure Function"

# Renomear branch para main
git branch -M main

# Conectar ao seu repositório GitHub (substitua SEU_USERNAME e SEU_REPO)
git remote add origin https://github.com/SEU_USERNAME/SEU_REPO.git

# Enviar para GitHub
git push -u origin main
```

### Opção 2: Upload manual via GitHub

1. Vá para o repositório criado no GitHub
2. Clique em "Add file" > "Upload files"
3. Arraste os arquivos necessários:
   - `function_app.py`
   - `requirements.txt`
   - `host.json`
   - `local.settings.json` (opcional)
   - `.funcignore` (opcional)
   - `.gitignore` (opcional)
   - `README.md`
   - `test_local.py` (opcional)
4. Adicione uma mensagem de commit
5. Clique em "Commit changes"

## Deploy no Azure Functions

### Pré-requisitos

1. Conta Azure (gratuita disponível)
2. Azure CLI instalado (opcional, mas recomendado)

### Passo 1: Criar Function App no Azure Portal

1. Acesse [Azure Portal](https://portal.azure.com)
2. Clique em "Create a resource"
3. Procure por "Function App"
4. Configure:
   - **Subscription**: Sua assinatura
   - **Resource Group**: Crie novo ou use existente
   - **Function App name**: Nome único (ex: `car-validation-api`)
   - **Runtime stack**: Python
   - **Version**: 3.9, 3.10 ou 3.11
   - **Region**: East US ou Brazil South
   - **Operating System**: Linux
   - **Plan**: Consumption (Serverless)
5. Clique em "Review + create" > "Create"

### Passo 2: Conectar ao GitHub

1. Na Function App criada, vá para "Deployment Center"
2. Escolha "GitHub"
3. Autorize o Azure a acessar seu GitHub
4. Selecione o repositório criado
5. Configure branch (main)
6. Clique em "Save"

### Passo 3: Verificar deployment

1. Vá para "Functions" na sua Function App
2. Deve aparecer a função `car-analysis`
3. Teste a URL: `https://SEU_APP.azurewebsites.net/api/car-analysis/MS-5006903-20653795E9D942A39F0AC0227622148F`

## Como usar no frontend

No `environmental-validation.js`, substitua a URL:

```javascript
const azureUrl = `https://SEU_APP.azurewebsites.net/api/car-analysis/${sanitized}`;
```

## Teste local (opcional)

Se quiser testar localmente antes do deploy:

```bash
pip install -r requirements.txt
func start
```

## Logs e monitoramento

- No Azure Portal, vá para "Application Insights" para ver logs
- Ou use Azure CLI: `az monitor app-insights query --app SEU_APP --analytics-query "requests | where timestamp > ago(1h)"`

## Suporte

Para dúvidas sobre agrobr ou Azure Functions, consulte:
- [Documentação agrobr](https://github.com/luizirber/agrobr)
- [Documentação Azure Functions](https://docs.microsoft.com/azure/azure-functions/)