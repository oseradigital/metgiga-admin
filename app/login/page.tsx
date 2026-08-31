"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BrandMark } from "@/components/BrandMark";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const nextFieldErrors: { email?: string; password?: string } = {};
    if (!email.trim()) nextFieldErrors.email = "Enter your email address.";
    if (!password) nextFieldErrors.password = "Enter your password.";
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      document.getElementById(nextFieldErrors.email ? "email" : "password")?.focus();
      return;
    }
    setFieldErrors({});

    setLoading(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setLoading(false);
      // Supabase's own message ("Invalid login credentials") doesn't
      // reveal whether the email exists — kept as-is rather than
      // replaced, same account-enumeration hygiene as the client portal.
      setError(signInError.message);
      return;
    }

    // Being a valid Supabase Auth user isn't enough here — this project
    // is shared with the client-facing onboarding portal, so a signed-in
    // session could belong to a clinic contact, not a team member. Check
    // crm.team_members before ever landing on an admin screen, and give
    // a specific reason rather than silently bouncing back to this page.
    const { data: member, error: memberError } = await supabase
      .schema("crm")
      .from("team_members")
      .select("id")
      .eq("id", (await supabase.auth.getUser()).data.user?.id)
      .eq("is_active", true)
      .maybeSingle();

    setLoading(false);

    if (memberError || !member) {
      await supabase.auth.signOut();
      setError(
        memberError
          ? "Couldn't verify admin access. Try again, or contact Saif or Abubakar directly."
          : "This account doesn't have access to Metgiga Admin.",
      );
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12 bg-bone">
      <div className="w-full max-w-sm">
        <BrandMark className="w-8 h-8 mb-8" />
        <h1 className="font-display text-2xl mb-1.5">Metgiga Admin</h1>
        <p className="text-sm text-grey-on-light mb-8">Internal team access only.</p>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <Field label="Email address" htmlFor="email" required error={fieldErrors.email}>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@metgiga.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
              }}
            />
          </Field>

          <Field label="Password" htmlFor="password" required error={fieldErrors.password}>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
                }}
                className="pr-12"
                required
                aria-required="true"
                invalid={Boolean(fieldErrors.password)}
                aria-invalid={fieldErrors.password ? "true" : undefined}
                aria-describedby={fieldErrors.password ? "password-error" : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 px-3.5 text-xs text-grey-on-light hover:text-midnight"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </Field>

          {error ? (
            <p role="alert" className="text-sm text-error">
              {error}
            </p>
          ) : null}

          <Button type="submit" loading={loading} className="w-full">
            {loading ? "Signing in…" : "Log in"}
          </Button>

          <div className="text-center">
            <a href="/forgot-password" className="text-sm text-copper-text hover:underline">
              Forgot password, or first time signing in?
            </a>
          </div>
        </form>
      </div>
    </main>
  );
}
