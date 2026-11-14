# Design system

**Sensação:** profissional, calmo e confiável: neutros frios e suaves, pouco contraste de cor e acabamento discreto.

## Tokens (`src/app/globals.css`)

| Token | Claro | Uso |
| --- | --- | --- |
| `bg` | `#F5F7F8` cinza-névoa | fundo |
| `surface` | `#EDF1F3` cinza-gelo | painéis, menu lateral |
| `card` | `#FFFFFF` | cartões, campos |
| `primary` | `#2F6475` azul-petróleo sereno (hover `#26525F`) | ações, links |
| `accent` | `#477770` sálvia | destaques, foco |
| `success` | `#3D6A50` sobre `#E4EFE8` | confirmado |
| `gold` | `#C99A3E` | avaliações |
| `ink` / `muted` | `#1E2A32` / `#5C6B75` | texto |
| `danger` / `warning` / `info` | `#A2453A` / `#7A5512` / `#2F6475` | estados |
| `line` | `#E1E7EA` | bordas |

Todos os textos passam no **WCAG AA (≥ 4,5:1)** sobre os fundos em que aparecem. Há modo escuro (automático pelo sistema ou `data-theme="dark"`), com grafite azulado e os mesmos tons em versão clara.

**Fundo:** o padrão é liso, sem foto, em toda a plataforma. A home usa só a cor de fundo, um brilho suave da cor principal no topo e o logo em marca d'água (`components/home-scenes.tsx`). Imagem de fundo é opcional: o profissional escolhe em "Minha marca" (profissão, galeria ou foto própria).

**Temas com imagem (opcionais):** a cor marcante da foto entra dessaturada (`soften` em `lib/themes/colors.ts`), a foto aparece um pouco menos saturada sob um véu mais forte e os cartões de vidro ficam quase opacos, para a imagem não competir com o conteúdo.

**Tipografia:** Inter nos títulos e no corpo, via `next/font`. Fraunces, Playfair Display e Nunito ficam como opções da marca do profissional e só baixam quando escolhidas.

**Forma e movimento:** cantos de 12 a 20 px, sombras suaves, transições de 180 ms, respeito a "reduzir movimento", estados vazios com ilustração de traço e texto humano.

## Componentes (`src/components`)

`Button`/`ButtonLink` (primary, secondary, ghost, danger; altura mínima de 44 px), `Card`, `Badge`, `Input`/`Select`/`Textarea`/`Field` (rótulo, dica e erro), `Alert`, `EmptyState`, `PageHeader`, `Avatar`, `Stars`, `Logo`/`Brand`, `SlotPicker` (horários como botões de rádio; funciona sem JS), `DynamicFields` (formulário montado a partir do perfil), `AppointmentRow`, navegação lateral (desktop) e inferior (celular).

## Padrões

- Mobile-first: barra inferior e botão flutuante "+" no celular; menu lateral no desktop.
- Ação principal sempre visível ("Novo agendamento").
- Agendar pelo cliente: 3 passos (serviço → horário → dados).
- Foco visível, rótulos em todos os campos, alvos de toque ≥ 44 px, `aria-current` na navegação.
