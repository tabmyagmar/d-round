# hooks

Shared React hooks (`use-*.ts`): `use-debounced-callback.ts` (debounce an event handler, e.g. a
search box), `use-stepper.ts` (the current step of a multi-step react-hook-form form: validates the
step's fields, then an optional async guard, before moving on; drives the composed `Stepper`) and
the shadcn hooks the CLI installs here via the `hooks` alias (`use-mobile.ts`).
