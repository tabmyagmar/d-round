# Form Template & Approval Workflow — Эцсийн хөгжүүлэлтийн план v2

Зорилго: romuten-v3 дээр эзэмшсэн стекээ (Express, GraphQL, Prisma, Next.js, BullMQ)
суурь болгож, **шинэ үеийн хэрэглүүрүүдийг бодит feature бүхий төслөөр эзэмших**.
Фаз бүрд "юу шинэ вэ" гэдгийг тэмдэглэсэн — мэддэг хэсэг дээрээ хурдалж,
шинэ хэсэгт цаг зарцуулна.

## 1. Эцсийн стек

| Давхарга           | Сонголт                                                                   | Танд шинэ үү                                     |
| ------------------ | ------------------------------------------------------------------------- | ------------------------------------------------ |
| Monorepo           | Turborepo + Yarn workspaces                                               | Хэсэгчлэн (Turbo config гүнзгий)                 |
| Frontend           | Next.js App Router + shadcn/ui (packages/ui)                              | Мэднэ / shadcn monorepo setup шинэ               |
| Гол transport      | **tRPC**                                                                  | ⭐ Шинэ                                          |
| Хоёрдогч transport | **GraphQL Yoga** (харьцуулж сурах) + REST (webhook, file, OpenAPI)        | Yoga шинэ, GraphQL мэднэ                         |
| Framework          | **Hono**                                                                  | ⭐ Шинэ (Web Standards загвар)                   |
| ORM / DB           | Prisma + **PostgreSQL + PostGIS**                                         | Prisma мэднэ / Postgres+PostGIS шинэ (MySQL-ээс) |
| Auth               | **Better Auth** (organization + admin plugin)                             | ⭐ Шинэ                                          |
| Authorization      | **CASL** (@casl/prisma) + service-ийн workflow шалгалт                    | ⭐ Шинэ                                          |
| Queue              | Redis + BullMQ (outbox, sweeper, тусдаа worker app)                       | Мэднэ — энд best practice-ээ гүнзгийрүүлнэ       |
| Real-time          | WS + Redis pub/sub ("дохио + invalidate") + location stream (payload-тай) | Хэсэгчлэн шинэ загвар                            |
| PDF                | **pdfme** (Designer + generator) + pdf-lib (merge)                        | ⭐ Шинэ                                          |
| Газарзүй           | Redis GEO (халуун) + PostGIS (truth) + Mapbox                             | ⭐ Шинэ                                          |
| AI                 | LLM structured output + zod (draft-only зарчим)                           | Мэднэ (daigaku-ai туршлага)                      |
| Чанар              | pino, Sentry, Vitest + testcontainers, CASL matrix тест                   | Хэсэгчлэн шинэ                                   |

Зориуд СОНГООГҮЙ: Drizzle (Prisma туршлага дээр тулж төслөө дуусгана, хожим нэг
domain-оор туршиж болно), Apollo (Yoga нь Hono/Web Standards-тай үрэлтгүй; төгсгөлд
нэг өдрийн "Apollo swap" туршилт хийж ялгааг нүдээр үзнэ), Supabase/Clerk (өгөгдөл
өөрийн DB-д байх ёстой), Cerbos/OpenFGA (нэг app-д илүүдэл).

## 2. Бүтэц (эцсийн)

```
apps/
├── web/          Next.js — builder, form, approval, map
├── api/          Hono: /trpc, /graphql (Yoga), /api/v1 (REST+OpenAPI), /webhooks, WS
│   └── src/
│       ├── core/        context, domain errors, error-mapping (3 transport хуваалцана)
│       ├── modules/     service-үүд (transport мэдэхгүй)
│       ├── trpc/        routers
│       ├── graphql/     schema, resolvers, loaders (DataLoader зөвхөн энд)
│       └── rest/        webhooks, files, v1 + zod-openapi
└── worker/       BullMQ processors (notification, pdf, ai-draft, sweeper, geo-persist)

packages/
├── database/     Prisma schema+migrations, client, repositories (энд!), geo raw SQL
├── validation/   zod (form fields, route config, computed formula)
├── auth/         Better Auth config + client
├── permissions/  CASL ability factory (FE/BE isomorphic)
├── queue/        typed queues, connection, pub/sub helpers
├── ui/           shadcn primitives + composed/
├── logger/
├── eslint-config/  typescript-config/
```

Давхаргын гэрээ: `transport adapter → service → repository → prisma`. Transport
хоорондоо дуудахгүй. Domain error нэг хэлээр, mapping нь core/-д. DataLoader
GraphQL-ээс гадагш гарахгүй. packages/ui руу компонент өргөх = хоёр дахь хэрэглэгч
гарсан үед.

## 3. Фазууд

### Phase 0 — Scaffold (1 д.х)

Turbo, docker compose (postgis/postgis + redis), packages араг яс, CI verify gate

- migrate diff, pino.
  **Сурах:** Turbo pipeline нарийн тохиргоо, shadcn monorepo CLI.

### Phase 1 — Auth + Permissions + core/ (2 д.х)

- Better Auth: schema generate, org/admin plugin, role-ууд; api mount; web login
- `core/`: buildRequestContext (headers → user/ability/logger), domain errors,
  error mapping (эхэндээ tRPC-ийнх л бодитоор, бусад нь interface-ээрээ бэлэн)
- CASL: packages/permissions, ability factory, tRPC middleware, web дээр can() UI
- Rate limit (login), CORS
  **Сурах:** ⭐ Better Auth бүтэн урсгал, CASL + @casl/prisma, tRPC context/middleware.
  **DoD:** нэвтрэлт, role-оор ялгаатай UI, protected procedure, ability matrix unit тест.

### Phase 2 — Template builder + versioning + PDF designer (2-3 д.х)

- FormTemplate / FormTemplateVersion (immutable snapshot: fields + routeConfig + pdfTemplate)
- Field төрлүүд: text/select/date/file/**computed** (formula, expr-eval sandbox)
- Route config: order/mode(ALL|ANY)/approvers(USER|ROLE|MANAGER)/condition — өргөтгөх бэлтгэлтэй
- Builder UI (drag-and-drop чинь байгаа туршлага) + **pdfme Designer** tab
- Publish validate: form field ↔ PDF schema byName mapping, route step ↔ stamp байрлал тоолол
  **Сурах:** ⭐ pdfme template JSON загвар, versioning сахилга.
  **DoD:** publish → шинэ version; хуучин submission эвдрэхгүй; mapping зөрвөл publish алдаа.

### Phase 3 — Submission + Approval engine (2-3 д.х) — цөм

- FormSubmission (idempotencyKey, currentApproverId denormalize), ApprovalStep
  (version — optimistic lock), ApprovalAction (append-only, DB түвшинд UPDATE/DELETE хаах)
- Route resolve (ROLE/MANAGER → бодит user; condition нь **server дээр дахин бодсон**
  computed утга дээр), state machine (transitions хүснэгт нэг газар)
- approvalService: approve/reject/rollback/resubmit — CASL (эрхтэй хүн үү) +
  service (яг одоо болох уу) хоёр давхар
- CASL accessibleBy() — жагсаалт шүүлт ability-гаас
- Тест: state machine бүрэн, sad paths (testcontainers/Postgres), concurrent approve race
  **Сурах:** optimistic locking, CASL-Prisma шүүлт, testcontainers.
  **DoD:** бүтэн урсгал + race тест ногоон + audit бүрэн.

### Phase 4 — Queue + Notification + Real-time (2 д.х)

- packages/queue (typed, ID-only), apps/worker (graceful shutdown)
- Outbox: transaction дотор Notification мөр → дараа нь enqueue (jobId idempotent)
- Sweeper (sentAt IS NULL), reminder (delayed job, approve үед remove)
- WS: upgrade дээр session auth, heartbeat, Redis pub/sub (notify:user:*),
  web useRealtime (reconnect+backoff, onopen catch-up, invalidate-only)
- Bull Board (admin хамгаалалттай)
  **Сурах:** romuten-ий BullMQ мэдлэг дээрээ outbox/sweeper/тусдаа worker app нэмнэ;
  ⭐ pub/sub fan-out, "дохио vs payload" ялгаа.
  **DoD:** worker унтраагаад юу ч алдагдахгүй; Redis flush → sweeper сэргээнэ.

### Phase 5 — PDF pipeline (1 д.х)

- APPROVED болмогц pdfQueue → worker: pdfme generate → stamp SVG (approver+огноо,
  байхгүй бол хэрэглэгчийн stampImage) → хавсралт зураг inline / PDF-ийг pdf-lib merge →
  QR (/verify/{id}) → S3 → submission.pdfKey → notification
  **Сурах:** ⭐ pdfme generator + pdf-lib, худалдааны баримтын хэв (決裁欄).
  **DoD:** тамгатай, QR-тай, хавсралт нийлүүлсэн PDF татагдана; verify хуудас төлөв харуулна.

### Phase 6 — AI features (2 д.х)

- NL → template draft (structured output + zod, **draft-only**, aiDraftQueue-ээр async)
- Approver summary (хоёрдогч)
- Хамгаалалт: prompt урт/quota, зардлын alert, injection бэхлэлт
  **Сурах:** queue-тэй AI урсгал (QUEUED→READY→notification гинж).
  **DoD:** текстээс бөглөгдсөн draft builder-т гарна, хүн зассаны дараа л publish.

### Phase 7 — Geo / Presence / Mapbox (2 д.х, бие даасан)

- PostGIS: Branch.location, User.lastKnownLocation (Unsupported + Gist), geoRepository ($queryRaw)
- Presence: Redis TTL key + heartbeat (self-healing)
- Location stream: **энд "дохио" загварыг зориуд зөрчиж** WS message payload-тай
  (throttle 30с/50м) → Redis GEOADD → publish loc:* → viewer map; worker batch persist (1-5 мин)
- "Branch-д ойрхон": live = Redis GEOSEARCH, тайлан = PostGIS ST_DWithin
- Mapbox (react-map-gl) marker/radius
- ⚠ Байршил хянах нь эмзэг: ажлын цагаар, opt-in, retention бодлого — шаардлагад эхнээс
  **Сурах:** ⭐ PostGIS, Redis GEO, өндөр давтамжийн realtime-ийн тусдаа загвар.
  **DoD:** online badge; map дээр live хөдөлгөөн refetch-гүй; ойрхон user жагсаалт.

### Phase 8 — Multi-transport: Yoga + REST (1-2 д.х, сурах фаз)

- GraphQL Yoga mount: user/submission read model — SDL, resolvers, DataLoader,
  subscription (SSE) — tRPC хувилбартайгаа зэрэгцүүлж харьцуулна
- REST /api/v1: 2-3 endpoint + webhook receiver + @hono/zod-openapi doc
- core/error-mapping-ийн Yoga/HTTP хөрвүүлэгчдийг бодит болгоно
- Туршилт: төгсгөлд Yoga → Apollo нэг өдрийн swap (schema/resolver өөрчлөгдөхгүйг батлах)
  **Сурах:** ⭐ гурван transport нэг service дээр, Yoga vs Apollo, SSE vs graphql-ws.
  **DoD:** гурван transport нэг NOT_FOUND ойлголттой; OpenAPI doc автоматаар.

### Phase 9 — Hardening (тасралтгүй, 4-өөс эхлэн зэрэгцээ)

Request ID → traceId гинж, Sentry (3 app), /health + worker liveness, expand-contract
migration сахилга, graceful shutdown api-д, secret manager, backup + restore сургуулилт,
file upload virus scan, delegation/reassign, seed + demo, load smoke (50 зэрэг approve).

## 4. Хугацаа (ганцаараа, ~30-50%-ийн цаг гэж үзвэл)

```
Фаз:      0   1    2     3     4    5   6    7    8   9(зэрэгцээ)
Д.хоног:  1   2   2.5   2.5    2    1   2    2   1.5  ░░░ тасралтгүй
```

Нийт ~16-17 календарийн долоо хоног. Дараалал нь хатуу биш: 5, 6, 7, 8-ийг
сонирхлоороо сэлгэж болно (бүгд Phase 4-ийн дараа бие даасан).

## 5. Сурах зүйлсийн замын зураг (фазаар)

| Шинэ хэрэглүүр            | Фаз     | Хуучин мэдлэгтэй холбоос                               |
| ------------------------- | ------- | ------------------------------------------------------ |
| tRPC                      | 1, 3    | GraphQL resolver → procedure, codegen → type inference |
| Hono                      | 0, 1, 8 | Express middleware → Web Standards handler             |
| Better Auth               | 1       | өөрийн auth/JWT туршлага → session+plugin загвар       |
| CASL                      | 1, 3    | гараар бичсэн permission → ability + accessibleBy      |
| Outbox/sweeper/worker app | 4       | romuten BullMQ → найдвартай байдлын давхарга           |
| pdfme + pdf-lib           | 2, 5    | — (цоо шинэ)                                           |
| PostGIS + Redis GEO       | 7       | MySQL → Postgres extension ертөнц                      |
| Yoga (vs Apollo)          | 8       | Apollo/graphql туршлага → харьцуулалт                  |
| testcontainers            | 3       | mock → жинхэнэ DB integration                          |

## 6. Эрсдэл

| Эрсдэл                                      | Хамгаалалт                                                |
| ------------------------------------------- | --------------------------------------------------------- |
| Шинэ хэрэглүүр олон → нэг дор сурах ачаалал | Фаз бүрд 1-2 л шинэ зүйл; мэддэг хэсэг нь суурь болж өгнө |
| Better Auth хурдан хувьсдаг                 | version pin + auth E2E                                    |
| Route resolve edge cases                    | submission үүсэхэд validate, fail-fast                    |
| PDF mapping зөрөл                           | publish-ийн validate (Phase 2 DoD)                        |
| Location privacy                            | opt-in + retention — шаардлагын түвшинд                   |
| Scope creep                                 | parallel/conditional route UI, native mobile = v2         |

## 7. Нийтлэг DoD

yarn verify ногоон · service логик тесттэй (state machine/authz заавал) ·
migration expand-contract · эмзэг өгөгдөл log/prompt/Redis payload-д үгүй ·
MR жижиг, фазын хүрээнд · шинэ сурсан зүйлээ README/ADR болгож 5 мөр тэмдэглэх
(хожим өөртөө болон багтаа хэрэгтэй).
