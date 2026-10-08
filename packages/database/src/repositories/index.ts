// Repository barrel. One file per aggregate: <entity>.repository.ts, exporting a factory
// `create<Entity>Repository(db: DbClient)` with pure data-access methods (no validation,
// no business rules). See .claude/rules/repositories.md.
export * from "./client.repository";
export * from "./comment-template.repository";
export * from "./outbox-email.repository";
export * from "./permission.repository";
export * from "./source.repository";
export * from "./staff.repository";
export * from "./user.repository";
