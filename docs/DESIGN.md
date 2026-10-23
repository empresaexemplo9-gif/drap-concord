# Design system

**Sensação:** acolhedor, calmo e confiável, com acabamento premium.

## Tokens (`src/app/globals.css`)

| Token | Claro | Uso |
| --- | --- | --- |
| `bg` | `#FBF7F2` creme quente | fundo |
| `surface` | `#F3EBDF` areia | painéis, menu lateral |
| `primary` | `#1F4E5A` azul-petróleo (hover `#173B44`) | ações, logo |
| `accent` | `#C8745A` terracota | destaques, foco (anel de 3:1) |
| `success` | sálvia `#46654E` sobre `#E3EBE4` | confirmado |
| `gold` | `#D9A441` | avaliações |
| `ink` / `muted` | `#2B2622` / `#6B6259` | texto |
| `danger` / `warning` / `info` | `#9C3B2F` / `#7F520E` / `#2F6473` | estados |

Os tons de estado foram escurecidos em relação ao prompt para passar no **WCAG AA (≥ 4,5:1)** sobre os fundos dos selos. Há modo escuro (automático pelo sistema ou `data-theme="dark"`).

**Tipografia:** Fraunces nos títulos e Inter no corpo, via `next/font`.

**Forma e movimento:** cantos de 12 a 20 px, sombras suaves, transições de 180 ms, respeito a "reduzir movimento", estados vazios com ilustração de traço e texto humano.

## Componentes (`src/components`)

`Button`/`ButtonLink` (primary, secondary, ghost, danger; altura mínima de 44 px), `Card`, `Badge`, `Input`/`Select`/`Textarea`/`Field` (rótulo, dica e erro), `Alert`, `EmptyState`, `PageHeader`, `Avatar`, `Stars`, `Logo`/`Brand`, `SlotPicker` (horários como botões de rádio; funciona sem JS), `DynamicFields` (formulário montado a partir do perfil), `AppointmentRow`, navegação lateral (desktop) e inferior (celular).

## Padrões

- Mobile-first: barra inferior e botão flutuante "+" no celular; menu lateral no desktop.
- Ação principal sempre visível ("Novo agendamento").
- Agendar pelo cliente: 3 passos (serviço → horário → dados).
- Foco visível, rótulos em todos os campos, alvos de toque ≥ 44 px, `aria-current` na navegação.
