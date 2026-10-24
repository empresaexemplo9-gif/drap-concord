import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "concord123";
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function login(page: Page, email: string) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/entrar"));
}

async function logout(page: Page) {
  await page.context().clearCookies();
}

/** "yyyy-MM-ddTHH:mm" no fuso de São Paulo, deslocado em dias. */
function localInput(daysFromNow: number, hour: number) {
  const d = new Date(Date.now() + daysFromNow * 86_400_000);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
  return `${date}T${String(hour).padStart(2, "0")}:00`;
}

test("cliente encontra na vitrine, se cadastra e agenda a 1ª consulta; depois confirma e reagenda @mobile", async ({ page }) => {
  const email = `cliente-${uid()}@teste.dev`;
  await page.goto("/?q=ansiedade");
  await page.getByRole("link", { name: "Ana Ribeiro" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Ana Ribeiro" })).toBeVisible();
  await expect(page.getByText(/CRP verificado/)).toBeVisible();

  await page.getByRole("link", { name: "Agendar" }).first().click();
  // Passo 2: horário
  // Horário com mais de 24h de antecedência, para a política permitir reagendar.
  await page.locator('label:has(input[name="horario"])').nth(25).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  // Passo 3: dados + formulário prévio + LGPD
  await page.getByLabel("Nome completo").fill("Paciente Teste");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Celular / WhatsApp").fill("(11) 90000-0000");
  await page.getByLabel("Crie uma senha").fill(PASSWORD);
  await page.getByLabel(/O que te traz à terapia/).fill("Ansiedade no trabalho");
  await page.getByLabel(/Já fez terapia antes/).selectOption("Não");
  await page.getByRole("checkbox", { name: /Autorizo o tratamento/ }).check();
  await page.getByRole("button", { name: "Confirmar agendamento" }).click();

  await expect(page.getByRole("heading", { name: "Pedido enviado!" })).toBeVisible();
  await page.getByRole("link", { name: "Ver meus agendamentos" }).click();
  await expect(page.getByText("Pendente")).toBeVisible();

  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByText("✓ Confirmado")).toBeVisible();

  await page.getByRole("link", { name: "Reagendar" }).click();
  await page.locator('label:has(input[name="start"])').nth(3).click();
  await page.getByRole("button", { name: "Confirmar novo horário" }).click();
  await expect(page.getByText("Remarcado! O profissional foi avisado.")).toBeVisible();
});

test("regra de faltas da psicologia: aviso com 2 faltas e confirmação do profissional antes de cancelar", async ({ page }) => {
  const name = `Faltoso ${uid()}`;
  await login(page, "ana@concord.dev");
  await expect(page).toHaveURL(/\/app$/);

  // Cria um cliente novo com 3 sessões passadas e 1 futura.
  const ids: string[] = [];
  for (const [i, day] of [-21, -14, -7, 7].entries()) {
    await page.goto("/app/agendar");
    await page.getByRole("link", { name: /Sessão individual/ }).click();
    if (i === 0) {
      await page.locator("#clientId").selectOption("novo");
      await page.getByLabel("Nome", { exact: true }).fill(name);
    } else {
      await page.locator("#clientId").selectOption({ label: name });
    }
    await page.getByText("Encaixar em outro horário").click();
    await page.getByLabel("Data e hora").fill(localInput(day, 7));
    await page.getByRole("button", { name: "Confirmar agendamento" }).click();
    await expect(page.getByText("Agendamento criado")).toBeVisible();
    ids.push(page.url().split("/atendimentos/")[1].split("?")[0]);
  }

  const markNoShow = async (id: string) => {
    await page.goto(`/app/atendimentos/${id}`);
    await page.getByRole("button", { name: "Marcar falta" }).click();
    await expect(page.locator("main").getByText("Falta", { exact: true })).toBeVisible();
  };

  await markNoShow(ids[0]);
  await markNoShow(ids[1]);
  await page.goto("/app/regras");
  await expect(page.getByText(/Sentimos sua falta nas últimas 2 sessões/).first()).toBeVisible();

  await markNoShow(ids[2]);
  await page.goto("/app/regras");
  const pending = page.locator("section", { hasText: "Aguardando sua decisão" });
  await expect(pending.getByText(`Cancelar as sessões futuras de ${name} após 3 faltas seguidas?`)).toBeVisible();

  // Nada foi cancelado antes da confirmação.
  await page.goto(`/app/atendimentos/${ids[3]}`);
  await expect(page.locator("main").getByText("Confirmado", { exact: true })).toBeVisible();

  await page.goto("/app/regras");
  const question = `Cancelar as sessões futuras de ${name} após 3 faltas seguidas?`;
  await page.locator("div", { has: page.getByText(question, { exact: true }) }).getByRole("button", { name: "Confirmar" }).last().click();
  await expect(page.getByText(question, { exact: true })).toHaveCount(0);
  await page.goto(`/app/atendimentos/${ids[3]}`);
  await expect(page.getByText("Cancelado pelo profissional")).toBeVisible();
});

test("admin adiciona uma nova profissão sem código e ela aparece no cadastro e na vitrine", async ({ page }) => {
  const profession = `Veterinário ${uid()}`;
  const category = `Pets ${uid()}`;
  const vetName = `Dra. Vet ${uid()}`;
  await login(page, "admin@concord.dev");
  await expect(page).toHaveURL(/\/admin\/perfis/);
  await page.getByLabel("Nova profissão").fill(profession);
  await page.getByRole("button", { name: "Criar perfil" }).click();

  const editor = page.getByLabel("Configuração (JSON)");
  const config = JSON.parse(await editor.inputValue());
  config.category = category;
  config.description = "Consultas e vacinas para cães e gatos.";
  config.terminology.client = { singular: "tutor", plural: "tutores" };
  config.services = [{ name: "Consulta veterinária", durationMin: 40, priceCents: 15000, modality: "IN_PERSON" }];
  // O tipo de atendimento herdado precisa apontar para um serviço que existe.
  config.careTypes[0].services = ["Consulta veterinária"];
  await editor.fill(JSON.stringify(config, null, 2));
  await page.getByRole("button", { name: "Publicar nova versão" }).click();
  await expect(page.getByText("Publicado! Já aparece no cadastro e na vitrine.")).toBeVisible();

  // Validação de schema: regra sensível em AUTO é recusada.
  config.rules = [{ key: "x", name: "x", trigger: "NO_SHOW", conditions: { consecutiveGte: 2 }, actions: [{ type: "CANCEL_FUTURE", graceDays: 1, message: "x" }], mode: "AUTO" }];
  await editor.fill(JSON.stringify(config));
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page.getByText(/Regras sensíveis começam em modo SUGGEST/)).toBeVisible();

  // Novo profissional escolhe a profissão recém-publicada.
  await logout(page);
  await page.goto("/cadastro");
  await page.getByLabel("Seu nome").fill(vetName);
  await page.getByLabel("E-mail").fill(`vet-${uid()}@teste.dev`);
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await page.getByRole("link", { name: new RegExp(profession) }).click();
  await expect(page.getByText(/Seus tutores terão/)).toBeVisible();
  await page.getByLabel("Cidade").fill("Recife");
  await page.getByRole("button", { name: "Pronto, criar minha agenda" }).click();
  await expect(page.getByText("Sua agenda está pronta!")).toBeVisible();

  // Logado como profissional, a vitrine fica em /vitrine (a página inicial leva para /app).
  await page.goto("/vitrine");
  await expect(page.getByRole("link", { name: category })).toBeVisible();
  await page.getByRole("link", { name: category }).click();
  await expect(page).toHaveURL(/categoria=/);
  await expect(page.getByText("1 profissional encontrado")).toBeVisible();
  await expect(page.getByRole("link", { name: vetName })).toBeVisible();
});

test("app do profissional no celular: navegação inferior e agenda @mobile", async ({ page }) => {
  await login(page, "ana@concord.dev");
  const nav = page.getByRole("navigation", { name: "Menu" });
  await expect(nav).toBeVisible();
  await nav.getByRole("link", { name: "Agenda" }).click();
  await expect(page.getByRole("heading", { name: "Agenda" })).toBeVisible();
  await nav.getByRole("link", { name: "Clientes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Pacientes" })).toBeVisible();
});

test("admin vê a plataforma como profissional e como cliente, e volta ao admin", async ({ page }) => {
  await login(page, "admin@concord.dev");
  await page.goto("/admin/ver-como?q=Ana");
  await page.getByRole("group", { name: "Ana Ribeiro" }).getByRole("button", { name: "Ver como" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText(/Vendo como/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Olá, Ana" })).toBeVisible();

  await page.getByRole("button", { name: "Voltar ao admin" }).click();
  await expect(page).toHaveURL(/\/admin\/ver-como/);
  await expect(page.getByText(/Vendo como/)).toHaveCount(0);

  await page.goto("/admin/ver-como?q=maria");
  await page.getByRole("group", { name: /maria@exemplo\.com/ }).getByRole("button", { name: "Ver como" }).click();
  await expect(page).toHaveURL(/\/minha-conta/);
  await expect(page.getByRole("heading", { name: "Olá, Maria" })).toBeVisible();
  await page.getByRole("button", { name: "Voltar ao admin" }).click();
  await expect(page).toHaveURL(/\/admin\/ver-como/);
});

test("quem não é admin não consegue usar o Ver como", async ({ page }) => {
  await login(page, "maria@exemplo.com");
  await page.goto("/admin/ver-como");
  await page.waitForLoadState("networkidle");
  expect(new URL(page.url()).pathname.startsWith("/admin")).toBe(false);
});

test("profissional logado vai direto para a própria área; vitrine só pelo último item do menu", async ({ page }) => {
  await login(page, "carlos@concord.dev");
  await page.goto("/");
  await expect(page).toHaveURL(/\/app$/);

  const links = page.getByRole("navigation", { name: "Menu principal" }).getByRole("link");
  await expect(links.last()).toHaveText("Vitrine pública");
  await links.last().click();
  await expect(page).toHaveURL(/\/vitrine$/);
  await expect(page.getByRole("heading", { name: /Encontre quem cuida de você/ })).toBeVisible();

  // Filtros continuam na vitrine, sem mandar de volta para a área do profissional.
  await page.getByRole("link", { name: "Jurídico", exact: true }).click();
  await expect(page).toHaveURL(/\/vitrine\?categoria=/);
  await expect(page.getByRole("link", { name: "Carlos Mendes" })).toBeVisible();
});

test("visitante continua vendo a vitrine na página inicial", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Encontre quem cuida de você/ })).toBeVisible();
});

test("modo claro é o padrão (mesmo com o sistema escuro) e a escolha fica salva", async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: "dark" });
  const page = await ctx.newPage();
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Mudar para modo escuro" }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Mudar para modo claro" }).click();
  await expect(html).toHaveAttribute("data-theme", "light");
  await ctx.close();
});

test("admin envia imagem de tema, associa à profissão e a página do profissional usa o tema", async ({ page }) => {
  await login(page, "admin@concord.dev");
  await page.goto("/admin/temas");
  // A página do advogado já usa o tema jurídico (imagem cobrindo a página e efeito de vidro).
  const sharp = (await import("sharp")).default;
  const png = await sharp({ create: { width: 1400, height: 800, channels: 3, background: "#2a6f97" } }).png().toBuffer();
  const name = `Tema teste ${Date.now()}`;
  await page.getByLabel("Nome do tema").fill(name);
  await page.getByLabel("Imagem", { exact: true }).setInputFiles({ name: "tema.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Adicionar tema" }).click();
  await expect(page.getByText("Tema criado.")).toBeVisible();
  await expect(page.getByRole("img", { name: `Prévia do tema ${name}` })).toBeVisible();

  await page.goto("/p/carlos-mendes");
  const bg = page.locator('img[src^="/api/temas/"]');
  await expect(bg).toHaveCount(1);
  const res = await page.request.get((await bg.getAttribute("src"))!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("image/webp");

  // Limpeza: exclui o tema de teste.
  await page.goto("/admin/temas");
  await page.locator("div", { has: page.getByRole("img", { name: `Prévia do tema ${name}` }) }).last()
    .locator("xpath=ancestor::div[contains(@class,'overflow-hidden')]").getByRole("button", { name: "Excluir tema" }).click();
  await expect(page.getByText("Tema excluído.")).toBeVisible();
});

test("admin vê como qualquer profissão (prévia), como recepção e como visitante", async ({ page }) => {
  await login(page, "admin@concord.dev");

  // Profissão sem profissional real: Médico.
  await page.goto("/admin/ver-como");
  await page.getByRole("group", { name: "Profissão Médico(a)" }).getByRole("button", { name: /Ver como/ }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText(/Vendo como/)).toContainText("prévia");
  await page.goto("/app/clientes");
  await expect(page.getByRole("heading", { name: "Pacientes" })).toBeVisible();
  await expect(page.getByText("Laura Mendes (exemplo)")).toBeVisible();
  await page.getByRole("button", { name: "Voltar ao admin" }).click();
  await expect(page).toHaveURL(/\/admin\/ver-como/);

  // Recepção da psicóloga: não vê o prontuário (sigilo do perfil).
  await page.getByRole("group", { name: "Ana Ribeiro" }).getByRole("button", { name: "Recepção" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.goto("/app/agenda?ver=lista");
  await page.locator('a[href^="/app/atendimentos/"]').first().click();
  await expect(page.getByText(/Seu papel não tem acesso ao registro/)).toBeVisible();
  await page.getByRole("button", { name: "Voltar ao admin" }).click();

  // Visitante: vitrine sem login.
  await page.getByRole("button", { name: "Ver como visitante" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(/Vendo como/)).toContainText("visitante");
  await expect(page.getByRole("link", { name: "Entrar" })).toBeVisible();
  await page.getByRole("button", { name: "Voltar ao admin" }).click();
  await expect(page).toHaveURL(/\/admin\/ver-como/);
});

test("contas de prévia não fazem login", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill("profissional.medico@previa.drapconcord.invalid");
  await page.getByLabel("Senha").fill("qualquer-coisa");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
});

test("triagem: cliente responde, recebe recomendação, agenda; profissional vê prioridade e respostas", async ({ page }) => {
  const name = `Paciente Triagem ${uid()}`;
  await page.goto("/p/ana-ribeiro");
  await page.getByRole("link", { name: "Agendar com triagem" }).click();
  await expect(page.getByRole("heading", { name: "O que você procura?" })).toBeVisible();
  await page.getByRole("link", { name: /Terapia individual \(adultos\)/ }).click();

  await page.getByLabel("Ansiedade").check();
  await page.getByLabel(/pensamentos de se machucar/).selectOption("Às vezes");
  await page.getByLabel(/Como prefere ser atendido/).selectOption("Online");
  await page.getByRole("button", { name: "Ver recomendação e horários" }).click();

  await expect(page.getByRole("heading", { name: "Recomendado para você" })).toBeVisible();
  await expect(page.locator("main").getByText("Sessão online").first()).toBeVisible();
  await expect(page.getByText(/188/).first()).toBeVisible();

  await page.locator('label:has(input[name="horario"])').nth(20).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Nome completo").fill(name);
  await page.getByLabel("E-mail").fill(`triagem-${uid()}@teste.dev`);
  await page.getByLabel("Celular / WhatsApp").fill("(11) 90000-0001");
  await page.getByLabel("Crie uma senha").fill(PASSWORD);
  await page.getByRole("checkbox", { name: /Autorizo o tratamento/ }).check();
  await page.getByRole("button", { name: "Confirmar agendamento" }).click();
  await expect(page.getByRole("heading", { name: "Pedido enviado!" })).toBeVisible();

  await page.context().clearCookies();
  await login(page, "ana@concord.dev");
  await page.goto("/app/clientes?q=" + encodeURIComponent(name));
  await page.getByRole("link", { name: new RegExp(name) }).click();
  await expect(page.getByText("atenção-risco").first()).toBeVisible();
  await page.getByRole("link", { name: "Ver respostas no atendimento →" }).click();
  const card = page.locator("div", { has: page.getByRole("heading", { name: "Triagem", exact: true }) }).last();
  await expect(card.getByText("Urgente")).toBeVisible();
  await expect(card.getByText("Às vezes")).toBeVisible();
});

test("triagem: sinal de emergência interrompe o agendamento online", async ({ page }) => {
  await login(page, "admin@concord.dev");
  await page.goto("/admin/ver-como");
  await page.getByRole("group", { name: "Profissão Médico(a)" }).getByRole("button", { name: /Ver como/ }).click();
  await expect(page).toHaveURL(/\/app$/);
  const slug = (await page.getByRole("link", { name: /^\/p\// }).first().textContent())!.replace("/p/", "").trim();
  await page.goto(`/p/${slug}/agendar`);
  await page.getByRole("link", { name: /Sintoma ou queixa nova/ }).click();
  await page.getByLabel("Dor ou aperto no peito").check();
  await page.getByLabel(/Conte o que está sentindo/).fill("Aperto no peito desde cedo");
  await page.getByLabel(/Desde quando/).selectOption("Começou hoje");
  await page.getByLabel(/Como prefere ser atendido/).selectOption("Presencial");
  await page.getByRole("button", { name: "Ver recomendação e horários" }).click();
  await expect(page.getByRole("heading", { name: "Procure atendimento imediato" })).toBeVisible();
  await expect(page.getByText(/192/).first()).toBeVisible();
  await expect(page.locator('input[name="horario"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Voltar ao admin" }).click();
});

async function inviteLink(page: Page) {
  const url = await page.getByLabel("Link do convite").inputValue();
  return new URL(url, "http://x").pathname;
}

test("convite pessoal: cliente cria a conta (Acesso 2) já ligada à ficha existente", async ({ page }) => {
  const id = uid();
  const email = `convidada-${id}@teste.dev`;
  await login(page, "ana@concord.dev");
  await page.goto("/app/clientes/novo");
  await page.getByLabel("Nome completo").fill(`Convidada ${id}`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("button", { name: "Salvar" }).click();
  await page.waitForURL(/\/app\/clientes\/(?!novo)[^/]+$/);
  const ficha = new URL(page.url()).pathname;
  await page.getByRole("button", { name: "Enviar convite de acesso" }).click();
  await expect(page.getByRole("link", { name: "Enviar no WhatsApp" })).toHaveAttribute("href", /wa\.me/);
  const link = await inviteLink(page);
  await logout(page);

  await page.goto(link);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Ana Ribeiro convidou você");
  await expect(page.getByLabel("E-mail")).toHaveValue(email);
  await page.getByLabel("Celular (WhatsApp)").fill("(11) 91111-2222");
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Criar conta e aceitar" }).click();
  await page.waitForURL(/\/minha-conta/);
  await expect(page.getByText(/Sua conta \(Acesso 2\) está pronta, ligada a Ana Ribeiro/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Meus profissionais" })).toBeVisible();

  // O link pessoal só vale uma vez.
  await logout(page);
  await page.goto(link);
  await expect(page.getByText("Convite indisponível")).toBeVisible();

  await login(page, "ana@concord.dev");
  await page.goto(ficha);
  await expect(page.getByText("Usa o portal")).toBeVisible();
});

test("link geral de convite cria cliente novo; cliente já logado aceita com um clique", async ({ page }) => {
  await login(page, "carlos@concord.dev");
  await page.getByRole("link", { name: "Convidar clientes" }).first().click();
  await expect(page.getByRole("heading", { name: "Convidar clientes" })).toBeVisible();
  const link = await inviteLink(page);
  await logout(page);

  const email = `geral-${uid()}@teste.dev`;
  await page.goto(link);
  await page.getByLabel("Seu nome").fill("Cliente Geral");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Celular (WhatsApp)").fill("(11) 93333-4444");
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Criar conta e aceitar" }).click();
  await expect(page.getByText(/ligada a Carlos Mendes/)).toBeVisible();

  // Maria (cliente da Ana) entra pelo link do Carlos e liga a conta com um clique.
  await logout(page);
  await login(page, "maria@exemplo.com");
  await page.goto(link);
  await page.getByRole("button", { name: "Aceitar convite" }).click();
  await page.waitForURL(/\/minha-conta/);
  await expect(page.getByRole("heading", { name: "Meus profissionais" })).toBeVisible();
  await expect(page.getByText("Carlos Mendes").first()).toBeVisible();

  await logout(page);
  await login(page, "carlos@concord.dev");
  await page.goto("/app/clientes?q=Cliente%20Geral");
  await expect(page.getByText("Cliente Geral").first()).toBeVisible();
});

test("cadastro mostra os dois tipos de conta e cria conta de cliente (Acesso 2)", async ({ page }) => {
  await page.goto("/cadastro");
  await expect(page.getByRole("link", { name: /Acesso 1/ })).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: /Acesso 2/ }).click();
  await page.getByLabel("Seu nome").fill("Aluno Teste");
  await page.getByLabel("E-mail").fill(`aluno-${uid()}@teste.dev`);
  await page.getByLabel("Celular (WhatsApp)").fill("(11) 95555-6666");
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(page).toHaveURL(/\/minha-conta/, { timeout: 15_000 });
  await expect(page.getByText("Acesso 2 · Cliente")).toBeVisible();
});

test("profissional não aceita convite com conta de Acesso 1", async ({ page }) => {
  await login(page, "carlos@concord.dev");
  await page.goto("/app/convites");
  const link = await inviteLink(page);
  await logout(page);
  await login(page, "juliana@concord.dev");
  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Este convite é para clientes" })).toBeVisible();
});

test("o tema da profissão acompanha a conta: portal do cliente e vitrine do profissional", async ({ page }) => {
  const themed = page.locator('img[src^="/api/temas/"]');
  await login(page, "maria@exemplo.com");
  await page.goto("/minha-conta");
  await expect(themed).toHaveCount(1);
  await page.goto("/termos");
  await expect(themed).toHaveCount(1);
  await logout(page);
  await login(page, "ana@concord.dev");
  await page.goto("/vitrine");
  await expect(themed).toHaveCount(1);
  await logout(page);
  await page.goto("/");
  await expect(themed).toHaveCount(0);
});

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

test("profissional cria a própria marca: nome, logo, fundo, cor, fonte e contatos aparecem na página pública", async ({ page }) => {
  await login(page, "juliana@concord.dev");
  await page.getByRole("link", { name: "Minha marca" }).first().click();
  await expect(page.getByRole("heading", { name: "Minha marca" })).toBeVisible();

  await page.getByLabel("Nome da marca ou empresa").fill("Studio Movimento");
  await page.getByLabel("Frase de apresentação").fill("Treinos que cabem na sua rotina");
  await page.getByLabel("Logo", { exact: true }).setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Salvar identidade" }).click();
  await expect(page.getByText("Identidade salva.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Studio Movimento, início" })).toBeVisible();

  await page.getByRole("radio", { name: /Sem imagem/ }).check();
  await page.getByRole("radio", { name: "Usar a cor da minha marca" }).check();
  await page.getByLabel("Cor da marca").fill("#1d4ed8");
  await page.getByLabel("Fonte dos títulos").selectOption("moderna");
  await page.getByRole("button", { name: "Salvar visual" }).click();
  await expect(page.getByText("Visual salvo.")).toBeVisible();
  await expect(page.locator('div.fixed.inset-0 img')).toHaveCount(0);

  await page.getByLabel("WhatsApp").fill("(11) 98765-4321");
  await page.getByLabel("Instagram").fill("@studiomovimento");
  await page.getByLabel("Texto do botão de agendar").fill("Reservar treino");
  await page.getByRole("checkbox", { name: "Preços dos serviços" }).uncheck();
  await page.getByRole("button", { name: "Salvar página" }).click();
  await expect(page.getByText("Página salva.")).toBeVisible();

  await logout(page);
  await page.goto("/p/juliana-costa");
  await expect(page.getByRole("heading", { level: 1, name: "Studio Movimento" })).toBeVisible();
  await expect(page.getByText("Treinos que cabem na sua rotina")).toBeVisible();
  await expect(page.getByRole("img", { name: "Logo de Studio Movimento" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", "https://wa.me/5511987654321");
  await expect(page.getByRole("link", { name: "@studiomovimento" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Reservar treino" }).first()).toBeVisible();
  await expect(page.getByText(/R\$/)).toHaveCount(0);
  const primary = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--primary").trim());
  expect(primary).not.toBe("");
  const font = await page.evaluate(() => getComputedStyle(document.querySelector("h1")!).fontFamily);
  expect(font).toMatch(/inter/i);

  // Volta ao padrão da profissão.
  await login(page, "juliana@concord.dev");
  await page.goto("/app/marca");
  await page.getByRole("button", { name: "Voltar ao visual padrão da profissão" }).click();
  await expect(page.getByText("Marca restaurada")).toBeVisible();
  await expect(page.getByRole("link", { name: "Juliana Costa, início" })).toBeVisible();
});

test("profissional define o próprio modo de atendimento: triagem, nomes e confirmação", async ({ page }) => {
  await login(page, "rafael@concord.dev");
  await page.getByRole("link", { name: "Como atendo" }).first().click();
  await page.getByLabel("Cliente (plural)").fill("Alunos");
  await page.getByLabel("Cliente (singular)").fill("Aluno");
  await page.getByRole("radio", { name: /Confirmar na hora/ }).check();
  const triage = page.getByRole("checkbox", { name: "Usar triagem na minha página" });
  if (await triage.count()) await triage.uncheck();
  await page.getByRole("button", { name: "Salvar modo de atendimento" }).click();
  await expect(page.getByText("Modo de atendimento salvo.")).toBeVisible();
  await page.goto("/app/clientes");
  await expect(page.getByRole("heading", { name: "Alunos" })).toBeVisible();

  await logout(page);
  await page.goto("/p/rafael-souza");
  await expect(page.getByRole("link", { name: /com triagem/ })).toHaveCount(0);

  // Agendamento pelo cliente já entra confirmado.
  await page.getByRole("link", { name: "Agendar" }).first().click();
  await page.locator('label:has(input[name="horario"])').first().click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Nome completo").fill("Aluno Confirmado");
  await page.getByLabel("E-mail").fill(`aluno-${uid()}@teste.dev`);
  await page.getByLabel("Celular / WhatsApp").fill("(11) 90000-1111");
  await page.getByLabel("Crie uma senha").fill(PASSWORD);
  for (const box of await page.getByRole("checkbox").all()) await box.check();
  await page.getByRole("button", { name: "Confirmar agendamento" }).click();
  await page.waitForURL(/agendado|minha-conta/);
  await page.goto("/minha-conta");
  await expect(page.getByText("Confirmado").first()).toBeVisible();

  await logout(page);
  await login(page, "rafael@concord.dev");
  await page.goto("/app/atendimento");
  await page.getByLabel("Cliente (plural)").fill("Clientes");
  await page.getByLabel("Cliente (singular)").fill("Cliente");
  await page.getByRole("radio", { name: /Fica pendente/ }).check();
  if (await triage.count()) await triage.check();
  await page.getByRole("button", { name: "Salvar modo de atendimento" }).click();
  await expect(page.getByText("Modo de atendimento salvo.")).toBeVisible();
});
