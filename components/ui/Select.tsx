import { forwardRef, type SelectHTMLAttributes } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className = "", children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={`w-full h-11 px-3.5 rounded-lg border border-midnight/15 bg-bone text-midnight text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/40 focus-visible:border-copper transition-colors ${className}`}
      {...props}
    >
      {children}
    </select>
  );
});
