[Acesse aqui.](https://revisacarapp.com)

### Site e app no mesmo domínio

- `https://revisacarapp.com/` → landing pública (`frontend/index.html`, HTML estático para o Google).
- `https://revisacarapp.com/app/` → o painel da oficina (`frontend/app/index.html`).
  Quem já está logado e abre a landing vai direto para `/app/`.

No **Render (Static Site → Redirects/Rewrites)**, as regras abaixo, todas do tipo *Rewrite*,
mandam os links que o app abre direto para o painel:

| Source             | Destination        |
|--------------------|--------------------|
| `/app/*`           | `/app/index.html`  |
| `/o/*`             | `/app/index.html`  |
| `/f/*`             | `/app/index.html`  |
| `/reset-password`  | `/app/index.html`  |

Não use `/*` → `/index.html`: isso serviria a landing no lugar do app.
