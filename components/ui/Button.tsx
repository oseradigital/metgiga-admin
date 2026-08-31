import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
  loading?: boolean;
};

// h-12 (48px) — comfortably above the 44px minimum tap target the a11y
// pass will check for. Same copper/midnight pairing as metgiga.com's
// .btn-primary / .btn-ghost, adapted to Tailwind utilities via the theme
// tokens in globals.css.
export function Button({
  variant = "primary",
  loading = false,
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  const base =
    "h-12 px-6 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-midnight text-bone hover:bg-midnight-2",
    ghost: "border border-midnight/20 text-midnight hover:border-midnight/40",
  };

  return (
    <button
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <span className="size-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
