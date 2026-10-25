# Apps para todos os sistemas

O DRAP Concord é um app instalável (PWA) com o ícone original da plataforma.
A página `/baixar` detecta o aparelho e instala com um toque (Android, Windows,
macOS, Linux, ChromeOS) ou mostra o passo a passo (iPhone e iPad). Ícones em
`public/icons` são gerados por `npx tsx scripts/app-icons.ts` a partir de
`public/icons/icon.svg`.

## Publicar nas lojas (opcional)

As lojas exigem contas de desenvolvedor do dono da plataforma. Com elas, os
pacotes saem da própria URL, sem código novo, pelo PWABuilder
(https://www.pwabuilder.com) usando `https://drap-concord.vercel.app`:

| Loja | Conta | Pacote |
| --- | --- | --- |
| Google Play (Android, tablets, ChromeOS) | Google Play Console (taxa única) | Android (TWA, .aab) |
| App Store (iPhone, iPad, Mac com Apple Silicon) | Apple Developer (anual) | iOS (projeto Xcode) |
| Microsoft Store (Windows) | Partner Center | Windows (.msix) |

Depois de publicar, preencha as variáveis de ambiente na Vercel para os botões
de loja aparecerem em `/baixar`:

- `ANDROID_PACKAGE_NAME` e `ANDROID_SHA256_FINGERPRINTS` (impressões SHA-256 da
  chave de assinatura, separadas por vírgula). Ativam também o
  `/.well-known/assetlinks.json`, que faz o app Android abrir sem barra de endereço.
- `IOS_APP_STORE_URL`
- `MICROSOFT_STORE_URL`
