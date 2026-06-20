# Implementação Concluída: App Iniciando na Tela de Login com Senha de 6 Caracteres

## Alterações Realizadas

### Frontend

#### 1. `frontend/.env`
- Alterado `VITE_BYPASS_LOGIN=true` para `VITE_BYPASS_LOGIN=false`
- Isso desativa o modo de desenvolvimento que fazia login automático

#### 2. `frontend/src/App.tsx`
- **Adicionado import**: `const AuthScreen = lazy(() => import('./components/screens/AuthScreen').then(m => ({ default: m.AuthScreen })));`
- **Atualizado roteamento**:
  - `/login` agora renderiza `<AuthScreen />` (antes:redirecionava para `/`)
  - `/cadastro` agora renderiza `<AuthScreen />` (antes:redirecionava para `/`)
  - Rota curinga `"*"` agora redireciona para `/login` (antes:redirecionava para `/`)
- **Atualizado guard de autenticação**:
  - `RequireAuth` agora verifica `session` do `useAuthStore()`
  - Se não houver sessão, redireciona para `/login`
  - Se houver sessão, permite acesso às rotas protegidas

#### 3. `frontend/src/components/screens\AuthScreen.tsx`
- **Login Schema** (linha 17):
  - Antes: `z.string().min(1, 'Senha obrigatória')`
  - Depois: `z.string().min(6, 'Mínimo 6 caracteres')`
- **Register Schema** (linha 23):
  - Antes: `z.string().min(8, 'Mínimo 8 caracteres')`
  - Depois: `z.string().min(6, 'Mínimo 6 caracteres')`
- **Placeholder de senha no registro** (linha 202):
  - Antes: `"Mínimo 8 caracteres"`
  - Depois: `"Mínimo 6 caracteres"`

### Backend

#### 1. `backend/customer_api/serializers.py`
- **CustomerRegisterSerializer** (linha 14):
  - Antes: `password = serializers.CharField(min_length=8, write_only=True)`
  - Depois: `password = serializers.CharField(min_length=6, write_only=True)`
- **CustomerLoginSerializer** (linha 33):
  - Antes: `password = serializers.CharField(write_only=True)`
  - Depois: `password = serializers.CharField(min_length=6, write_only=True)`
- **ChangePasswordSerializer** (linha 41):
  - Antes: `new_password = serializers.CharField(min_length=8, write_only=True)`
  - Depois: `new_password = serializers.CharField(min_length=6, write_only=true)`

## Verificação da Conexão com Banco de Dados

Verificado que o arquivo `backend/.env` contém as configurações necessárias:
- `SUPABASE_URL` e `SUPABASE_KEY` estão presentes (valores reais devem estar configurados no ambiente de produção)
- O serviço Supabase já está sendo usado corretamente em `backend/customer_api/services.py` para operações de criação de clientes
- O endpoint de registro (`/api/customer/auth/register`) já estava salvando contas na tabela `customers` do Supabase

## Fluxo de Funcionamento Esperado

1. **Inicialização do App**:
   - Devido a `VITE_BYPASS_LOGIN=false`, nenhum login automático ocorre
   - A rota raiz (`/`) é protegida por `RequireAuth`
   - Como não há sessão inicialmente, o usuário é redirecionado para `/login`
   - A tela de login (`AuthScreen`) é exibida

2. **Validação de Senha**:
   - **Frontend**: Campos de senha rejeitam valores com menos de 6 caracteres imediatamente
   - **Backend**: Serializers também validam mínimo de 6 caracteres como segunda barreira de proteção
   - Mensagens de erro atualizadas para refletir o novo mínimo

3. **Registro de Conta**:
   - Quando o usuário submete o formulário com senha válida (≥6 caracteres)
   - O frontend chama `authApi.register()`
   - O backend valida com `CustomerRegisterSerializer` (min_length=6)
   - Se válido, cria o cliente na tabela `customers` do Supabase usando `services.create_customer()`
   - Retorna tokens JWT que são armazenados no frontend via Zustand store
   - Em carregamentos subsequentes, o `RequireAuth` detecta a sessão válida e permite acesso

## Testes Recomendados

1. **Tela de Login Inicial**:
   - Após as alterações, recarregar o app deve mostrar a tela de login, não o dashboard

2. **Validação de Senha**:
   - Tentar fazer login com senha de 1-5 caracteres → deve mostrar erro de validação
   - Tentar registrar com senha de 1-5 caracteres → deve mostrar erro de validação
   - Senhas com 6+ caracteres devem passar na validação frontend e backend

3. **Registro e Login**:
   - Criar nova conta com senha válida → deve aparecer na tabela `customers` do Supabase
   - Fazer login com as mesmas credenciais → deve funcionar e redirecionar para dashboard
   - O campo `pwhash` no banco deve conter o hash da senha (não texto plano)

4. **Rotas Protegidas**:
   - Tentar acessar `/veiculos`, `/agendar`, etc. sem login → deve redirecionar para login
   - Após login válido, essas rotas devem ser acessíveis