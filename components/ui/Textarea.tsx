import { forwardRef, type TextareaHTMLAttributes } from "react";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

// Same tokens as Input — boxed, copper focus ring, error border.
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, className = "", ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={`w-full min-h-[6.5rem] px-3.5 py-2.5 rounded-lg border bg-bone text-midnight text-sm placeholder:text-grey-on-light/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/40 focus-visible:border-copper transition-colors resize-y ${
        invalid ? "border-error" : "border-midnight/15"
      } ${className}`}
      {...props}
    />
  );
});
