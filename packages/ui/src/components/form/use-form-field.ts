import { useController } from "react-hook-form";
import type { Control, FieldPath, FieldValues } from "react-hook-form";

/**
 * `useController` with the two adjustments every field needs: `disabled` is only forwarded when
 * set (exactOptionalPropertyTypes), and `ref` is pulled out of `field` so the React Compiler
 * lint (react-hooks/refs) does not treat the whole `field` object as a ref. `ref` is only ever
 * forwarded to the focusable element.
 */
export const useFormField = <TValues extends FieldValues>({
  control,
  name,
  disabled,
}: {
  control: Control<TValues>;
  name: FieldPath<TValues>;
  disabled?: boolean | undefined;
}) => {
  const {
    field: { ref, ...field },
    fieldState,
  } = useController({
    control,
    name,
    ...(disabled === undefined ? {} : { disabled }),
  });
  return { ref, field, fieldState };
};
