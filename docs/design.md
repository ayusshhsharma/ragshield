# Design — RAGShield UI

Dark-first, professional developer-tool look (think Linear/Vercel dashboards): dense but calm, strong status colors, monospace for technical data. Desktop-first, usable down to 375 px.

## 1. Tokens (Tailwind 3.4 `theme.extend.colors`)
| Token | Hex | Use |
|---|---|---|
| `base` | `#0B0F17` | page background |
| `surface` | `#111827` | cards, sidebar |
| `elevated` | `#1A2233` | modals, drawers, hover rows |
| `line` | `#263042` | borders, dividers |
| `ink` | `#E5E7EB` | primary text |
| `muted` | `#9CA3AF` | secondary text |
| `brand` | `#6366F1` | primary buttons, active nav, links |
| `brand-hover` | `#818CF8` | hover |
| `danger` | `#EF4444` | attack succeeded, destructive |
| `success` | `#22C55E` | blocked/safe improvements |
| `warning` | `#F59E0B` | errors, ambiguous |
| `info` | `#38BDF8` | safe/refused |
Fonts: system UI stack for text, `ui-monospace, SFMono-Regular, Menlo, monospace` for code, IDs, prompts, responses (no external font CDN). Radius `rounded-lg` for cards, `rounded-md` for inputs. Spacing scale: 4/8/12/16/24/32. Base text 14 px, headings 20/24/30 px.

## 2. Outcome and status semantics (use consistently everywhere)
| Value | Label | Badge color |
|---|---|---|
| `attack_succeeded` | Attack succeeded | danger |
| `blocked_by_defense` | Blocked | success |
| `model_refused_or_safe` | Safe / refused | info |
| `benign_answered` | Answered | muted |
| `error` | Error | warning |
Run status: `queued` muted, `running` brand (animated pulse), `completed` success, `failed` danger, `cancelled` warning. Colors never carry meaning alone: every badge has a text label.
In comparisons, **lower ASR = good (green delta)**, higher FPR = bad (red delta), higher latency = neutral/warning.

## 3. Layout
- `AppLayout`: fixed left sidebar (≥ md) with logo "RAGShield", nav (Dashboard, Projects), user menu at bottom (name, logout). On mobile: top bar + slide-over menu.
- `AuthLayout`: centered card on `base`, short product tagline "Test. Defend. Measure."
- Content max width 1200 px, page title row with actions on the right.
- Project pages use tabs: **Overview · Documents · RAG Config · Defenses · Attack Library · Runs · Playground** (URL `/projects/:id/:tab`).

## 4. Routes and pages
| Route | Page | Content |
|---|---|---|
| `/login`, `/register` | Auth | form, inline validation, error banner |
| `/` | Dashboard | project picker (if >1), stat cards (projects, runs, attack runs, latest ASR baseline→protected), outcome distribution chart, per-category ASR chart, recent runs table |
| `/projects` | Projects | grid of project cards, "New project" modal, empty state |
| `/projects/:id/overview` | Overview | setup checklist (documents ready? demo KB loaded? defenses configured? first experiment run?) with action buttons; "Run experiment" primary CTA |
| `…/documents` | Documents | upload dropzone (TXT/PDF/DOCX ≤ 5 MB), "Load demo knowledge base" button, table with status badges, delete |
| `…/rag-config` | RAG Config | form: chunk size, overlap, top-K, system prompt textarea (mono), "Reset to default", save |
| `…/defenses` | Defenses | 4 defense cards with toggle, short description, threshold slider (scanners), save; "No defense is complete" notice |
| `…/attacks` | Attack Library | category filter chips (AT-01..08 + Custom + Benign), search, table (id, name, technique, severity, language); row click → detail drawer; "New custom case" form |
| `…/runs` | Runs | "Run baseline", "Run protected", "Run experiment" buttons (opens options modal: categories, repeats), runs table (mode, status, progress bar, ASR, FPR, started) |
| `…/playground` | Playground | query box, "use project defenses" toggle, result panel: answer, blocked banner, retrieved chunks (with score, injected marker), defenses fired |
| `/runs/:id` | Run Detail | header (mode, status, model, snapshots expander), metric cards, outcome stacked bar, filters (outcome, category), results table (paginated), result drawer, "Download JSON report", "Cancel" while running |
| `/experiments/:id` | Compare | two-column metric table (baseline, protected, delta), grouped bar chart ASR by category, stacked outcome bars, defense overhead card, limitations footnote |
| `*` | NotFound | link home |

## 5. Components (put in `client/src/components/`)
`Button` (primary/secondary/danger/ghost, loading state) · `Input`, `Textarea`, `Select`, `Toggle`, `Slider` · `Card` · `Badge` · `Modal` · `Drawer` · `Tabs` · `Table` (sortable headers, sticky head, empty row) · `StatCard` (label, value, optional delta) · `ProgressBar` · `Spinner` · `Skeleton` · `EmptyState` (icon, title, text, action) · `ErrorBanner` · `Toast` (via context) · `OutcomeBadge` · `RunStatusBadge` · `CodeBlock` (mono, copy button, wrap) · `ChunkCard` (source, score, injected tag) · `MetricGrid` · `Charts/{AsrByCategory, OutcomeStacked}` (Recharts, themed with tokens).

## 6. UX rules
- Every async view has **loading** (skeleton/spinner), **empty** (EmptyState with next action), and **error** (ErrorBanner with retry) states.
- Destructive actions use a confirm modal naming the item.
- Forms: validate on submit, show server `error.message`; disable submit while pending.
- Running runs: poll `GET /api/runs/:id` every 2 s while `queued|running`; stop polling on terminal status or unmount; show `completed/total` and errors.
- Long text (prompts, responses, chunks) in `CodeBlock` with max-height and scroll, never overflow the page. Escape/render as plain text (no `dangerouslySetInnerHTML`) — attack payloads are untrusted.
- Tables with many columns scroll horizontally inside their own container.
- Numbers: percentages 1 decimal in cards, 2 decimals in tables; latency in ms (or s above 1000).
- Accessibility: visible focus rings (`ring-brand`), labels on inputs, `aria-label` on icon buttons, contrast ≥ 4.5:1, modals trap focus and close on Esc.
- Safety: show a dismissible banner on Attack Library and Runs pages: "All secrets and customer data in this tool are synthetic."

## 7. Charts
- ASR by category: grouped bars (baseline = danger-tinted, protected = success-tinted), y-axis 0-100 %, tooltip with counts.
- Outcome distribution: one stacked horizontal bar per mode using outcome colors.
- Use Recharts `ResponsiveContainer`; axes/grid colors from tokens; no animation longer than 300 ms.

## 8. Copy
Product name RAGShield. Keep labels short and literal ("Run experiment", "Load demo knowledge base"). Explain metrics via info tooltips linking to the definitions in `prd.md §8` (short text).
