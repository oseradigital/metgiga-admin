"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BrandMark } from "@/components/BrandMark";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type Status = "checking" | "ready" | "invalid";

export default function SetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function establishSession() {
      // The link can arrive either as a PKCE `?code=...` or an implicit
      // `#access_token=...&refresh_token=...` fragment, depending on the
      // project's configured auth flow — handled explicitly rather than
      // assumed, same as the client portal's equivalent page.
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        setStatus(exchangeError ? "invalid" : "ready");
        return;
      }

      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        setStatus(setSessionError ? "invalid" : "ready");
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      setStatus(session ? "ready" : "invalid");
    }

    establishSession();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-bone-2 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm bg-bone rounded-2xl border border-midnight/10 p-6 sm:p-8 shadow-[0_12px_30px_-18px_rgba(16,21,31,0.25)]">
        <BrandMark className="w-7 h-7 mb-6" />

        {status === "checking" ? (
          <p className="text-sm text-grey-on-light">Checking your link…</p>
        ) : status === "invalid" ? (
          <div className="space-y-2">
            <h1 className="font-display text-2xl">Link expired</h1>
            <p className="text-sm text-grey-on-light leading-relaxed">
              This link is invalid or has already been used.{" "}
              <a href="/forgot-password" className="text-copper-text hover:underline">
                Request a new one
              </a>
              .
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <h1 className="font-display text-2xl mb-1.5">Set your password</h1>
              <p className="text-sm text-grey-on-light">One last step before you&apos;re in.</p>
            </div>

            <Field label="Password" htmlFor="password" hint="At least 8 characters.">
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
              />
            </Field>

            <Field label="Confirm password" htmlFor="confirmPassword">
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
              />
            </Field>

            {error ? (
              <p role="alert" className="text-sm text-error">
                {error}
              </p>
            ) : null}

            <Button type="submit" loading={submitting} className="w-full">
              {submitting ? "Saving…" : "Set password and sign in"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
