// Verificação do app Android: os links da plataforma abrem direto no app
// (sem perguntar), porque o domínio confirma o pacote e a chave de assinatura.
// A impressão digital da chave é pública; a chave em si nunca fica no repositório.
const APPS = [{ package_name: "com.drapconcord.app", sha256_cert_fingerprints: ["CF:75:0D:5E:F4:FD:08:FC:EE:0F:43:6C:96:07:00:40:32:8C:0E:23:DD:95:28:A9:25:27:D3:E8:B1:F5:41:4D"] }];

export function GET() {
  const extra = (process.env.ANDROID_SHA256_FINGERPRINTS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const body = APPS.map((a) => ({
    relation: ["delegate_permission/common.handle_all_urls"],
    target: { namespace: "android_app", package_name: a.package_name, sha256_cert_fingerprints: [...a.sha256_cert_fingerprints, ...extra] },
  }));
  return Response.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}
