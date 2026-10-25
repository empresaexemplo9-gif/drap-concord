# Apps para todos os sistemas (baixados pelo navegador)

Todos os instaladores ficam em `public/downloads` e são baixados pela página
`/baixar`, sem lojas. Todos usam o ícone original (`public/icons/icon.svg`).

| Sistema | Arquivo | Como é feito |
| --- | --- | --- |
| Android 7+ (celular e tablet) | `drap-concord.apk` | App próprio (WebView) com câmera, microfone, localização, envio de fotos e avisos de chamada. `apps/android/build.sh` |
| Windows 10/11 (x64 e ARM) | `DRAP-Concord-Windows-*.exe` | App próprio em Go com o WebView2 do Windows. `apps/windows/build.sh` |
| macOS | `DRAP-Concord-macOS.zip` | App que abre a plataforma em janela própria (Chrome/Edge/Brave ou Safari). `apps/desktop/build.sh` |
| Linux | `.deb` e `.tar.gz` | Atalho no menu com ícone, janela própria no Chromium/Chrome/Edge/Brave. `apps/desktop/build.sh` |
| iPhone e iPad | — | A Apple não permite instalar apps baixados fora da App Store; instala pelo Safari (Adicionar à Tela de Início). |
| ChromeOS | — | Instala pelo Chrome (botão Instalar). |

Depois de gerar instaladores, atualize a lista de tamanhos e SHA-256:
`npx tsx scripts/downloads-manifest.ts`.

## Android: chave de assinatura

Atualizações do APK só instalam por cima se forem assinadas com a **mesma
chave**. A chave (`concord-release.jks`) e a senha ficam com o dono da
plataforma, fora do repositório. A impressão digital pública dela está em
`src/app/.well-known/assetlinks.json/route.ts` (links da plataforma abrem
direto no app).

    TOOLS=pasta-com-ferramentas KEYSTORE=concord-release.jks KEY_ALIAS=concord KEY_PASS=... \
      sh apps/android/build.sh public/downloads/drap-concord.apk

Ferramentas (abertas): `aapt2_64` (de dentro do Apktool), `android.jar` (API 34),
`dx.jar` (dalvik-dx) e `signer.jar` (uber-apk-signer).

## Avisos de primeira execução

Os instaladores não são assinados por certificados pagos da Microsoft/Apple,
então na primeira vez o Windows mostra "O Windows protegeu o computador"
(Mais informações → Executar assim mesmo) e o macOS pede liberação em
Ajustes do Sistema → Privacidade e Segurança. A página `/baixar` explica isso.
