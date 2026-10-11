# ADR 0012 — Attachments: files on Google Cloud Storage, owned by rows

Date: 2026-10-09 · Status: accepted

## Context

The legacy API signed a V4 upload URL as soon as a file was picked and the browser wrote straight to
the final bucket path (`dround/{folder}/{userId}/{id}/{name}`). The `SourceFile` row it created had
no owner: owners kept bare object keys (`Staff.image`, `Staff.resume` as a comma-separated string,
`Client.image`, `Stamp.image`). A form that was never submitted left its objects behind, a replaced
avatar was never deleted (`deleteSignedUrl` had no caller), and the bucket was public
(`GCS_BUCKET_URL/{key}`), so "who may see this file" had no answer. The user, staff and client
tickets left プロフィール画像 and 履歴書 out until this decision.

## Decision

- **The database row is the truth, as the email outbox (ADR 0004).** `attachments` rows go `PENDING`
  (upload URL issued) → `ATTACHED` (inside the owner's write transaction) → `DELETED` (replaced,
  removed or expired; the object delete is a job after commit) → gone (the worker deletes the
  object, then the row). A repeatable sweeper turns `PENDING` rows older than 24 h into `DELETED`
  and re-enqueues `DELETED` rows whose job was lost. Objects never move.
- **One table, `kind` + one nullable owner column per owner** (`user_id`, `staff_id`; an exclusive
  arc). The kind names the owner column, the accepted types, the size limit and the bucket folder
  (`ATTACHMENT_RULES` in `@repo/validation`); exactly one owner column is set once `ATTACHED` (a
  service rule). Kinds today: `USER_AVATAR` (images, 5 MB, 1), `STAFF_RESUME` (PDF, 5 MB, 3).
- **Bucket**: private, uniform bucket-level access, one per environment (`d-round-dev` first). Key
  `{folder}/{random uuid}{.ext}`, stored in `object_key`; the original name lives in the row and is
  sent as `Content-Disposition` on read URLs.
- **Signed URLs (V4, 15 minutes)**: the upload URL pins `Content-Type`,
  `x-goog-content-length-range: <size>,<size>` (the declared size, checked against the kind's limit)
  and `x-goog-if-generation-match: 0` (create-only), so the storage refuses anything else and a URL
  never overwrites an object; an object is deleted only once its upload URL has expired, so a
  replayed URL cannot put it back with no row; read URLs come only with the owner's read procedure,
  so the owner's ability check is the file's.
- **Storage access** goes through `@repo/storage` (`StorageProvider`: GCS on
  `@google-cloud/storage`, a memory provider for tests), configured by `GCS_BUCKET` and
  `GCS_KEY_FILE` (a service-account key outside the repository).
- Schema folder `attachment/`, migration `add_attachments`: enums `attachment_kind`,
  `attachment_status`; table `attachments` with FKs `uploaded_by_id` and `user_id` → `users.id`,
  `staff_id` → `staffs.id`, all `Restrict` (users and staff are soft-deleted only).

## Alternatives

- **Upload to `tmp/{userId}/{uuid}`, copy into `uploads/{entity}/{id}/` on submit, GCS lifecycle
  deletes `tmp/` after a day**: the copy runs over the network inside the submit request (GCS has no
  rename), a copy before a failed transaction or a failed copy after a commit needs a worker and
  retries anyway, lifecycle `age` is in whole days and runs asynchronously, and the row is still
  needed for metadata and checks. Rejected.
- **Polymorphic `owner_type` / `owner_id` strings**: no foreign key, no `include`. Rejected.
- **A join table per owner**: two writes per attach and a table per kind. Rejected.
- **Upload on submit from the browser (the legacy profile page)**: the upload can succeed and the
  mutation fail, and a multi-file form waits for every upload at submit. Rejected.
- **A public bucket**: the reason the legacy could not restrict access. Rejected.

## Consequences

- An unsubmitted form costs a row for 24 h and an object until the sweeper runs; nothing else cleans
  the bucket, so the worker must run (it already must, for mail).
- A form kept open longer than 24 h gets "ファイルの有効期限が切れました" at submit.
- A new owner (workflow file fields, 印鑑) is one kind, one nullable column and one additive
  migration. The bucket is not browsable by owner; the table is the index.
- Read URLs expire after 15 minutes; screens refetch them with the owner (React Query `staleTime`).
- A bucket that refuses deletes (a key without the role: 400 / 401 / 403) is a configuration error:
  the job fails at once, the row stays `DELETED`, and every sweep tries again and alerts until it is
  fixed — nothing is lost, and the alert is the signal. Accepted 2026-10-09 (review round 1) instead
  of a give-up state on the row.
- Two saves of one owner take turns on the owner's row lock, so the per-kind limit holds under
  concurrency.
- A delete in a missing bucket answers 404, which counts as done; so the API and the worker list one
  object of their bucket at start-up and refuse to start when they cannot (review round 3).
