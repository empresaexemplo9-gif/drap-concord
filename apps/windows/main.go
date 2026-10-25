// App Windows do DRAP Concord: a plataforma em janela própria, com o ícone
// original, usando o WebView2 (o motor do Edge que já vem no Windows 10 e 11).
// Câmera e microfone das chamadas pedem permissão na primeira vez.
// Sem WebView2 no computador, abre a plataforma no navegador padrão.
package main

import (
	"os"
	"path/filepath"

	"github.com/jchv/go-webview2"
	"golang.org/x/sys/windows"
)

const url = "https://drap-concord.vercel.app/?origem=windows"

func openInBrowser() {
	verb, _ := windows.UTF16PtrFromString("open")
	target, _ := windows.UTF16PtrFromString(url)
	_ = windows.ShellExecute(0, verb, target, nil, nil, windows.SW_SHOWNORMAL)
}

func main() {
	w := webview2.NewWithOptions(webview2.WebViewOptions{
		AutoFocus: true,
		// Dados (login, preferências) ficam na pasta do usuário, não junto do .exe.
		DataPath: filepath.Join(os.Getenv("LOCALAPPDATA"), "DRAP Concord"),
		WindowOptions: webview2.WindowOptions{
			Title:  "DRAP Concord",
			Width:  1280,
			Height: 820,
			IconId: 1,
			Center: true,
		},
	})
	if w == nil {
		openInBrowser()
		return
	}
	defer w.Destroy()
	w.SetSize(900, 600, webview2.HintMin)
	w.Navigate(url)
	w.Run()
}
