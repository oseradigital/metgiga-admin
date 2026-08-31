import { forwardRef, type InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

// Boxed, not the marketing site's underline style — a page of dense,
// multi-field forms needs visible field boundaries to scan quickly;
// underline-only reads ambiguously once there are a dozen fields on
// screen instead of one. Same copper focus, same type/colour tokens.
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, className = "", ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={`w-full h-11 px-3.5 rounded-lg border bg-bone text-midnight text-sm placeholder:text-grey-on-light/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/40 focus-visible:border-copper transition-colors ${
        invalid ? "border-error" : "border-midnight/15"
      } ${className}`}
      {...props}
    />
  );
});
