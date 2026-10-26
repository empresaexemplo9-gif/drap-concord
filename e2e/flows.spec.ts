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
  await page.waitForLoadState("load");
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
  // A página de cadastro de profissional também tem "Seu nome": espera trocar de página.
  await page.waitForURL(/\/cadastro\/cliente$/);
  await expect(page.getByRole("heading", { name: "Sua conta para agendar atendimentos" })).toBeVisible();
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
  // Visitante vê a home vestida pela imagem da plataforma.
  await expect(page.locator('img[src="/home/home.webp"]')).toHaveCount(1);
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
  await page.getByRole("group", { name: /Cor principal/ }).getByRole("radio", { name: "Minha cor" }).check();
  await page.getByLabel("Cor principal da marca").fill("#1d4ed8");
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

const remoteVideoWidth = (p: Page) =>
  p.evaluate(() => (document.querySelector("[data-testid=remote-tile] video") as HTMLVideoElement | null)?.videoWidth ?? 0);

test("chamada de vídeo: profissional chama, o cliente recebe tocando na conta, atende e os dois se veem e conversam", async ({ browser }) => {
  const pro = await browser.newContext({ permissions: ["camera", "microphone"] });
  const cli = await browser.newContext({ permissions: ["camera", "microphone"] });
  const a = await pro.newPage();
  const m = await cli.newPage();
  await login(m, "maria@exemplo.com");
  await m.goto("/minha-conta");
  await login(a, "ana@concord.dev");
  await a.goto("/app/chamadas");
  await a.getByRole("checkbox", { name: /Maria Oliveira/ }).check();
  await a.getByRole("button", { name: "Chamar", exact: true }).click();
  await a.waitForURL(/\/chamadas\/[^/?]+$/);

  const ring = m.getByRole("alertdialog");
  await expect(ring).toContainText("Ana Ribeiro", { timeout: 15_000 });
  await expect(ring).toContainText("Chamada de vídeo");
  await ring.getByRole("button", { name: "Atender" }).click();
  await m.waitForURL(/atender=1/);

  await expect.poll(() => remoteVideoWidth(a), { timeout: 30_000 }).toBeGreaterThan(0);
  await expect.poll(() => remoteVideoWidth(m), { timeout: 30_000 }).toBeGreaterThan(0);
  await expect(a.getByText("2 na chamada")).toBeVisible();

  await m.getByRole("button", { name: "Conversa" }).click();
  await m.getByLabel("Mensagem").fill("Oi, Ana! Estou te ouvindo bem.");
  await m.getByRole("button", { name: "Enviar" }).click();
  await a.getByRole("button", { name: "Conversa" }).click();
  await expect(a.getByText("Oi, Ana! Estou te ouvindo bem.")).toBeVisible({ timeout: 10_000 });

  await m.getByRole("button", { name: "Desligar microfone" }).click();
  await expect(a.locator("[data-testid=remote-tile]").getByText("Maria Oliveira")).toBeVisible();

  await a.getByRole("button", { name: "Encerrar para todos" }).click();
  await expect(m.getByRole("heading", { name: "Chamada encerrada" })).toBeVisible({ timeout: 15_000 });
  await pro.close();
  await cli.close();
});

test("cliente chama o profissional por áudio, ele recusa e a chamada aparece como recusada", async ({ browser }) => {
  const pro = await browser.newContext({ permissions: ["camera", "microphone"] });
  const cli = await browser.newContext({ permissions: ["camera", "microphone"] });
  const a = await pro.newPage();
  const m = await cli.newPage();
  await login(a, "ana@concord.dev");
  await a.goto("/app");
  await login(m, "maria@exemplo.com");
  await m.goto("/minha-conta/chamadas");
  await m.getByRole("checkbox", { name: /Ana Ribeiro/ }).check();
  await m.getByRole("radio", { name: "Só áudio" }).check();
  await m.getByRole("button", { name: "Chamar", exact: true }).click();
  await m.waitForURL(/\/chamadas\/[^/?]+$/);

  const ring = a.getByRole("alertdialog");
  await expect(ring).toContainText("Maria Oliveira", { timeout: 15_000 });
  await expect(ring).toContainText("Chamada de áudio");
  await ring.getByRole("button", { name: "Recusar" }).click();
  await expect(ring).toBeHidden();

  await m.getByRole("button", { name: "Participantes" }).click();
  await expect(m.getByText("recusou")).toBeVisible({ timeout: 15_000 });
  await pro.close();
  await cli.close();
});

test("sala com três pessoas: todos se veem e o dono adiciona alguém durante a chamada", async ({ browser }) => {
  const ctx = () => browser.newContext({ permissions: ["camera", "microphone"] });
  const [pc, mc, jc] = await Promise.all([ctx(), ctx(), ctx()]);
  const a = await pc.newPage();
  const m = await mc.newPage();
  const j = await jc.newPage();

  // Terceira pessoa entra pelo convite da Ana e vira contato dela.
  await login(a, "ana@concord.dev");
  await a.goto("/app/convites");
  const link = await inviteLink(a);
  const id = uid();
  const email = `grupo-${id}@teste.dev`;
  await j.goto(link);
  await j.getByLabel("Seu nome").fill(`Joana ${id}`);
  await j.getByLabel("E-mail").fill(email);
  await j.getByLabel("Celular (WhatsApp)").fill("(11) 97777-0000");
  await j.getByLabel("Senha").fill(PASSWORD);
  await j.getByRole("checkbox").check();
  await j.getByRole("button", { name: "Criar conta e aceitar" }).click();
  await expect(j).toHaveURL(/minha-conta/, { timeout: 15_000 });

  await login(m, "maria@exemplo.com");
  await m.goto("/minha-conta");

  // Ana começa só com a Maria e adiciona a Joana durante a chamada.
  await a.goto("/app/chamadas");
  await a.getByRole("checkbox", { name: /Maria Oliveira/ }).check();
  await a.getByLabel("Nome da sala (opcional)").fill("Grupo de apoio");
  await a.getByRole("button", { name: "Chamar", exact: true }).click();
  await a.waitForURL(/\/chamadas\/[^/?]+$/);
  await m.getByRole("alertdialog").getByRole("button", { name: "Atender" }).click({ timeout: 15_000 });
  await expect.poll(() => remoteVideoWidth(a), { timeout: 30_000 }).toBeGreaterThan(0);

  await a.getByRole("button", { name: "Participantes" }).click();
  await a.getByRole("checkbox", { name: new RegExp(`Joana ${id}`) }).check();
  await a.getByRole("button", { name: /^Chamar \(1\)/ }).click();
  const ring = j.getByRole("alertdialog");
  await expect(ring).toContainText("Grupo de apoio", { timeout: 15_000 });
  await ring.getByRole("button", { name: "Atender" }).click();

  const tilesWithVideo = (p: Page) =>
    p.evaluate(() => [...document.querySelectorAll("[data-testid=remote-tile] video")].filter((v) => (v as HTMLVideoElement).videoWidth > 0).length);
  for (const p of [a, m, j]) await expect.poll(() => tilesWithVideo(p), { timeout: 30_000 }).toBe(2);
  await expect(j.getByText("3 na chamada")).toBeVisible();

  // Quem sai some da tela dos outros; a sala continua.
  await j.getByRole("button", { name: "Sair da chamada" }).click();
  await expect.poll(() => tilesWithVideo(a), { timeout: 15_000 }).toBe(1);
  await Promise.all([pc.close(), mc.close(), jc.close()]);
});

test("página de download do app para todos os sistemas e manifesto completo", async ({ page, request }) => {
  await page.goto("/baixar");
  await expect(page.getByRole("heading", { level: 1, name: "Baixe o app DRAP Concord" })).toBeVisible();
  for (const name of ["Android", "iPhone", "iPad", "Windows", "macOS", "Linux", "ChromeOS"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.getByRole("heading", { level: 2, name, exact: true })).toBeVisible();
  }
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.id).toBe("/");
  expect(manifest.icons.some((i: { purpose: string }) => i.purpose === "maskable")).toBe(true);
  expect(manifest.screenshots.length).toBeGreaterThanOrEqual(2);
  for (const src of ["/icons/icon-512.png", "/icons/maskable-512.png", "/icons/apple-touch-icon.png", "/favicon.ico", manifest.screenshots[0].src]) {
    expect((await request.get(src)).status()).toBe(200);
  }
  const links = await (await request.get("/.well-known/assetlinks.json")).json();
  expect(links[0].target.package_name).toBe("com.drapconcord.app");

  // Instaladores próprios, baixados pelo navegador.
  await page.getByRole("button", { name: "Android", exact: true }).click();
  const apk = page.getByRole("link", { name: /Baixar o app para Android/ });
  await expect(apk).toHaveAttribute("href", "/downloads/drap-concord.apk");
  const [download] = await Promise.all([page.waitForEvent("download"), apk.click()]);
  expect(download.suggestedFilename()).toBe("drap-concord.apk");
  await page.getByRole("button", { name: "Windows", exact: true }).click();
  await expect(page.getByRole("link", { name: /Baixar para Windows/ })).toHaveAttribute("href", "/downloads/DRAP-Concord-Windows-x64.exe");
  await page.getByRole("button", { name: "iPhone", exact: true }).click();
  await expect(page.getByText("Adicionar à Tela de Início").first()).toBeVisible();
  for (const f of ["drap-concord.apk", "DRAP-Concord-Windows-x64.exe", "DRAP-Concord-Windows-ARM64.exe", "DRAP-Concord-macOS.zip", "drap-concord_1.0.0_all.deb", "drap-concord-linux.tar.gz"]) {
    const r = await request.get(`/downloads/${f}`);
    expect(r.status()).toBe(200);
    expect(r.headers()["content-disposition"]).toContain("attachment");
  }
});

test("mapa do atendimento presencial: profissional marca o local, aparece na página e na busca perto de mim", async ({ browser }) => {
  const pro = await browser.newContext();
  const a = await pro.newPage();
  await login(a, "ana@concord.dev");
  await a.goto("/app/atendimento");
  await a.getByLabel("Endereço do atendimento presencial").fill("Avenida Paulista, 1000, Bela Vista, São Paulo");
  await a.getByRole("button", { name: "Buscar no mapa" }).click();
  await expect(a.getByRole("region", { name: "Local de atendimento no mapa" })).toBeVisible();
  await expect(a.getByText("Local marcado.")).toBeVisible();
  const lat = Number(await a.locator('input[name="latitude"]').inputValue());
  const lng = Number(await a.locator('input[name="longitude"]').inputValue());
  expect(lat).not.toBe(0);
  await a.getByLabel("Atendo a domicílio até (km)").fill("10");
  await a.getByRole("button", { name: "Salvar modo de atendimento" }).click();
  await expect(a.getByText("Modo de atendimento salvo.")).toBeVisible();
  await pro.close();

  // Visitante perto do consultório.
  const visitor = await browser.newContext({ geolocation: { latitude: lat + 0.01, longitude: lng }, permissions: ["geolocation"] });
  const v = await visitor.newPage();
  await v.goto("/p/ana-ribeiro");
  await expect(v.getByRole("heading", { name: "Onde fica" })).toBeVisible();
  await expect(v.getByText("Avenida Paulista, 1000, Bela Vista, São Paulo").first()).toBeVisible();
  await expect(v.getByRole("link", { name: "Google Maps" })).toHaveAttribute("href", new RegExp(`destination=${lat}`));
  await expect(v.getByRole("link", { name: "Waze" })).toBeVisible();
  await v.getByRole("button", { name: "Ver distância de mim" }).click();
  await expect(v.getByText(/Fica a 1,1 km de você/)).toBeVisible();

  await v.goto("/");
  await v.getByRole("button", { name: "Perto de mim" }).click();
  await v.waitForURL(/lat=/);
  await expect(v.getByText("Perto de você")).toBeVisible();
  await expect(v.getByRole("link", { name: "Ana Ribeiro" }).first()).toBeVisible();
  await expect(v.getByText(/a 1,1 km de você/).first()).toBeVisible();
  await expect(v.getByRole("link", { name: "Carlos Mendes" })).toHaveCount(0); // sem local cadastrado
  await v.getByRole("link", { name: "Mapa", exact: true }).click();
  await expect(v.getByRole("region", { name: "Profissionais no mapa" })).toBeVisible();
  await visitor.close();
});

test("personalização completa: paleta, cantos, galeria, perguntas frequentes, ordem das seções e recado", async ({ page }) => {
  await login(page, "juliana@concord.dev");
  await page.goto("/app/marca");

  await page.getByRole("button", { name: "Paleta Floresta" }).click();
  await page.getByRole("radio", { name: /Arredondados/ }).check();
  await page.getByRole("button", { name: "Salvar visual" }).click();
  await expect(page.getByText("Visual salvo.")).toBeVisible();
  const corner = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--corner-xl").trim());
  expect(corner).toBe("1.4rem");

  await page.getByRole("button", { name: "+ Adicionar pergunta" }).click();
  await page.getByLabel("Pergunta 1").fill("Preciso levar algo para o treino?");
  await page.getByLabel("Resposta 1").fill("Só roupa confortável e uma garrafa de água.");
  // Perguntas frequentes vão para o topo da página.
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Subir Perguntas frequentes" }).click();
  await page.getByLabel("Mensagem depois do agendamento").fill("Chegue 10 minutos antes para o aquecimento.");
  await page.getByRole("button", { name: "Salvar conteúdo" }).click();
  await expect(page.getByText("Conteúdo da página salvo.")).toBeVisible();

  await page.getByLabel("Adicionar foto").setInputFiles({ name: "studio.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Enviar foto" }).click();
  await expect(page.getByText("Foto adicionada à galeria.")).toBeVisible();
  await expect(page.getByText("1 de 8")).toBeVisible();

  await logout(page);
  await page.goto("/p/juliana-costa");
  const headings = await page.getByRole("heading", { level: 2 }).allTextContents();
  expect(headings.indexOf("Perguntas frequentes")).toBeLessThan(headings.indexOf("Serviços"));
  await page.getByText("Preciso levar algo para o treino?").click();
  await expect(page.getByText("Só roupa confortável e uma garrafa de água.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Galeria" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Foto 1 de/ })).toBeVisible();
  const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
  expect(accent).not.toBe("");

  await login(page, "juliana@concord.dev");
  await page.goto("/app/marca");
  await page.getByRole("button", { name: "Remover foto" }).click();
  await expect(page.getByText("Foto removida.")).toBeVisible();
  await page.getByRole("button", { name: "Voltar ao visual padrão da profissão" }).click();
  await expect(page.getByText("Marca restaurada")).toBeVisible();
});

test("explorar no globo 3D: profissionais no globo, busca com voo até o local e cartão para agendar", async ({ browser, request }) => {
  // Garante um profissional com local de atendimento.
  const pro = await browser.newContext();
  const a = await pro.newPage();
  await login(a, "ana@concord.dev");
  await a.goto("/app/atendimento");
  await a.getByLabel("Endereço do atendimento presencial").fill("Rua Augusta, 500, Consolação, São Paulo");
  await a.getByRole("button", { name: "Buscar no mapa" }).click();
  await expect(a.getByText("Local marcado.")).toBeVisible();
  const lat = Number(await a.locator('input[name="latitude"]').inputValue());
  await a.getByRole("button", { name: "Salvar modo de atendimento" }).click();
  await expect(a.getByText("Modo de atendimento salvo.")).toBeVisible();
  await pro.close();

  const geo = await (await request.get("/api/globo")).json();
  const ana = geo.features.find((f: { properties: { slug: string } }) => f.properties.slug === "ana-ribeiro");
  expect(ana.geometry.coordinates[1]).toBeCloseTo(lat, 4);

  const ctx = await browser.newContext();
  const v = await ctx.newPage();
  // Imagens de satélite e ruas vêm de fora; no teste, só a estrutura do globo.
  await v.route(/gibs\.earthdata|openfreemap\.org|elevation-tiles/, (r) => r.abort());
  await v.goto("/explorar");
  await v.waitForSelector('[data-ready="1"]', { state: "attached", timeout: 60_000 });
  await expect(v.locator("canvas.maplibregl-canvas")).toBeVisible();
  await v.getByRole("button", { name: "Parar o giro" }).click();
  const panel = v.getByRole("complementary", { name: "Profissionais nesta área" });
  await expect(panel.getByText("Ana Ribeiro")).toBeVisible();

  await v.getByLabel("Buscar no globo").fill("Ana Ribeiro");
  await v.getByRole("button", { name: "Ir", exact: true }).click();
  await expect.poll(async () => Number((await v.getAttribute('[data-testid="globo"]', "data-center"))!.split(",")[0]), { timeout: 20_000 }).toBeCloseTo(lat, 1);
  const card = v.getByRole("dialog", { name: "Ana Ribeiro" });
  await expect(card).toBeVisible();
  await expect(card.getByRole("link", { name: "Agendar" })).toHaveAttribute("href", "/p/ana-ribeiro/agendar");
  await ctx.close();
});
