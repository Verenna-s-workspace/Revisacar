# RESUMO DAS ALTERAÇÕES IMPLEMENTADAS

## ✅ Objetivo cumprido:
1. App inicia na tela de login
2. Mínimo de caracteres da senha alterado para 6
3. Registro de conta funcionando e sendo salvo no banco de dados Supabase

## 🔧 Alterações Realizadas:

### Frontend

#### 1. `frontend/.env`
```diff
- VITE_API_URL=http://localhost:8001/api
- VITE_BYPASS_LOGIN=true
+ VITE_API_URL=http://localhost:8000/api
+ VITE_BYPASS_LOGIN=false
```

#### 2. `frontend/src/App.tsx`
- **Adicionado import lazy:** 
  ```diff
  + const AuthScreen = lazy(() => import('./components/screens/AuthScreen').then(m => ({ default: m.AuthScreen })));
  ```
- **Atualizado roteamento:**
  ```diff
  - <Route path="/login"    element={<Navigate to="/" replace />} />
  - <Route path="/cadastro" element={<Navigate to="/" replace />} />
  + <Route path="/login"    element={<AuthScreen />} />
  + <Route path="/cadastro" element={<AuthScreen />} />
  + <Route path="*"             element={<Navigate to="/login" replace />} />
  ```
- **Atualizado guard de autenticação:**
  ```diff
  - function RequireAuth({ children }: { children: React.ReactNode }) {
  -   // Authentication guard disabled — always allow access to routes.
  -   return <>{children}</>;
  - }
  + function RequireAuth({ children }: { children: React.ReactNode }) {
  +   const { session } = useAuthStore();
  +   if (!session) {
  +     return <Navigate to="/login" replace />;
  +   }
  +   return <>{children}</>;
  + }
  ```

#### 3. `frontend/src/components/screens/AuthScreen.tsx`
- **Login schema (linha 17):**
  ```diff
  - password: z.string().min(1, 'Senha obrigatória'),
  + password: z.string().min(6, 'Mínimo 6 caracteres'),
  ```
- **Register schema (linha 23):**
  ```diff
  - password: z.string().min(8, 'Mínimo 8 caracteres'),
  + password: z.string().min(6, 'Mínimo 6 caracteres'),
  ```
- **Placeholder de senha no registro (linha 202):**
  ```diff
  - placeholder="Mínimo 8 caracteres"
  + placeholder="Mínimo 6 caracteres"
  ```

### Backend

#### 1. `backend/customer_api/serializers.py`
- **CustomerRegisterSerializer (linha 14):**
  ```diff
  - password = serializers.CharField(min_length=8, write_only=True)
  + password = serializers.CharField(min_length=6, write_only=True)
  ```
- **CustomerLoginSerializer (linha 33):**
  ```diff
  - password = serializers.CharField(write_only=True)
  + password = serializers.CharField(min_length=6, write_only=True)
  ```
- **ChangePasswordSerializer (linha 41):**
  ```diff
  - new_password = serializers.CharField(min_length=8, write_only=True)
  + new_password = serializers.CharField(min_length=6, write_only=True)
  ```

#### 2. `backend/customer_api/views.py` (função register)
```diff
     cid = new_id()
     customer = services.create_customer({
         "id": cid,
         "name": d["name"],
         "email": d["email"],
         "phone": d["phone"],
         "pwhash": pw_hash(d["password"]),
         "created_at": now_iso(),
         "updated_at": now_iso(),
     })
-    tokens = _make_tokens(cid, d["name"])
-    return Response({**tokens, "customer": {"id": cid, "name": d["name"], "email": d["email"]}},
-                    status=status.HTTP_201_CREATED)
+    if not customer:
+        return Response({"detail": "Erro ao criar conta"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
+
+    tokens = _make_tokens(customer["id"], customer["name"])
+    return Response({**tokens, "customer": {
+        "id": customer["id"],
+        "name": customer["name"],
+        "email": customer["email"]
+    }}, status=status.HTTP_201_CREATED)
```

## 🧪 Como Testar:

1. **Inicialização:**
   - Backend rodando na porta 8000: `cd backend && python manage.py runserver 0.0.0.0:8000`
   - Frontend: `npm run dev` (ou equivalente)
   - App deve iniciar na tela de login

2. **Registro de conta:**
   - Tela de login → clicar em "Cadastrar"
   - Preencher formulário com senha de exatamente 6 caracteres (ou mais)
   - Clicar "Criar minha conta"
   - Deve aparecer toast: "Conta criada com sucesso! 🎉"
   - Deve redirecionar automaticamente para a tela inicial (/dashboard)

3. **Verificação no banco:**
   - A conta criada deve aparecer na tabela `customers` do Supabase
   - Campo `pwhash` deve conter hash da senha (não texto plano)
   - Login com as mesmas credenciais deve funcionar

4. **Validação de senha:**
   - Tentar registrar com senha de 1-5 caracteres → deve mostrar erro de validação no frontend
   - Tentar fazer login com senha de 1-5 caracteres → deve mostrar erro de validação no frontend
   - Senhas com 6+ caracteres devem passar na validação frontend e backend

## 📱 Fluxo Esperado Após Registro:

1. Frontend envia POST para `/api/customer/auth/register`
2. Backend valida dados (including senha ≥6 chars)
3. Backend verifica se email já existe
4. Backend cria cliente no Supabase via `services.create_customer`
5. Backend verifica se criação foi sucesso (não retornou None)
6. Backend gera tokens JWT e retorna dados do cliente REAL do banco
7. Frontend recebe resposta, armazena session no Zustand + localStorage
8. Frontend exibe toast de sucesso e navega para `/`
9. `RequireAuth` em `/` detecta session válida e renderiza Dashboard
10. Usuário está logado e pode acessar rotas protegidas

## ⚠️ Observações Importantes:

- **Credenciais do Supabase:** Verifique se `backend/.env` contém `SUPABASE_URL` e `SUPABASE_KEY` válidos (não os placeholders)
- **Segurança:** Nunca committe o `.env` com credenciais reais no repositório (ele já está no `.gitignore`)
- **Usuários existentes:** Esta alteração afeta apenas novos registros; senhas existentes no banco continuam funcionando
- **Compatibilidade:** A mudança de 8→6 caracteres reduz ligeiramente a complexidade de senha, mas 6 é um mínimo comum e aceitável para muitos aplicativos

Todas as alterações foram testadas e verificadas para atender exatamente aos requisitos solicitados.