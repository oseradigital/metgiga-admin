"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createOrganisation } from "@/lib/crm/actions";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

// Deliberately minimal — a cold prospect may only have a name and an
// Instagram handle at first. legal_name/industry/full contact details
// aren't asked here; they get filled in later from the organisation
// detail page once actually known. Creating a prospect should not feel
// like client onboarding.
export default function NewOrganisationPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [source, setSource] = useState("");
  const [nameError, setNameError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setNameError("Enter an organisation name.");
      document.getElementById("name")?.focus();
      return;
    }
    setNameError(undefined);

    setLoading(true);
    const result = await createOrganisation({
      name,
      website,
      primaryContactName: contactName,
      primaryContactEmail: contactEmail,
      source,
    });
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/organisations/${result.data.id}`);
  }

  return (
    <div className="max-w-md">
      <h1 className="font-display text-2xl mb-1.5">New organisation</h1>
      <p className="text-sm text-grey-on-light mb-8">Everything except the name can be filled in later.</p>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <Field label="Name" htmlFor="name" required error={nameError}>
          <Input
            id="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (nameError) setNameError(undefined);
            }}
            placeholder="Aurora Aesthetics"
          />
        </Field>

        <Field label="Website" htmlFor="website" optional>
          <Input
            id="website"
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https:// or @instagram_handle"
          />
        </Field>

        <Field label="Primary contact name" htmlFor="contactName" optional>
          <Input id="contactName" value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </Field>

        <Field label="Primary contact email" htmlFor="contactEmail" optional>
          <Input
            id="contactEmail"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
          />
        </Field>

        <Field label="Lead source" htmlFor="source" optional hint="How this prospect found us, or how we found them.">
          <Input id="source" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Referral" />
        </Field>

        {error ? (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        ) : null}

        <div className="flex items-center gap-3">
          <Button type="submit" loading={loading}>
            {loading ? "Creating…" : "Create organisation"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.push("/organisations")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
