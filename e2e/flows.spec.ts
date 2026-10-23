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

  await page.goto("/");
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
  await nav.getByRole("link", { name: "Clientes" }).click();
  await expect(page.getByRole("heading", { name: "Pacientes" })).toBeVisible();
});

test("admin vê a plataforma como profissional e como cliente, e volta ao admin", async ({ page }) => {
  await login(page, "admin@concord.dev");
  await page.goto("/admin/ver-como?q=Ana");
  await page.getByRole("group", { name: "Ana Ribeiro" }).getByRole("button", { name: "Ver como" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText(/Você está vendo como/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Olá, Ana" })).toBeVisible();

  await page.getByRole("button", { name: "Voltar ao admin" }).click();
  await expect(page).toHaveURL(/\/admin\/ver-como/);
  await expect(page.getByText(/Você está vendo como/)).toHaveCount(0);

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
