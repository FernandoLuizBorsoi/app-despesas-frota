# Painel do gestor

Site para o gestor acompanhar as despesas lançadas pelos motoristas.

- **Despesas:** lista com filtros por período, motorista, veículo e categoria; clique numa linha para ver as fotos do comprovante; exportação para Excel.
- **Relatórios:** gasto total, km rodado e custo por km da frota; por veículo (custo/km e consumo km/l), por categoria e por motorista.
- **Veículos:** cadastro, km atual e desativação.
- **Motoristas:** cadastro com CPF e senha para o app (pela função `criar-motorista` do Supabase), botão "Gerar nova senha" e desativação. Sem senha informada, a senha é os 6 primeiros números do CPF.

Só entra quem tem perfil `gestor` ou `admin` na tabela `usuario`.

## Rodar

1. Copie `.env.example` para `.env.local` e preencha com a URL e a chave **anon** do Supabase.
2. `npm install`
3. `npm run dev` e abra http://localhost:3000

## Publicar

`npm run build` gera a pasta `out/`, um site estático. Dá para hospedar de graça na Vercel ou Netlify: conecte o repositório, defina a pasta raiz como `painel` e cadastre as duas variáveis do `.env.example`.
