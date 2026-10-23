# App do motorista

Para gerar o APK: coloque o rótulo `eas-build-android:preview` em um pull request que mude algo nesta pasta. A Expo (projeto `despesas-frota`, diretório base `/mobile`) gera o app e o link aparece em [expo.dev](https://expo.dev/accounts/fernandoborsoi/projects/despesas-frota/builds). A Expo só gera quando o pull request muda arquivos dentro de `mobile/`.

Para instalar no celular: abra o link no Android, baixe o arquivo e toque nele. Na primeira vez, o celular pede para permitir "instalar apps desta fonte"; é só permitir.

## Leitura do valor da foto

O app lê o texto do comprovante no próprio celular (`expo-text-extractor`, ML Kit do Google, sem internet)
e procura o total em `src/lib/ler-valor.ts`. O motorista sempre confirma o valor antes de salvar.
