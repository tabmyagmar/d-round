# ADR 0010 — Error alerts to Discord through the logger

Date: 2026-10-08 · Status: accepted

## Context

No failure left the process: every backend error was one pino line on stdout, an uncaught exception
or unhandled rejection was not even that (Node printed a stack and exited without running a shutdown
step), and nobody was told. romuten-v3 posts to a Discord webhook from one Apollo plugin, so its
worker, queue, Redis and shutdown failures never alert, and it has no grouping, rate limit or
timeout.

## Decision

- **Alerts are a log sink.** `createDiscordAlertStream`
  (`packages/logger/src/discord-alert-stream.ts`) receives every `error` and `fatal` line through
  `pino.multistream` and posts one embed to `DISCORD_ALERT_WEBHOOK_URL` (optional for the API and
  the worker; unset = no alerts, anything but an https URL = the process refuses to start). The log
  line stays the record, Discord is the signal, and a new `logger.error` anywhere alerts without
  further code.
- **The pino level is the taxonomy.** Domain errors and 4xx are `warn` and never alert, unknown
  failures are `error`, a dying process is `fatal`.
- **One message per incident and per problem.** Lines sharing a `requestId` or `jobId` within 10 s
  fold into the first; a fingerprint (process, message, error type, path, queue, status) is sent
  once per 5 minutes and its next message counts the repeats (a problem quiet for 10 minutes starts
  over); at most 10 error messages a minute leave a process, the next delivered message counts what
  was dropped, and a fatal line always goes.
- **The channel never hurts the app.** `fetch` with a 5 s timeout and no retry; a failed send is one
  stderr line and a count, never an exception in a request or a job.
- **Embed**: the log message as title, colour by level, the error's type, the first line of its
  message with e-mail addresses masked and its first 8 stack frames, the identifiers of an
  allow-list as fields, no mentions, capped under Discord's limits. Nothing else of the line is
  sent; pino's redaction covers keys, not message text, so the message is cut down here.
- **Fatal paths deliver.** `uncaughtException` and `unhandledRejection` are logged as fatal and run
  the ordered shutdown with exit code 1; the stream's `flush()` (at most 3 s) is the last shutdown
  step.

## Alternatives

- romuten-v3's explicit `AlertService.notifyIfNeeded` per transport: every call site has to remember
  it, and only one transport did.
- The sink as a pino transport (worker thread): the module path differs between `tsx` and the
  bundle, the last fatal line is lost when the process exits first, and tests cannot inject a fake
  `fetch`.
- Sentry or alerting on shipped logs (Grafana, Datadog): grouping, history and on-call routing come
  with it, but so do an account, an SDK or a log pipeline this template does not have yet.

## Consequences

- No new dependency; pino-pretty runs in-process in development, with the same output.
- The webhook URL is a secret: the root `.env` locally, the deployment's environment elsewhere.
- An error message is where personal data hides (an SMTP 550 names the recipient, a Prisma
  validation error prints the query arguments below its first line). The first line still reaches
  the channel with only e-mail addresses masked, so the channel must stay private; the full line is
  in the logs under the alert's `requestId` or `jobId`.
- Grouping is per process and in memory: a restart forgets it, and two replicas alert twice. The
  line `shutdown timed out, forcing exit` itself is not delivered (the exit is immediate), but the
  alert that started the shutdown is.
- Revisit when a process type runs more than one replica, alert history or on-call routing is
  needed, or `apps/web` errors must alert: move alerting to a log platform or Sentry then, and
  remove this sink.
