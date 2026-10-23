# Roteiro

Situação atual em relação às fases do documento de requisitos.

## Pronto e testado

- **Fundação:** modelo de dados multi-tenant, autenticação por sessão, papéis, design system com modo claro e escuro, PWA instalável (manifest, ícones maskable, service worker com páginas offline, banner "Instalar app" com instruções para iOS, aviso de nova versão).
- **Núcleo:** profissionais, serviços, disponibilidade semanal com dois intervalos por dia, bloqueios, buffer, clientes, agenda (semana e lista), atendimentos com todos os status.
- **Perfis profissionais:** registry, schema validado, versionamento, personalização por profissional, formulário dinâmico (com condicionais), painel admin para criar, duplicar, editar e publicar sem deploy. 10 perfis iniciais; Psicólogo, Advogado e Personal Trainer completos.
- **Fluxo ponta a ponta:** portal do cliente com confirmar, reagendar e cancelar (política por perfil), motor de regras com modo sugerir/automático, aprovação e desfazer, notificações in-app.
- **Vitrine:** busca e filtros, página do profissional com selo verificado, avaliações moderadas, horários livres, agendamento da 1ª consulta com pré-cadastro, formulário prévio e LGPD, SEO (metadados, JSON-LD, sitemap, robots).
- **Relatórios:** receita, faltas, ocupação, retenção, por serviço, origem.
- **LGPD:** consentimentos registrados, exportação e exclusão de dados pelo titular, log de auditoria.

## Próximas fases

| Fase | Itens |
| --- | --- |
| 4 (complemento) | Lembretes agendados com botões Confirmar/Reagendar/Cancelar, lista de espera, check-in, aviso de cancelamento só após o prazo de carência |
| 5. Comunicação | Chat em tempo real (arquivos, áudio, lido/digitando), Web Push com chaves VAPID, e-mail, WhatsApp (API oficial), preferências e "não perturbar" |
| 6. Documentos e financeiro | Upload criptografado com URLs assinadas, modelos com variáveis, assinatura digital (ICP-Brasil), pacotes e mensalidades, PIX e cartão via gateway, recibos, inadimplência |
| 7. Vitrine (complemento) | Fotos, portfólio e galeria, mapa, destaque pago |
| 8. Endurecimento | Autenticação em dois fatores, login social, equipe com convites e papéis, recursos (salas e quadras), turmas com vagas, arrastar e soltar na agenda, recorrência, sincronização Google/Outlook (iCal), teleatendimento integrado, i18n, planos e cobrança da assinatura |
