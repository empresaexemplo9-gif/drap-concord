export const metadata = { title: "Política de privacidade" };

export default function Privacidade() {
  return (
    <article className="mx-auto max-w-2xl space-y-4 px-4 py-12 leading-relaxed">
      <h1 className="text-3xl font-semibold">Política de privacidade</h1>
      <p className="rounded-xl bg-warning-bg p-4 text-sm text-warning">Modelo inicial. Precisa ser revisado por um especialista em LGPD antes do lançamento.</p>
      <h2 className="text-xl font-semibold">Quais dados tratamos</h2>
      <p>Dados de cadastro (nome, e-mail, telefone), agendamentos, respostas a formulários prévios e, quando o profissional registra, informações do atendimento, que podem incluir dados sensíveis de saúde.</p>
      <h2 className="text-xl font-semibold">Para quê</h2>
      <p>Para viabilizar o agendamento e o atendimento, enviar lembretes e cumprir obrigações legais. Pedimos só o necessário para cada finalidade.</p>
      <h2 className="text-xl font-semibold">Quem acessa</h2>
      <p>Somente o profissional (e a equipe autorizada por ele) com quem você agendou. Registros sigilosos não ficam visíveis para recepção ou financeiro. Todo acesso a registros é registrado em log de auditoria.</p>
      <h2 className="text-xl font-semibold">Seus direitos</h2>
      <p>Você pode acessar, baixar e excluir seus dados a qualquer momento em <strong>Minha conta → Meus dados</strong>. Registros que o profissional é obrigado por lei a guardar permanecem com ele pelo prazo legal.</p>
      <h2 className="text-xl font-semibold">Contato do encarregado (DPO)</h2>
      <p>privacidade@drapconcord.com.br (definir antes do lançamento).</p>
    </article>
  );
}
