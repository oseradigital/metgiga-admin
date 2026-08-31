import { cloneElement, isValidElement, type ReactNode } from "react";

type FieldProps = {
  label: string;
  htmlFor: string;
  optional?: boolean;
  // Renders a visible "*" after the label (see the "* Required" note
  // rendered by RequiredFieldsNote at the end of each form) AND sets
  // aria-required/native required on the control. The asterisk itself is
  // aria-hidden — aria-required already announces the state to screen
  // readers, so the * isn't also read aloud as a redundant "star."
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
};

// Label style matches metgiga.com's contact form exactly (uppercase,
// tracked, small) — the one form-typography convention that already
// existed on the brand, worth reusing rather than inventing a new one.
//
// Also the single place that wires a field's error/required state onto
// its actual form control — every Input/Select/Textarea/Checkbox here
// gets aria-invalid, aria-describedby and aria-required for free via
// cloneElement, rather than each of the ~40 fields across the onboarding
// steps repeating that wiring by hand (and inevitably some of them not).
// This is what "one shared validation architecture" means at the UI
// layer, not just the schema layer.
export function Field({ label, htmlFor, optional, required, hint, error, children }: FieldProps) {
  const errorId = `${htmlFor}-error`;
  const hintId = `${htmlFor}-hint`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  const control =
    isValidElement<{ invalid?: boolean }>(children) && typeof children.type !== "string"
      ? cloneElement(children, {
          "aria-invalid": error ? true : undefined,
          "aria-describedby": describedBy,
          "aria-required": required ? true : undefined,
          required: required || undefined,
          invalid: Boolean(error) || children.props.invalid,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
      : children;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <label
          htmlFor={htmlFor}
          className="text-xs uppercase tracking-wide text-grey-on-light font-medium"
        >
          {label}
          {required ? (
            <span className="text-copper-text ml-0.5" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
        {optional ? (
          <span className="text-xs text-grey-on-light/70">Optional</span>
        ) : null}
      </div>
      {control}
      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-xs text-error">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-xs text-grey-on-light">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
