"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createOrganisation } from "@/lib/crm/actions";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function NewOrganisationPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
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
    const result = await createOrganisation({ name, legalName, website, industry });
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/organisations/${result.data.id}`);
  }

  return (
    <div className="max-w-lg">
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

        <Field label="Legal name" htmlFor="legalName" optional>
          <Input id="legalName" value={legalName} onChange={(e) => setLegalName(e.target.value)} />
        </Field>

        <Field label="Website" htmlFor="website" optional>
          <Input
            id="website"
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://"
          />
        </Field>

        <Field label="Industry" htmlFor="industry" optional>
          <Input
            id="industry"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="Aesthetics clinic"
          />
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
