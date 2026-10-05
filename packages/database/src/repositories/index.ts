// Repository barrel. One file per aggregate: <entity>.repository.ts, exporting a factory
// `create<Entity>Repository(db: DbClient)` with pure data-access methods (no validation,
// no business rules). See .claude/rules/repositories.md.
export * from "./outbox-email.repository";
export * from "./permission.repository";
export * from "./user.repository";
