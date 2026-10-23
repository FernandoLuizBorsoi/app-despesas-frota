# Despesas da Frota

App Android para os motoristas lançarem despesas (combustível, pedágio, manutenção etc.) com foto do comprovante. Funciona sem internet: a despesa fica guardada no celular e é enviada quando o sinal volta.

- `mobile/`: app do motorista (React Native + Expo)
- `painel/`: site do gestor com lista de despesas, fotos, relatórios e cadastro de veículos e motoristas (veja `painel/README.md`)
- `supabase/`: banco de dados, regras de acesso e armazenamento das fotos

## O que o app faz hoje

- Login com CPF e senha (o gestor cadastra cada motorista no painel).
- Nova despesa: foto do comprovante (câmera ou galeria, até 5), categoria, veículo, valor, data, km do odômetro, litros (combustível), forma de pagamento e observação.
- As fotos são reduzidas para cerca de 300 KB antes de enviar, para gastar pouco dado móvel.
- Lista das despesas do motorista, mostrando o que ainda aguarda envio.
- Envio automático ao abrir o app, ao voltar para ele e quando a internet volta. Também dá para puxar a lista para baixo e enviar na hora.
- Aviso quando o km informado é menor que o último registrado para o veículo.

O painel do gestor mostra as despesas com as fotos, relatórios por veículo, categoria e motorista (com custo por km e consumo km/l) e exporta para Excel. Ainda não tem aprovação de despesas.

## Como colocar para funcionar

### 1. Banco de dados (Supabase)

1. Crie uma conta e um projeto em [supabase.com](https://supabase.com) (o plano gratuito atende 28 motoristas).
2. No projeto, abra **SQL Editor**, cole o conteúdo de `supabase/migrations/20261023000000_inicial.sql` e clique em **Run**.
3. Em `supabase/seed.sql`, troque `Minha Frota` pelo nome da empresa, cole no SQL Editor e rode. Isso cria a empresa e as categorias.
4. Cadastre os veículos. Depois que o gestor existir (passo 5), dá para fazer isso pelo painel, na tela **Veículos**. Ou direto no SQL Editor (troque as placas e o id da empresa, que aparece na tabela `empresa`):

   ```sql
   insert into veiculo (empresa_id, placa, modelo) values
     ('ID-DA-EMPRESA', 'ABC1D23', 'VW Delivery'),
     ('ID-DA-EMPRESA', 'XYZ4E56', 'Fiat Fiorino');
   ```

5. Crie o primeiro gestor em **Authentication > Users > Add user** (e-mail e senha, com confirmação automática) e ligue-o à empresa:

   ```sql
   insert into usuario (id, empresa_id, nome, perfil)
   select u.id, (select id from empresa limit 1), 'Nome do Gestor', 'gestor'
   from auth.users u where u.email = 'email-do-gestor@exemplo.com';
   ```

6. Publique a função que cadastra motoristas: `supabase functions deploy criar-motorista --no-verify-jwt` (ela confere sozinha se quem chama é gestor). Depois disso, os motoristas são cadastrados pelo painel, na tela **Motoristas**, com CPF e senha. Por baixo, o login do Supabase de cada motorista usa o e-mail `<cpf>@cpf.invalid` (domínio reservado, que nunca recebe mensagens).

### 2. App

1. Instale o [Node.js](https://nodejs.org) 20 ou mais novo.
2. Em `mobile/`, copie `.env.example` para `.env` e preencha com a URL e a chave **anon** do projeto (Supabase: **Project Settings > API**).
3. Rode `npm install`.
4. Para gerar o APK e instalar nos celulares, use o EAS da Expo (precisa de conta gratuita em [expo.dev](https://expo.dev)):

   ```sh
   npx eas-cli@latest build --platform android --profile preview
   ```

   O link do APK aparece no final; abra no celular do motorista para instalar.

Para desenvolver: `npx expo run:android` com um celular ligado por cabo ou um emulador. O app usa câmera e banco local, então precisa de uma build de desenvolvimento, não do Expo Go.

## Verificações

```sh
(cd mobile && npx tsc --noEmit)
(cd painel && npx tsc --noEmit && npm run lint && npm run build)
```
