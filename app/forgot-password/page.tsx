"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    // Reuses /set-password — same flow for "I forgot my password" and "I
    // have never had a password" (both accounts were created without one;
    // see docs/release-1-architecture.md). Supabase treats a password
    // reset link and an invite link identically from here on.
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/set-password`,
    });
    setLoading(false);

    // Rate-limit (429/over_email_send_rate_limit) is safe to disclose
    // directly — it fires per-email regardless of whether the account
    // exists, so it doesn't leak anything account-enumeration hygiene
    // needs to hide. Found this the hard way: without this check, a
    // legitimately-throttled retry silently showed the same "check your
    // email" success state as a real send, with nothing to explain why
    // no second email ever arrives. Every other outcome keeps the
    // uniform success state, unchanged.
    if (resetError?.code === "over_email_send_rate_limit") {
      setError("You've already requested this recently. Check your email, or wait a moment and try again.");
      return;
    }
    if (resetError) {
      console.error("[forgot-password]", resetError);
    }
    setSent(true);
  }

  return (
    <main className="min-h-screen bg-bone flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        {sent ? (
          <div className="text-center">
            <h1 className="font-display text-2xl mb-3">Check your email</h1>
            <p className="text-sm text-grey-on-light leading-relaxed">
              If {email.trim()} has Metgiga Admin access, we&apos;ve sent a link to set your
              password.
            </p>
            <a href="/login" className="inline-block mt-6 text-sm text-copper-text hover:underline">
              Back to login
            </a>
          </div>
        ) : (
          <>
            <h1 className="font-display text-2xl mb-1.5">Set or reset your password</h1>
            <p className="text-sm text-grey-on-light mb-8">
              Enter your email and we&apos;ll send you a link to choose one.
            </p>
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <Field label="Email address" htmlFor="email">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@metgiga.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              {error ? (
                <p role="alert" className="text-sm text-error">
                  {error}
                </p>
              ) : null}
              <Button type="submit" loading={loading} className="w-full">
                {loading ? "Sending…" : "Send link"}
              </Button>
              <div className="text-center">
                <a href="/login" className="text-sm text-copper-text hover:underline">
                  Back to login
                </a>
              </div>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
