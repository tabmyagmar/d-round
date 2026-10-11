# Plan: File upload — attachments on GCS (プロフィール画像, 履歴書)

Status: **approved** 2026-10-09 ("ok heregjuul", with the recommended answers: `Attachment`, the
admin-side avatar kept, a spinner instead of progress bars). Ticket: D_ROUND-TBD_file-upload
(parent)

- the child tickets in "Backlog tickets". Branch `feature/D_ROUND-TBD_file-upload`, in its own
  worktree (three peer sessions share the checkout).

References read before this plan: legacy `d-round-api/src/database/schema/source/sourceFile.prisma`,
`utils/google-storage/{config,signed-url}.ts`, `graphql/resolvers/source/{mutations,queries}.ts`;
legacy
`d-round-web/src/shared/{hooks/useUpload.ts, lib/upload/index.ts, components/upload/index.tsx, components/form/UploadInput.tsx, components/core/UserAvatar.tsx}`,
`features/profile/components/ ProfileEdit.tsx`, `features/user/components/form/UserFormStep1.tsx`,
`features/staff/components/ {form/StaffFormStep1.tsx, form/StaffFormConfirm.tsx, detail/StaffResume.tsx}`;
romuten-v3 `apps/backend/src/lib/google-storage/v2/signedUrl.ts` and
`apps/web/src/features/file/hooks/ useFileUploader.ts`; this repo's ADR 0004 (outbox),
`.claude/rules/{queue,module-template, repositories,migrations,permissions,testing}.md`,
`packages/ui/src/components/form/file-field.tsx`; GCS docs: XML API request headers
(`x-goog-content-length-range`), Object Lifecycle Management, V4 signed URLs.

## Goal and acceptance criteria

Give the app one way to store files on Google Cloud Storage with V4 signed URLs (the d-round /
romuten-v3 pattern), without orphan objects and with every file tied to the row that owns it, then
port the two legacy uses that the user, staff and client tickets deferred:

- **プロフィール画像** of a 担当者 (legacy `Staff{USER}.image`): the header avatar (`AuthUser`), the
  profile page (`ProfileEdit`), 担当者追加 / 担当者情報編集 (`UserFormStep1`).
- **履歴書** of a スタッフ (legacy `Staff.resume`, up to 3 PDFs): the ファイルをアップロード card of
  the staff form, the confirm step, the 履歴書 card on the staff detail.

Done means:

- A file picked in a form is uploaded straight to the bucket (browser → signed PUT), the form submit
  attaches it to its owner in the same transaction as the owner's write, and a file that is never
  attached disappears from the bucket within ~24 h without anyone noticing.
- Replacing or removing a file deletes the old object from the bucket (job after commit, swept on
  failure). No object outlives its row, no row outlives its object.
- The bucket is private. A file is read only through a short-lived signed URL that the owner's read
  procedure returns, so "who may see the file" is "who may read the owner".
- Size and type are checked three times: the form (instant feedback), the API (the rule table), the
  storage (the signed URL pins `Content-Type` and `x-goog-content-length-range`).
- Every procedure has `requireAbility`; services throw domain errors; the data layer and the worker
  are testcontainers-tested; GCS is behind a provider interface with a memory implementation for
  tests (the only kind of mock `.claude/rules/testing.md` allows: an external provider).
- Every changed screen opened as super_admin, admin, manager and AM next to the legacy screen.

## Decisions (each names its reference; the user may override any of them at approval)

1. **Orphan files: the database row is the truth, not a `tmp/` prefix.** Decision B below.

   | Option                                                                                                                                                                                                | How                                                                                                                                                                                                                                                                                   | Trade-offs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
   | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
   | A. `uploads/tmp/{userId}/{uuid}` → copy + delete into `uploads/{entity}/{id}/` on submit; GCS lifecycle deletes `tmp/` after 1 day (the hypothesis in the ticket)                                     | the bucket cleans itself                                                                                                                                                                                                                                                              | the move is a copy + delete over the network inside the submit request (GCS has no rename on a standard bucket; the SDK's `file.move()` is copy + delete), so a copy that succeeds before a transaction that fails leaves an orphan under the final prefix, and a commit followed by a failed copy leaves a dangling reference — fixing that needs a worker and retries, i.e. everything B needs plus the move; the entity id is unknown on a create form until commit, which is the only reason the move exists; lifecycle `age` is in whole days and runs asynchronously ("your applications shouldn't rely on lifecycle actions occurring within a certain amount of time"), so it gives no precision B lacks; the row for metadata and authorization is still needed |
   | **B. `attachments` row `PENDING` → `ATTACHED` inside the owner's transaction; a repeatable sweeper expires stale `PENDING` rows and deletes their objects; deletes run as ID-only jobs after commit** | the same shape as the email outbox (ADR 0004: row in the transaction, job after commit, idempotent worker, sweeper); attach is atomic with the owner's write; the object never moves (one key for life, no copy latency); the row carries metadata, uploader and owner for the checks | cleanup depends on our worker, not on GCS — acceptable, the worker is already the thing that must run for mail; the bucket is not browsable by entity (the database is the index)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
   | C. B plus a background move into an entity folder                                                                                                                                                     | browsable bucket                                                                                                                                                                                                                                                                      | the move's failure modes for nothing the app needs — rejected (YAGNI)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
   | D. Hold the `File` in the browser and PUT only on submit (what the legacy `ProfileEdit` does for the avatar)                                                                                          | no orphan from a closed tab                                                                                                                                                                                                                                                           | the PUT can succeed and the mutation fail (orphan anyway), multi-file forms wait for every upload at submit, no row to check size/type against — rejected; the legacy `Upload.Root` path (immediate upload) is what we keep                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

   Why the orphan window is closed with B: a row exists before any URL is issued (as in the legacy
   `generateUploadUrls`), the upload URL lives 15 minutes, the sweeper expires `PENDING` rows after
   24 h — so an object can never appear after its row is gone, and a `PENDING` object without a row
   cannot exist. A `DELETED` row whose object delete failed is re-enqueued by the sweeper with the
   same deterministic job id; the processor deletes the object (404 counts as done) and then the
   row. A form kept open longer than 24 h gets
   "ファイルの有効期限が切れました。もう一度選択してください" on submit (ValidationError) — the
   legacy had no limit and kept the orphans instead.

2. **Model: one `attachments` table with a `kind` discriminator and one nullable owner column per
   owner (exclusive arc), not `ownerType`/`ownerId` strings and not a join table per owner.** Prisma
   has no polymorphic relations (prisma/prisma#1644); the three workarounds are exactly the options.
   Strings lose the foreign key and `include`; join tables per owner mean two writes per attach and
   a table per kind. The arc keeps typed relations, foreign keys and `onDelete`, and a new owner is
   one additive migration (expand only). "Exactly one owner column set once `ATTACHED`, and the
   column the kind names" is a service rule covered by a test (a Postgres `CHECK` is a later option,
   not needed now). Reference: the legacy `SourceFile` had no owner at all (owners kept bare keys in
   `Staff.image`, `Staff.resume` as a comma-separated string, `Client.image`, `Stamp.image`), which
   is what made deletion and authorization impossible there.

3. **Name: `Attachment` / `attachments`, module `attachment`.** The legacy `SourceFile` name is
   misleading here: in this repo `source_*` tables and the `source` module are reference data (ADR
   0005), and `File` shadows the Node 24 / DOM global `File`. "Attachment" is Rails ActiveStorage's
   word for the same join. Status `PENDING` is "an attachment not yet attached"; the enum names say
   so.

4. **Bucket layout: one private bucket per environment, key `{folder}/{random uuid}{.ext}`**
   (`avatars/3f2c…7f.webp`, `resumes/9a41…a1.pdf`), stored in `object_key`. A random v4 from
   `crypto.randomUUID()`, not the row id: Prisma generates the UUID v7 id inside the insert, so the
   key would need a second write or a new uuid dependency; the row keeps the key, so nothing is
   lost; no owner id (unknown at upload time — see decision 1), no original name (Japanese names,
   encoding and path traversal stay out of the key; the name lives in the row and is sent as
   `Content-Disposition` on read URLs). `folder` comes from the kind rule table. Legacy
   `dround/{folder}/{userId}/{id}/{name}` is dropped with it; the per-kind folder keeps the console
   browsable and allows per-folder lifecycle or IAM later. Uniform bucket-level access, no public
   access (the legacy served `GCS_BUCKET_URL/{key}` from a public bucket — `UserAvatar.tsx`).

5. **Kinds and limits (the rule table lives in `@repo/validation`, shared by the form and the API;
   the storage enforces the same numbers through the signed URL):**

   | kind                             | owner column | accept                            | max bytes | max per owner | folder    |
   | -------------------------------- | ------------ | --------------------------------- | --------- | ------------- | --------- |
   | `USER_AVATAR` (プロフィール画像) | `user_id`    | image/jpeg, image/png, image/webp | 5 MB      | 1             | `avatars` |
   | `STAFF_RESUME` (履歴書)          | `staff_id`   | application/pdf                   | 5 MB      | 3             | `resumes` |

   Legacy numbers: 5 MB default (`validFileSize`), images jpeg/png/webp,
   `accept="application/pdf" maxFiles={3}` on `StaffFormStep1`. The file name is sanitised
   (basename, control characters removed, 255 max, lower-cased extension as the legacy
   `renameFileExtensionLowercase`) and the extension must match the content type. The legacy
   browser-side magic-byte check (`validateFileContent`) is dropped: the API never sees the bytes;
   the signed URL pins the content type (a different `Content-Type` fails the signature) and
   `x-goog-content-length-range` the size ("Cloud Storage only accepts the request if the size of
   the request's content is within the header's specified range", 400 otherwise). Content scanning
   or image re-encoding would be a worker job later; not now.

6. **Authorization.** Upload: `attachment.createUploadUrl` is
   `protectedProcedure.use(requireAbility("create", "Attachment"))`; `Attachment` joins the
   non-catalog subjects (`CommentTemplate`, `Source`) with the row rule "every signed-in user may
   `create Attachment`" (ADR 0003 line, unit spec cell). The service then applies the kind rule:
   `USER_AVATAR` needs nothing more (the owner mutation decides: own profile, or `update User` /
   `create User` for another's), `STAFF_RESUME` needs `create` or `update Staff`. Attach: only the
   uploader (`uploaded_by_id = ctx.user.id`) may attach a `PENDING` row, and only to an owner the
   owner mutation already authorised. Read: no generic `attachment.readUrl`; the owner's read
   (`user.me`, `user.byId`, `staff.byId`) returns `{ id, fileName, size, url }` with a signed read
   URL — the ability check is the owner's. A pending file in a form is previewed from the local
   `File` (object URL), so it needs no read URL before attach.

7. **Signed URLs: upload 15 min, read 15 min, V4** (legacy 15 / 15; romuten-v3 5 / 15; V4 maximum is
   7 days). The upload response carries `headers` the browser must send verbatim (`Content-Type`,
   `x-goog-content-length-range: <size>,<size>` — the declared size, already checked against the
   kind's maximum, so the stored `size` is the real one), romuten-v3's `requiredHeaders` shape,
   because signed headers are part of the signature. Read URLs: `responseDisposition` `inline` for
   images, `attachment; filename*=UTF-8''…` for PDFs. React Query `staleTime` 10 min on reads that
   carry URLs.

8. **Delete from GCS = outbox pattern.** The owner mutation marks rows `DELETED` in its transaction
   and registers `afterCommit(() => enqueueAttachmentDeleteJob(queue, id))` (ID-only payload,
   deterministic id `attachment-delete:{id}`). The processor re-reads the row, acts only on
   `DELETED`, deletes the object (404 = done), then deletes the row. The sweeper (every 15 min,
   batch 200): `PENDING` older than 24 h → `DELETED`; `DELETED` older than 10 min → enqueue again
   (duplicates collapse on the job id). Reference: `apps/worker/src/schedulers/outbox-sweeper.ts`.

9. **Storage client = new shared package `@repo/storage`** (`packages/storage`), because the API
   service and the worker both need it and `layers.md` lets a service and the worker import shared
   packages only. `StorageProvider` interface (`createUploadUrl`, `createReadUrl`, `head`, `delete`)
   with `createGcsStorage(config)` on `@google-cloud/storage` (8.x; `npm view` on 2026-10-09: 8.4.0,
   pin the current one) and `createMemoryStorage()` for tests — the shape of `MailProvider` +
   `createMemoryMailProvider`. New runtime dependency, stated here as CLAUDE.md asks: it is the
   official client, the only one that signs V4 URLs with `extensionHeaders`, and the legacy and
   romuten-v3 already run it. Configuration is two env variables: `GCS_BUCKET` and `GCS_KEY_FILE`,
   the path of a service-account JSON outside the repository (the SDK's `keyFilename`, as the legacy
   `config.ts`), never a key committed next to the code as the legacy and romuten-v3 do
   (`utils/google-storage/credentials/*.json` is tracked in the legacy git). Decided 2026-10-09:
   bucket `d-round-dev`; the key is the legacy one (project `dround-472307`, service account
   `d-rount-storage@dround-472307.iam.gserviceaccount.com`, `objectAdmin` on the bucket granted by
   the user; the same key serves dev and stg), copied outside every repository to
   `../credentials/google-storage-credential.json` (`TabSolution/d-round/credentials/`, mode 600);
   `.gitignore` gets `**/credentials/` so a copy can never land in this repo. Signing with a private
   key is local, so a detail with three URLs costs three signatures, no IAM calls. Required unless
   `NODE_ENV=test`. The provider joins `RequestContext` as `ctx.storage` (`core/context.ts`, next to
   `db`/`redis`), built once in `apps/api/src/index.ts` and `apps/worker/src/index.ts`. Bucket CORS
   is set once by hand (docs checklist), not on every request as the legacy `configureBucketCors`
   does.

10. **Web pieces.** `FileField` (exists, `packages/ui`, with the `upload` prop designed for this)
    for 履歴書; a new `AvatarField` beside it (round preview, 画像を選択 / 削除, same `upload` prop;
    legacy `uploadTrigger="avatar"`); one hook `useAttachmentUpload(kind)` in
    `apps/web/features/attachments/hooks/` (consumers: profile form, user form, staff form — three)
    that calls the procedure and PUTs with `fetch` (romuten-v3 `useFileUploader`); the legacy's
    680-line `Upload.*` compound and axios progress bars are not ported — `FileField` shows a
    spinner per file (5 MB files; the user may ask for progress at review). Form values stay
    `FileFieldValue[]`; the `*-form-input.ts` utils map them to ids for the API.

11. **Dropped legacy fields and uses (YAGNI, each named):** `SourceFile.dimension` / `resized` and
    `imagesSizes` (never read by any screen), `generateReadUrl` (no caller in the web),
    `Client.image` (column exists, no legacy screen writes or shows it), `Staff.image` for a
    non-user staff (only `Staff{USER}` rows carried one — that is the user avatar), batch
    `generateUploadUrls(input[])` (one URL per call; the field uploads files in parallel anyway).

12. **Later owners, same table:** workflow `FILE` / `IMAGE` fields (`RenderField.tsx`,
    `folder="USER"`, per-field `maxFiles` / `maxFileSize`) and the 印鑑 (`Stamp.image`,
    `workflowRoute.stampImage`) each add one kind and one nullable owner column when their tickets
    come; nothing in this ticket anticipates them beyond the arc shape.

## Legacy → new

| Legacy piece (file)                                                                                                                  | New                                                                                                                                                   | Kept / changed / dropped — why                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `SourceFile { folder, name, size, type, extension, resized, status, dimension, createdBy }` (`source/sourceFile.prisma`)             | `Attachment { kind, fileName, size, contentType, status, uploadedById, userId?, staffId?, objectKey, attachedAt, deletedAt }`                         | changed — owner columns added (decision 2), `resized` / `dimension` dropped (11), `folder` → `kind` + folder in the rule table |
| `generateUploadUrls(input[])` creates rows `ACTIVE` and signs `write` URLs, no size/type rule (`resolvers/source/mutations.ts`)      | `attachment.createUploadUrl({ kind, fileName, contentType, size })` → `{ id, url, headers, expiresAt }`, row `PENDING`, rule table, size-bound header | changed — decisions 1, 5, 7                                                                                                    |
| Key `dround/{folder}/{createdBy}/{id}/{name}` (`signed-url.ts`)                                                                      | `{folder}/{random uuid}{.ext}`                                                                                                                        | changed — decision 4                                                                                                           |
| `generateReadUrl(fileKey)` + public `GCS_BUCKET_URL/{key}` (`lib/upload/index.ts` `sourceFile()`)                                    | private bucket; `url` embedded in `user.me` / `user.byId` / `staff.byId`                                                                              | changed — decision 6                                                                                                           |
| `deleteSignedUrl(fileKey)` (no resolver calls it)                                                                                    | delete job + sweeper                                                                                                                                  | changed — decision 8                                                                                                           |
| `configureBucketCors()` on every signed URL (`config.ts`)                                                                            | one-time bucket setup (docs checklist)                                                                                                                | changed — decision 9                                                                                                           |
| `useUpload` (Apollo mutation + axios PUT with progress) (`shared/hooks/useUpload.ts`)                                                | `useAttachmentUpload(kind)` (tRPC mutation + `fetch` PUT)                                                                                             | changed — romuten-v3 `useFileUploader`; progress dropped (10)                                                                  |
| `lib/upload` validators (`imageTypes`, `fileTypes`, 5 MB, magic bytes)                                                               | `ATTACHMENT_RULES` in `@repo/validation`, used by the form and the API                                                                                | changed — one table (5)                                                                                                        |
| `Upload.Root / Dropzone / FileList / Trigger / AvatarDropzone` + `FormUploadInputField` (`uploadTrigger` dropzone / button / avatar) | `FileField` (exists) + `AvatarField` (new)                                                                                                            | changed — the field set in `packages/ui` is the reference (`.claude/skills/feature-screen`)                                    |
| `UserAvatar` (`imageKey` → public URL, `UserFilledIcon` fallback)                                                                    | `Avatar` + `AvatarImage` with the signed `url`, initials fallback as today                                                                            | changed — fallback stays the current `initialsOf`                                                                              |
| `AuthUser.tsx` header avatar `session.user.staff.image`                                                                              | `user-menu.tsx` reads `user.me` → `image.url`                                                                                                         | kept                                                                                                                           |
| `ProfileEdit` avatar (URL at pick, PUT at save, `imageTypes`, 5 MB)                                                                  | `profile-form.tsx` `AvatarField` (upload at pick, attach at save via `updateProfile.imageId`)                                                         | changed — decision 1 D                                                                                                         |
| `UserFormStep1` プロフィール画像 (`name="staff.image"`, `folder="STAFF"`, `uploadTrigger="avatar"`)                                  | `user-form-fields.tsx` `AvatarField` → `invite` / `update` `imageId`                                                                                  | kept (parity; the user-feature plan left it for this ticket)                                                                   |
| `StaffFormStep1` card ファイルをアップロード (`resume`, pdf, `maxFiles={3}`)                                                         | `staff-basic-step.tsx` card ファイルをアップロード with `FileField` (accept pdf, 3, 5 MB) → `resumeIds`                                               | kept                                                                                                                           |
| `StaffFormConfirm` resume list (`getSourceFiles(getValues('resume'))`)                                                               | `staff-form-confirm.tsx` list of file names                                                                                                           | kept                                                                                                                           |
| `StaffResume.tsx` card 履歴書をアップロード, 未アップロード, `PdfIcon` links                                                         | `components/detail/staff-resume-card.tsx` (`ContentCard`)                                                                                             | kept                                                                                                                           |
| `Client.image`, non-user `Staff.image`, `Stamp.image`, workflow `FILE` / `IMAGE` fields                                              | —                                                                                                                                                     | dropped / later (11, 12)                                                                                                       |

## Schema changes

New folder `packages/database/prisma/schema/attachment/`, one migration `add_attachments` (expand
only: new enums, new table, two nullable foreign keys), ADR `docs/adr/0012-attachments.md` (number
to confirm against `ls docs/adr` at branch time — peers took 0010 and 0011).

```prisma
// attachment/attachment.prisma
/// What the file is for. Fixes the owner column, the accepted types, the size limit and the bucket
/// folder (rule table in @repo/validation).
enum AttachmentKind {
  /// プロフィール画像 of a 担当者 — owner users.id
  USER_AVATAR
  /// 履歴書 of a スタッフ — owner staffs.id, up to 3
  STAFF_RESUME

  @@map("attachment_kind")
}

/// PENDING: URL issued, not yet attached (swept after 24 h). ATTACHED: owned. DELETED: object
/// delete pending (job + sweeper); the row goes once the object is gone.
enum AttachmentStatus {
  PENDING
  ATTACHED
  DELETED

  @@map("attachment_status")
}

model Attachment {
  id           String           @id @default(uuid(7)) @db.Uuid
  kind         AttachmentKind
  status       AttachmentStatus @default(PENDING)
  /// Object name in the bucket: `<folder>/<random uuid><.ext>`; never changes.
  objectKey    String           @unique @map("object_key") @db.VarChar(255)
  /// Original name as picked (sanitised); shown in the UI and sent as Content-Disposition.
  fileName     String           @map("file_name") @db.VarChar(255)
  contentType  String           @map("content_type") @db.VarChar(100)
  /// Declared at URL time; the signed PUT accepts exactly this many bytes.
  size         Int
  /// Who asked for the URL; only they may attach the pending row.
  uploadedById String           @map("uploaded_by_id") @db.Uuid
  /// Owner columns — exactly one is set once ATTACHED, the one the kind names (service rule).
  userId       String?          @map("user_id") @db.Uuid
  staffId      String?          @map("staff_id") @db.Uuid
  attachedAt   DateTime?        @map("attached_at")
  deletedAt    DateTime?        @map("deleted_at")
  createdAt    DateTime         @default(now()) @map("created_at")
  updatedAt    DateTime         @updatedAt @map("updated_at")

  uploadedBy User   @relation("UploadedAttachments", fields: [uploadedById], references: [id], onDelete: Restrict)
  user       User?  @relation("UserAttachments", fields: [userId], references: [id], onDelete: Restrict)
  staff      Staff? @relation(fields: [staffId], references: [id], onDelete: Restrict)

  @@index([status, createdAt])
  @@index([userId, kind])
  @@index([staffId, kind])
  @@map("attachments")
}
```

`User` gains `attachments Attachment[] @relation("UserAttachments")` and
`uploadedAttachments Attachment[] @relation("UploadedAttachments")` (relation fields only, Better
Auth untouched); `Staff` gains `attachments Attachment[]`. `Restrict` is safe: users and staff are
soft-deleted (`deleted_at`), never removed.

## Validation (`@repo/validation`)

`packages/validation/src/attachment.schema.ts`:

- `attachmentKindSchema = z.enum(["USER_AVATAR", "STAFF_RESUME"])`.
- `ATTACHMENT_RULES: Record<AttachmentKind, { accept: readonly string[]; maxBytes: number; maxFiles: number; folder: string }>`
  (the table in decision 5) + `ATTACHMENT_URL_TTL_SECONDS = 900`.
- `createUploadUrlSchema = z.object({ kind, fileName: z.string().trim().min(1).max(255), contentType: z.string().max(100), size: z.int().positive() })`
  with a `superRefine` against the rule (type in `accept`, size ≤ `maxBytes`, extension ↔ type) —
  messages in Japanese (`この形式は選択できません`, `5 MB を超えています`, as `FileField` already
  words them).
- `attachmentIdSchema = z.uuid()`; `updateProfileSchema`, `inviteUserSchema`, `updateUserSchema`
  gain `imageId: attachmentIdSchema.nullable().optional()`; `createStaffSchema` /
  `updateStaffSchema` gain `resumeIds: z.array(attachmentIdSchema).max(3)` (distinct).
- `attachmentViewSchema` is not needed (output types come from the API router types).

## API

- `apps/api/src/trpc/routers/attachment.router.ts`: `createUploadUrl` =
  `protectedProcedure.use(requireAbility("create", "Attachment")).input(createUploadUrlSchema) .mutation(({ ctx, input }) => attachmentService.createUploadUrl(ctx, input))`.
  Registered in the app router.
- `apps/api/src/modules/attachment/attachment.service.ts`:
  - `createUploadUrl(ctx, input)`: kind rule (`assertMayUpload`: `STAFF_RESUME` →
    `can("create", "Staff") || can("update", "Staff")`, else `ForbiddenError`), sanitise the name,
    create the row `PENDING` with `objectKey = ${rule.folder}/${randomUUID()}${ext}`,
    `ctx.storage.createUploadUrl({ key, contentType, size, expiresInSeconds })` →
    `{ id, url, headers, expiresAt }`.
  - Guards other services call (first argument the transaction client, as `assertChargersActive`):
    `assertUploaded(ctx, ids, kind)` **before** the transaction — rows exist, `PENDING`, this
    uploader, this kind, `storage.head(key)` returns metadata (missing → `ValidationError`
    "アップロードが完了していません"); then inside the transaction
    `attachToUser(tx, { id, userId })` / `syncStaffResumes(tx, { staffId, ids })`: `updateMany`
    `where { id in ids, status: PENDING, uploadedById }` → `ATTACHED` + owner + `attachedAt` (count
    ≠ ids.length → `ConflictError`), previous `ATTACHED` rows of that owner + kind not in the set →
    `DELETED`; both return the ids to enqueue, which the caller registers with `afterCommit`.
    Replacing an avatar = attach new + delete old in one transaction.
  - `viewsFor(ctx, rows)` → `AttachmentView { id, fileName, size, url }` with
    `storage.createReadUrl` per row (`responseDisposition` by kind).
- `apps/api/src/modules/user/user.service.ts`: `updateProfile`, `update`, `invite` take `imageId`
  (`null` = remove); `UserDetail.image: AttachmentView | null`; `me` and `byId` include it.
- `apps/api/src/modules/staff/staff.service.ts`: `create` / `update` take `resumeIds`;
  `StaffDetail.resumes: AttachmentView[]`.
- `apps/api/src/core/context.ts`: `storage: StorageProvider` on `RequestContext` and `ContextDeps`;
  `apps/api/src/index.ts` builds `createGcsStorage(env)`; `apps/api/src/env.ts` validates
  `GCS_BUCKET` and `GCS_KEY_FILE` (required unless `NODE_ENV=test`; the file must exist and be
  readable at start-up — a readable error, not a signing failure on the first upload).
- `packages/database/src/repositories/attachment.repository.ts`: `create`, `findById`,
  `findManyByIds`, `findAttachedByOwner({ userId | staffId, kind })`,
  `attach(ids, uploaderId, data)` (`updateMany` on `PENDING`), `markDeleted(ids)`,
  `findPendingBefore(date, take)`, `findDeletedBefore(date, take)`, `deleteById`. Barrel export;
  `Attachment` type exported from `@repo/database`.
- `packages/permissions`: `Attachment` in `SUBJECT_NAMES` (non-catalog), rule
  `can("create", "Attachment")` for every signed-in user; unit spec cell; ADR 0003 line.

## Queue and worker

- `packages/queue/src/names.ts`: `attachmentDelete: "attachment-delete"`,
  `attachmentSweeper: "attachment-sweeper"`.
- `packages/queue/src/jobs/attachment.job.ts`: `AttachmentDeleteJob = { attachmentId: string }`,
  `ATTACHMENT_DELETE_JOB_NAME = "delete"`,
  `attachmentDeleteJobId = (id) => \`attachment-delete:${id}\``, `createAttachmentDeleteQueue(connection)`, `enqueueAttachmentDeleteJob(queue,
  id)`— the`email.job.ts` shape.
- `apps/worker/src/processors/attachment-delete.processor.ts`:
  `processAttachmentDeleteJob(deps, job)` (row missing or not `DELETED` → done;
  `storage.delete(key)` (404 ok); `deleteById`), `createAttachmentDeleteWorker(deps)` (concurrency
  2, retries with backoff as the email worker).
- `apps/worker/src/schedulers/attachment-sweeper.ts`: `sweepAttachments(deps)` =
  `findPendingBefore(now - ATTACHMENT_PENDING_TTL_MS /* 24 h */, 200)` → `markDeleted`, then
  `findDeletedBefore(now - ATTACHMENT_DELETE_GRACE_MS /* 10 min */, 200)` → enqueue; returns the
  counts. `registerAttachmentSweeper(queue)` =
  `upsertJobScheduler("attachment-sweeper", { every: 900_000 })`;
  `createAttachmentSweeperWorker(deps)` concurrency 1.
- `apps/worker/src/index.ts` registers both next to the email worker; `apps/worker/src/env.ts` takes
  the three `GCS_*` variables; `apps/worker/package.json` adds `@repo/storage`.

## Storage package

`packages/storage` (`@repo/storage`, shared element in `boundaries.js` automatically — it is
`packages/*`):

- `src/provider.ts`: `StorageProvider` interface —
  `createUploadUrl({ key, contentType, size, expiresInSeconds }) → { url, headers: Record<string, string>, expiresAt }`,
  `createReadUrl({ key, fileName, contentType, expiresInSeconds, disposition: "inline" | "attachment" }) → { url, expiresAt }`,
  `head(key) → { size, contentType } | null`, `delete(key) → void` (404 resolves).
- `src/gcs-storage.ts`: `createGcsStorage({ bucket, keyFile })` on `@google-cloud/storage`
  (`new Storage({ keyFilename })`; `getSignedUrl` v4 `write` with `contentType` and
  `extensionHeaders: { "x-goog-content-length-range": "<size>,<size>" }`; `read` with
  `responseDisposition`; `getMetadata`; `delete({ ignoreNotFound: true })`).
- `src/memory-storage.ts`: `createMemoryStorage()` — objects in a `Map`,
  `put(key, { size, contentType })` for tests, `failDelete` knob; URLs are `memory://<key>?…`
  strings.
- `src/object-key.ts`: `sanitizeFileName`, `extensionFor(contentType)`,
  `objectKeyFor(folder, contentType)` (pure, unit-tested; romuten-v3 `sanitizeFileName` is the
  reference).
- `test/`: object-key unit tests, memory provider tests.

## Web

- `packages/ui/src/components/form/avatar-field.tsx` (+ `index.ts` export, `test/`): value
  `FileFieldValue | null`; round `Avatar` preview (`url` ?? object URL of `file`, revoked on
  change); buttons 画像を選択 / 削除; `accept` images; same `upload` prop and local error lines as
  `FileField`; label プロフィール画像 by the consumer.
- `apps/web/features/attachments/hooks/use-attachment-upload.ts`: `useAttachmentUpload(kind)` →
  `{ upload }`, `upload(file)` =
  `trpc.attachment.createUploadUrl.mutate({ kind, fileName: file.name, contentType: file.type, size: file.size })`
  → `fetch(url, { method: "PUT", headers, body: file })` (non-2xx →
  `Error("ファイルのアップロードに失敗しました")`) → `{ id }`.
- `apps/web/features/attachments/utils/attachment-values.ts`: `toFileFieldValue(view)` /
  `toFileFieldValues(views)` and `attachmentIdOf(value)` / `attachmentIdsOf(values)` — used by the
  users and staff form-input utils.
- users: `components/profile/profile-form.tsx` (`AvatarField`),
  `components/form/user-form-fields.tsx` (`AvatarField`, create + update),
  `utils/user-form-input.ts` (`imageId`), `types.ts`; `apps/web/components/layout/user-menu.tsx`
  shows `AvatarImage` from `trpc.user.me` (`staleTime` 10 min) over the initials fallback.
- staff: `components/form/staff-basic-step.tsx` (card ファイルをアップロード with `FileField` accept
  `application/pdf`, `maxFiles 3`, `maxSize 5 MB`, `upload` from the hook),
  `components/form/staff-form-confirm.tsx` (file names), `utils/staff-form-input.ts` (`resumeIds`),
  new `components/detail/staff-resume-card.tsx` (`ContentCard` 履歴書をアップロード, 未アップロード,
  PDF icon links opening the signed URL in a new tab), `containers/staff-detail-container.tsx`,
  `types.ts`.
- Lazy loading as the rules: `AvatarField` / `FileField` are form-page code, loaded with the form.

## Environment and bucket setup (ops, documented in `docs/attachments.md`)

- `.env.example`, `turbo.json` (api + worker `dev` / `start` tasks), `docs/conventions.md` env list:
  `GCS_BUCKET`, `GCS_KEY_FILE`. Local values (the user writes `.env`): `GCS_BUCKET=d-round-dev`,
  `GCS_KEY_FILE=/Users/tabmyagmar/TabSolution/d-round/credentials/google-storage-credential.json` (a
  copy of the legacy `google-storage-stg.json`; GCP project `dround-472307`, service account
  `d-rount-storage@dround-472307.iam.gserviceaccount.com`, `objectAdmin` granted; the same key
  serves dev and stg). `.gitignore`: `**/credentials/`.
- Bucket `d-round-dev` is the development bucket (decided 2026-10-09); staging and production
  buckets follow the same name pattern when their environments exist. Expected settings, checked in
  T11: uniform bucket-level access, public access prevention on, no lifecycle rule (decision 1 — a
  `Delete` rule on `avatars/` or `resumes/` would delete live files).
- The service account needs `roles/storage.objectAdmin` on the bucket (signed URLs act as the
  account); the key file stays outside this repository and never enters git here (the legacy
  committed it).
- CORS once per bucket (`gcloud storage buckets update gs://d-round-dev --cors-file=cors.json`):
  `origin: [WEB_ORIGIN]` (`http://localhost:3000` for dev), `method: ["PUT"]`,
  `responseHeader: ["Content-Type", "x-goog-content-length-range"]`, `maxAgeSeconds: 3600`. The
  legacy set CORS from code on every request with `origin: "*"` in `local`; the bucket may still
  carry that — T11 replaces it.
- Local development uses `d-round-dev` with the key above; `fake-gcs-server` is out of scope.

## Backlog tickets

Parent: **File upload — attachments on GCS (avatar, 履歴書)**, estimate 26 → split below and closed.
One developer, Claude-assisted; 2 points ≈ one working day; dates start Monday 2026-10-12. Order =
dependency order; T1 ∥ T2, T5 ∥ T6, T7 ∥ T4 may run together. Status for all: `open`.

| #   | Title (EN)                                               | SP  | Start → End   | Depends on |
| --- | -------------------------------------------------------- | --- | ------------- | ---------- |
| T1  | Add attachments table and ADR 0012                       | 2   | 10-12 → 10-12 | —          |
| T2  | Add @repo/storage package with GCS and memory providers  | 3   | 10-13 → 10-14 | —          |
| T3  | Add attachment module: createUploadUrl and attach guards | 3   | 10-14 → 10-15 | T1, T2     |
| T4  | Add attachment delete job and sweeper to the worker      | 3   | 10-16 → 10-19 | T1, T2     |
| T5  | Attach profile image to users (API)                      | 2   | 10-19 → 10-20 | T3         |
| T6  | Attach 履歴書 files to staff (API)                       | 2   | 10-20 → 10-21 | T3         |
| T7  | Add upload hook and AvatarField (web)                    | 3   | 10-21 → 10-22 | T3         |
| T8  | Profile image on the profile page and header             | 2   | 10-23 → 10-23 | T5, T7     |
| T9  | Profile image on 担当者追加 / 担当者情報編集             | 2   | 10-26 → 10-26 | T5, T7     |
| T10 | 履歴書 upload on the staff form and detail               | 3   | 10-27 → 10-28 | T6, T7     |
| T11 | Bucket setup, env and attachments docs                   | 1   | 10-29 → 10-29 | T1–T10     |

### T1 — Add attachments table and ADR 0012 (2)

- Requirement — functional: `attachments` table, enums `attachment_kind` / `attachment_status`,
  foreign keys to `users` (uploader, owner) and `staffs`; repository with the methods in "API".
  Non-functional: expand-only migration, generated SQL read before commit, ADR before migration.
- Plan — affected: `prisma/schema/attachment/attachment.prisma`, `auth/user.prisma`,
  `staff/staff.prisma` (relation fields), migration `add_attachments`,
  `repositories/attachment. repository.ts` + barrel, `docs/adr/0012-attachments.md`,
  `.claude/rules/migrations.md` rows (schema folder list + migrations table — the rules edit needs
  the approved plan). Test target:
  `packages/database/test/repositories/attachment.repository.test.ts` (create / attach `updateMany`
  count / mark deleted / pending-before / deleted-before / delete).
- 説明 (JP): ファイル添付用の `attachments` テーブルと ADR を追加する（所有者列: users / staffs）。
- Тайлбар (MN): Файл хавсаргах `attachments` хүснэгт, enum, repository болон ADR-ийг нэмнэ
  (эзэмшигчийн багана: users / staffs).

### T2 — Add @repo/storage package with GCS and memory providers (3)

- Requirement — functional: `StorageProvider` interface, `createGcsStorage` (V4 signed PUT with
  `Content-Type` + `x-goog-content-length-range`, signed GET with `responseDisposition`, head,
  delete ignoring 404), `createMemoryStorage` for tests, object-key helpers. Non-functional: no key
  file in the repo (`.gitignore` `**/credentials/`); `GCS_BUCKET` + `GCS_KEY_FILE` from env;
  `@google-cloud/storage` pinned (`npm view` first).
- Plan — affected: `packages/storage/*`, root workspace list, `apps/api/src/env.ts`,
  `apps/worker/src/env.ts`, `.env.example`, `.gitignore`, `turbo.json`, `docs/conventions.md` (env
  list). Test target: `packages/storage/test/{object-key,memory-storage}.test.ts`;
  `apps/api/test/env.test.ts` and the worker env test for the new variables (required unless
  `NODE_ENV=test`; a missing key file fails at start-up).
- 説明 (JP):
  GCS 署名付き URL（アップロード / 閲覧 / 削除）を扱う共通パッケージとテスト用メモリ実装を追加する。
- Тайлбар (MN): GCS signed URL (upload / read / delete) болон тестэд зориулсан memory provider-тэй
  `@repo/storage` package нэмнэ; credentials нь env-ээс.

### T3 — Add attachment module: createUploadUrl and attach guards (3)

- Requirement — functional: `attachment.createUploadUrl` with the kind rule table; guards
  `assertUploaded`, `attachToUser`, `syncStaffResumes`, `viewsFor`; `Attachment` CASL subject;
  `ctx.storage`. Non-functional: domain errors only; the head check runs before the transaction;
  every rule has a test.
- Plan — affected: `packages/validation/src/attachment.schema.ts` (+ index), `packages/permissions`
  (`SUBJECT_NAMES`, `rules.ts`, unit spec, ADR 0003 line),
  `apps/api/src/modules/attachment/ attachment.service.ts`, `trpc/routers/attachment.router.ts` +
  app router, `core/context.ts`, `src/index.ts`, `apps/api/test/support.ts` (memory storage in the
  harness). Test target: `apps/api/test/modules/attachment.service.test.ts` — URL per kind (headers,
  expiry, row `PENDING`), rule violations (type, size, extension), `STAFF_RESUME` without
  `update Staff` → FORBIDDEN, attach only `PENDING` + own + right kind, missing object →
  ValidationError, replace avatar marks the old row `DELETED`, resumes set semantics and the 3
  limit; `permission-catalog` / ability spec cells.
- 説明 (JP): 署名付きアップロード URL を発行する `attachment`
  モジュールと、送信時にファイルを所有者へ紐付けるガードを実装する。
- Тайлбар (MN): Signed upload URL олгодог `attachment` модуль, submit үед файлыг эзэмшигчид нь
  холбох guard-ууд, `Attachment` CASL subject-ийг нэмнэ.

### T4 — Add attachment delete job and sweeper to the worker (3)

- Requirement — functional: `attachment-delete` queue + job (ID-only, deterministic id), processor
  (delete object then row, only on `DELETED`), sweeper every 15 min (`PENDING` > 24 h → `DELETED`;
  `DELETED` > 10 min → re-enqueue). Non-functional: idempotent, duplicates collapse, failures retry
  with backoff, counts logged.
- Plan — affected: `packages/queue/src/names.ts`, `jobs/attachment.job.ts` (+ index),
  `apps/worker/src/processors/attachment-delete.processor.ts`, `schedulers/attachment-sweeper.ts`,
  `src/index.ts`, `apps/worker/package.json`, `.claude/rules/queue.md` table rows (approved plan).
  Test target: `apps/worker/test/processors/attachment-delete.processor.test.ts` (object + row gone;
  `ATTACHED` untouched; 404 ok; `failDelete` → retried),
  `test/schedulers/attachment-sweeper. test.ts` (expiry, re-enqueue with the same job id, batch
  size).
- 説明 (JP): 未紐付けファイルの期限切れ処理と GCS オブジェクト削除をワーカーのジョブ・スイーパーとして実装する。
- Тайлбар (MN): Хавсаргагдаагүй файлыг 24 цагийн дараа устгах sweeper, GCS объект устгах idempotent
  job-ийг worker-т нэмнэ.

### T5 — Attach profile image to users (API) (2)

- Requirement — functional: `updateProfile` / `update` / `invite` take `imageId` (null removes);
  `me` / `byId` return `image { id, fileName, size, url }`. Non-functional: attach + old delete in
  one transaction, job after commit; a user may change only their own avatar unless `update User`.
- Plan — affected: `packages/validation/src/user.schema.ts`,
  `apps/api/src/modules/user/ user.service.ts`, user tests. Test target:
  `apps/api/test/modules/user.service.test.ts` — set, replace (old `DELETED`, job enqueued after
  commit), remove, foreign pending id → CONFLICT, URL in `me` / `byId`.
- 説明 (JP): 担当者のプロフィール画像を `users`
  に紐付ける API（プロフィール更新 / 担当者追加 / 編集）。
- Тайлбар (MN): Хэрэглэгчийн профайл зургийг `imageId`-аар холбох, солих, устгах API; `me` / `byId`
  signed URL буцаана.

### T6 — Attach 履歴書 files to staff (API) (2)

- Requirement — functional: `create` / `update` take `resumeIds` (≤ 3, set semantics); `byId`
  returns `resumes[]` with URLs. Non-functional: same transaction as the staff write; removed files
  deleted after commit.
- Plan — affected: `packages/validation/src/staff.schema.ts`,
  `apps/api/src/modules/staff/ staff.service.ts`, staff tests. Test target:
  `apps/api/test/modules/staff.service.test.ts` — create with 2, update to a different set (one
  kept, one removed → `DELETED`, one added), 4 → BAD_REQUEST, URLs in `byId`.
- 説明 (JP): スタッフの履歴書（PDF 最大 3 件）を登録・更新時に紐付ける API。
- Тайлбар (MN): Ажилтны 履歴書 (PDF, дээд тал нь 3) файлыг create / update дээр холбох API.

### T7 — Add upload hook and AvatarField (web) (3)

- Requirement — functional: `useAttachmentUpload(kind)` (mutation + signed PUT with the returned
  headers), `AvatarField` in `packages/ui`, value helpers. Non-functional: errors shown in the field
  (Japanese), no new dependency, `FileField` unchanged unless a gap appears.
- Plan — affected: `packages/ui/src/components/form/avatar-field.tsx` + `index.ts`,
  `apps/web/features/attachments/{hooks/use-attachment-upload.ts, utils/attachment-values.ts}`. Test
  target: `packages/ui/test/avatar-field.test.tsx` (pick → preview → upload called → value has id;
  remove; reject type), `apps/web/test/features/attachments/use-attachment-upload.test.ts` (mutation
  input, PUT headers, non-2xx → error).
- 説明 (JP): 署名付き URL へアップロードする共通フックと、プロフィール画像用 `AvatarField`
  を追加する。
- Тайлбар (MN): Signed URL руу PUT хийдэг нийтлэг hook, профайл зургийн `AvatarField` компонент,
  value хөрвүүлэх helper нэмнэ.

### T8 — Profile image on the profile page and header (2)

- Requirement — functional: `profile-form.tsx` shows `AvatarField` (legacy `ProfileEdit`), the
  header `user-menu.tsx` shows the image from `user.me` with the initials fallback. Non-functional:
  URL refresh on stale (10 min), no layout shift in the header.
- Plan — affected: `apps/web/features/users/components/profile/profile-form.tsx`,
  `containers/profile-container.tsx`, `apps/web/components/layout/user-menu.tsx`. Test target:
  profile form test (image id in the mutation input); browser check as the four roles next to the
  legacy header and profile page.
- 説明 (JP): プロフィール画面と画面右上のアバターにプロフィール画像を表示・変更できるようにする。
- Тайлбар (MN): Профайл хуудас болон header-ийн avatar дээр зургийг харуулах, солих.

### T9 — Profile image on 担当者追加 / 担当者情報編集 (2)

- Requirement — functional: `AvatarField` プロフィール画像 on the user create and update forms
  (legacy `UserFormStep1`), `imageId` in `invite` / `update`. Non-functional: the field is disabled
  when the form is (as the legacy `disabled` prop).
- Plan — affected: `apps/web/features/users/components/form/user-form-fields.tsx`,
  `user-create-form.tsx`, `user-update-form.tsx`, `utils/user-form-input.ts`, `types.ts`. Test
  target: form-input mapping test; browser check as super_admin / admin (manager and AM see the
  disabled state or no form, as today).
- 説明 (JP): 担当者追加・担当者情報編集フォームにプロフィール画像項目を追加する。
- Тайлбар (MN): 担当者 нэмэх / засах форм дээр профайл зургийн талбарыг нэмнэ.

### T10 — 履歴書 upload on the staff form and detail (3)

- Requirement — functional: the ファイルをアップロード card with `FileField` (PDF, 3, 5 MB) on the
  basic step, file names on the confirm step, `resumeIds` in create / update, the 履歴書 card on the
  detail (`未アップロード` when empty, PDF links). Non-functional: existing files load with their
  URLs on the update form; removal is confirmed only by submit (as the legacy).
- Plan — affected: `apps/web/features/staff/components/form/staff-basic-step.tsx`,
  `staff-form-confirm.tsx`, `utils/staff-form-input.ts`, new
  `components/detail/staff-resume-card. tsx`, `containers/staff-detail-container.tsx`, `types.ts`.
  Test target: form-input mapping test, resume card test (empty / three links); browser check as the
  four roles on create, update and detail next to the legacy `StaffFormStep1` / `StaffResume`.
- 説明 (JP): スタッフ登録・編集フォームに履歴書アップロード、詳細画面に履歴書カードを追加する。
- Тайлбар (MN): Ажилтны форм дээр 履歴書 upload карт, дэлгэрэнгүй дээр 履歴書 карт нэмнэ.

### T11 — Bucket setup, env and attachments docs (1)

- Requirement — functional: `docs/attachments.md` (flow, kinds table, env, bucket checklist with the
  CORS JSON, sweeper timings, failure modes); `d-round-dev` checked (uniform access, public access
  prevention, no lifecycle rule, CORS for `http://localhost:3000` replacing the legacy `*`); smoke
  upload against `d-round-dev` from the running app. Non-functional: no public access, no key file
  in git, `.claude/rules/permissions.md` Attachment subject line (approved plan).
- Plan — affected: `docs/attachments.md`, `README` pointer, GCP console / `gcloud` (the user's
  account). Test target: smoke — pick an avatar on `/admin/profile`, see it in the header; upload
  two PDFs on a staff, see them on the detail; remove one, confirm the object is gone within the
  sweeper interval.
- 説明 (JP): `d-round-dev`
  バケットの設定確認（CORS・公開禁止）、環境変数、運用ドキュメントを整備する。
- Тайлбар (MN): `d-round-dev` bucket-ийн тохиргоо (CORS, public хориг, lifecycle байхгүй), env болон
  `docs/attachments.md` баримтжуулалт; dev bucket дээр smoke test.

## Tests to add or update

- `packages/database/test/repositories/attachment.repository.test.ts` (testcontainers).
- `packages/storage/test/object-key.test.ts`, `memory-storage.test.ts` (unit).
- `packages/validation/test/attachment.schema.test.ts` (rule table, names, extension ↔ type).
- `packages/permissions/test/ability.test.ts` (`create Attachment` for any signed-in user, nothing
  else on the subject).
- `apps/api/test/modules/attachment.service.test.ts`, `user.service.test.ts`,
  `staff.service.test.ts` (testcontainers, memory storage), `env.test.ts`.
- `apps/worker/test/processors/attachment-delete.processor.test.ts`,
  `test/schedulers/attachment-sweeper.test.ts` (testcontainers Postgres + Redis, memory storage).
- `packages/ui/test/avatar-field.test.tsx`; `apps/web/test/features/attachments/*`,
  `features/users/*form-input*`, `features/staff/*form-input*`, `staff-resume-card.test.tsx`.

## Steps (in order)

Each step: test first, then the code; `yarn lint`, `yarn typecheck`, the workspace's tests;
`yarn verify` before the commit (read-only turbo cache while the disk is tight). Context7 before
writing: `@google-cloud/storage` `getSignedUrl` v4 options (`extensionHeaders`,
`responseDisposition`), Prisma 7 `updateMany` + enum arrays, BullMQ 6 job schedulers, Base UI /
shadcn `Avatar`. One commit per ticket (T1–T11), ≤ 15 files each; the branch is fast- forwarded by
the user after the verifier and the reviewer, as the staff and client tickets.

- **T1 ∥ T2** schema + ADR; storage package + env. **T3** module + subject + context. **T4 ∥ T7**
  worker; web hook + field. **T5 ∥ T6** owners' API. **T8, T9, T10** screens, each browser-checked
  as the four roles next to the legacy screen before review. **T11** docs + bucket + smoke, Step 6.

## Risks and open questions (the user decides at approval)

1. **Name** — `Attachment` (recommended, decision 3) or keep the legacy `SourceFile`.
2. ~~Bucket~~ — decided 2026-10-09: `d-round-dev` (GCP project `dround-472307`), no shared-bucket
   prefix; staging / production buckets follow the name pattern when those environments exist.
3. ~~Local development~~ — decided 2026-10-09: the legacy key, copied to
   `TabSolution/d-round/credentials/google-storage-credential.json`, through `GCS_KEY_FILE`;
   `objectAdmin` on `d-round-dev` granted by the user; the same key serves dev and stg (the T11
   smoke confirms the access).
4. **Admins setting another 担当者's image** on 担当者追加 / 編集 — kept for legacy parity (T9);
   drop T9 if not wanted.
5. **Progress bars** — the legacy showed per-file progress; `FileField` shows a spinner. Kept as the
   spinner (YAGNI) unless parity is requested, then `fetch` becomes `XMLHttpRequest` in the hook.
6. **Timings** — pending TTL 24 h, URLs 15 min, sweeper every 15 min, delete grace 10 min.
7. **CORS preflight** — the custom `x-goog-content-length-range` header makes every PUT preflighted
   (one OPTIONS per file, cached 1 h). If a browser or proxy misbehaves, the fallback is a signed
   POST policy (`generateSignedPostPolicyV4` with `content-length-range`), same provider interface.
8. **`.claude/rules` edits** (migrations, queue, permissions tables) are denied to agents in auto
   mode (memory: agent-permissions); this plan names each edit so the approval clears them.
9. **ADR number** 0012 — confirm against peers' branches at branch time.
10. **Prisma interactive transaction timeout** (5 s default) — the GCS head check stays outside the
    transaction (decision in "API"); the transaction only runs `updateMany`.
11. **Key file path in env** — `GCS_KEY_FILE` points outside the repository; in CI and on servers
    the file is a mounted secret and the path differs per environment. CI secrets and `.env` are the
    user's (CLAUDE.md: do not touch).
12. **Memory provider in `NODE_ENV=test` only** — the API refuses to start without `GCS_*`
    otherwise; nobody gets a silent in-memory bucket in dev or prod.

## Out of scope

Workflow `FILE` / `IMAGE` form fields and their per-field limits (`RenderField.tsx`),
the 印鑑 (`Stamp`), `Client.image`, CSV upload / update / history (`CsvUpload*`, its own ticket),
image resizing / thumbnails (legacy `dimension`, `resized`, unused), content scanning, a generic
`attachment.readUrl` procedure, upload progress bars, `fake-gcs-server`, bulk deletion of a soft-
deleted owner's files (rows stay, as the legacy).

## Log

- 2026-10-09 — plan drafted from the legacy, romuten-v3 and the repo rules (planner role done
  inline, as on the staff and client tickets); GCS facts checked against the Cloud Storage docs
  (`x-goog-content-length-range` is a PUT request header enforced by the service; lifecycle `age` is
  in days and actions run asynchronously; V4 URLs expire after at most 604 800 s).
- 2026-10-09 — the user set the bucket (`d-round-dev`) and the key file (the legacy
  `google-storage-stg.json`, project `dround-472307`, service account `d-rount-storage@…`);
  credentials switch from PEM-in-env to `GCS_KEY_FILE`; risks 2, 3 and 11 closed.
- 2026-10-09 — `objectAdmin` on `d-round-dev` granted; the key copied (mode 600) to
  `TabSolution/d-round/credentials/google-storage-credential.json`, outside every git repository,
  since the same key serves dev and stg; the legacy file is left untouched.
- 2026-10-09 — implemented T1–T11 in 15 commits on `feature/D_ROUND-TBD_file-upload` (worktree),
  each with `yarn verify` green (43/43 tasks). What differs from the text above, each decided while
  building:
  - **Names**: the user's image is `avatar` / `avatarId` (inputs, `UserDetail.avatar`), not `image`
    / `imageId` — Better Auth's `User.image` string column made `image` a type clash; the column
    stays unused.
  - **`GCS_BUCKET`, `GCS_KEY_FILE` are always required** (like `BETTER_AUTH_SECRET`), not "unless
    `NODE_ENV=test`": CI never starts the app, and tests build the memory provider directly. The key
    file is read in `createGcsStorage`, so a wrong path stops the process at start-up.
  - **Upload URL size header is exact** (`<size>,<size>`), checked live on `d-round-dev`: another
    size → 400 `EntityTooSmall`, another type → 403, no range header → 400; the bucket is private
    (unsigned GET 403).
  - **`resumeIds` is optional** (absent keeps the files, as `avatarId`), so an older client never
    wipes a staff's 履歴書.
  - **Forms hold file values, not ids**: `attachmentValueSchema` (`id` required, so a submit while
    an upload runs is refused), `profileFormSchema`, the invite / update form schemas' `avatar`,
    `staffFormSchema.resumes`; `toProfileInput`, `toInviteInput`, `toUpdateInput`, `toStaffInput`
    send the ids.
  - **No `features/attachments`**: features do not import each other (`.claude/rules/ui.md`), so the
    hook is app-level (`apps/web/hooks/use-attachment-upload.ts`) and the PUT + value mapping sit in
    `apps/web/lib/attachments.ts`; the containers pass `upload*` to the forms, as `findAddress`.
  - **`@repo/storage` has no `object-key.ts`**: `sanitizeFileName` / `fileExtension` live in
    `@repo/validation` (the schema transforms the name), the key is built in the service.
  - **Queue**: the delete queue drops a job that failed every attempt (`removeOnFail: true`) so the
    sweeper can add the same id again; the sweeper enqueues the rows it expires on a later sweep,
    not at once, so a row attached in the same instant never meets a job.
  - **`@google-cloud/storage` 8.2.0**: 8.3.0 and 8.4.0 were 2 days and hours old.
  - **Bucket**: `d-round-dev` (created 2026-10-09, empty) got CORS for `http://localhost:3000` and
    `:3001` (the worktree smoke port), `PUT`, the two signed headers, and public access prevention
    enforced; uniform access was already on; no lifecycle rule; soft delete 7 days (default).
  - **Browser check fixes** (`accd67f`): the staff form validates on change, so the drop zone turned
    red while an upload ran — the file fields now show the schema's verdict only once no upload
    runs; `Field` stretched the avatar box, which put the remove button at the card's edge.
- 2026-10-09 — browser-checked on 3001/4001 against the dev database `workflow` (migration
  `add_attachments` applied there, additive) and `d-round-dev`: admin — profile image set and shown
  in the header, two 履歴書 on a staff edit (confirm lists them, detail links open with the Japanese
  name, 200), one removed and its object gone seconds later
  (`attachment deleted`), 担当者追加 / 担当者情報編集 show the image field first; super_admin,
  manager and AM — own image saved and shown, the staff detail's 履歴書 card read-only (no 編集 for
  manager and AM). No hydration warning on fresh loads (3000 and 3001 alike).
- 2026-10-09 — verifier PASS (fresh uncached verify 43/43, 1377 tests; no schema drift; commitlint;
  zero-warning ESLint on the 88 changed files). Review round 1: REQUEST_CHANGES, 1 BLOCKER, 9
  SHOULD, 12 NIT. Fixed in `c6c7a50`, `63e505b`, `e8f1e34` and the docs commit:
  - BLOCKER — FileField wrote each pick's own list back when its uploads finished (a second pick or
    a removal during an upload was undone): every write now starts from the latest value;
    FileField's first tests (StrictMode) fail on the old code and pass on the new.
  - SHOULD — the owner's row is locked in `syncAttachments` (two saves never leave two avatars,
    tested); kind and owner travel as one `AttachmentTarget` with a runtime check; an enqueue that
    fails after commit is logged (the sweeper re-enqueues); own keys only for the content type;
    `traceId` on delete jobs; a permanent bucket refusal fails the job at once and is an accepted,
    alerting retry per sweep (ADR 0012 Consequences); testing / queue / module-template rules
    brought up to date.
  - NIT — env entries above the Discord comment, `update` authorises before the bucket `head`,
    `deleteById` removes `DELETED` rows only, direction and C1 controls out of names, form schemas
    drop `avatarId`, no JSON parse error as the key-file error's cause, at most 20 unattached
    uploads per user, a failed second avatar pick keeps the image just uploaded (its preview is in
    the value), AvatarField tests in StrictMode asserting values, the attachments doc points at the
    README for the variables and at itself for the timings.
- 2026-10-09 — decided while building, against the text above (review round 1 asked to log them):
  read URLs are always `inline` (the legacy opened 履歴書 in a new tab; `attachment` and the
  provider's `disposition` option are gone); expired or foreign upload ids are `ValidationError`
  (BAD_REQUEST: the user picks the file again), not `ConflictError`; the delete worker runs 2 at a
  time, as planned; the avatar and 履歴書 service tests are `user-avatar.service.test.ts` and
  `staff-resume.service.test.ts` beside the existing files; there is no test of the upload hook
  (thin tRPC wiring, covered by the browser check) — its PUT is `uploadToSignedUrl` in
  `lib/attachments.ts`, kept apart from the hook so it is node-testable without tRPC; every upload
  failure reads ファイルのアップロードに失敗しました (the form checks type and size before asking,
  so an API refusal means something the user cannot fix).
- Open for the user: the key in use is the legacy one, tracked in the legacy git and shared by dev
  and stg — treat it as exposed; a dedicated service account (or at least a new key) for
  `d-round-dev`, and rotating the legacy key, are the user's call. `GCS_BUCKET` / `GCS_KEY_FILE` go
  into the main checkout's `.env` before merging.
- 2026-10-09 — browser re-check after review round 1 (3001/4001, `d-round-dev`): picking a file with
  the name and size of a stored one listed it twice under one React key and stuck the stepper —
  FileField now refuses it ("すでに選択されています", tested). Then admin: profile image, two
  new 履歴書 next to a stored one (the limit of three), confirm, detail links (200, Japanese names),
  one removed; super_admin, manager, AM: own image saved and shown, 履歴書 card read-only for
  manager and AM. No hydration warning on fresh loads.
- 2026-10-09 — review round 2: REQUEST_CHANGES, 1 BLOCKER, 4 SHOULD, 8 NIT, all fixed:
  - BLOCKER — the permanent-refusal test could not fail (BullMQ emits `failed` after every attempt):
    it now waits with a 60 s backoff and asserts the job is gone after its first failure; it fails
    with the `PermanentStorageError` branch removed and passes with it.
  - SHOULD — FileField syncs `latestRef` in a layout effect (a passive one could put an older list
    back after a later upload's write); a failed enqueue after commit logs at `error` (it alerts, as
    the email outbox); "a missing bucket" was wrong in five places — checked live, a delete in a
    missing bucket answers 404 and `ignoreNotFound` counts it as done, so only 400 / 401 / 403 are
    permanent; the upload hook shows the API's own refusal (too many uploads waiting) instead of the
    generic failure (`uploadRefusalOf`, tested).
  - NIT — the owner lock is `FOR NO KEY UPDATE` (sign-in and upload inserts referencing the user go
    on); the concurrent-save test holds the first save open and fails without the lock;
    `assertUploaded` types its owner from the kind; the AvatarField `upload` doc; U+061C stripped
    from names; the testing rule's path typo; the refusal policy's timing lives in
    docs/attachments.md only. A test of the GCS 400 / 401 / 403 mapping against a fake endpoint was
    not added: the comment in `gcs-storage.ts` states the limits (token-endpoint failures retry).
- 2026-10-11 — review round 3 (`f4f245b..ff28ddb`): 0 BLOCKER, 1 SHOULD, 3 NIT, all fixed. SHOULD: a
  worker with a wrong or missing bucket would have turned every delete into a 404 "done" and
  orphaned the objects silently; `StorageProvider.ready()` lists one object (needs only
  `storage.objects.list`, which `objectAdmin` has — reading bucket metadata would need a bucket
  role) and the API and the worker call it at start-up (checked live: `d-round-dev` ready, a missing
  bucket refused with 404). NITs: the refusal test uses the schema's real ZodError message, the hook
  keeps `target` a typed `const`, the concurrent-save test races `synced` with the first save so a
  failure reports instead of timing out.
