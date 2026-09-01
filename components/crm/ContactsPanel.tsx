"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createContact, setPrimaryContact } from "@/lib/crm/actions";
import type { Contact } from "@/lib/crm/contacts";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export function ContactsPanel({ organisationId, contacts }: { organisationId: string; contacts: Contact[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [firstNameError, setFirstNameError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [settingPrimary, setSettingPrimary] = useState<string | null>(null);

  function resetForm() {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setRole("");
    setFirstNameError(undefined);
    setError(null);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!firstName.trim()) {
      setFirstNameError("Enter a first name.");
      document.getElementById("contact-firstName")?.focus();
      return;
    }
    setFirstNameError(undefined);

    setSaving(true);
    const result = await createContact(organisationId, {
      firstName,
      lastName,
      email,
      phone,
      role,
      isPrimary: contacts.length === 0, // first contact on an org defaults to primary
    });
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    resetForm();
    setAdding(false);
    router.refresh();
  }

  async function handleSetPrimary(contactId: string) {
    setSettingPrimary(contactId);
    const result = await setPrimaryContact(organisationId, contactId);
    setSettingPrimary(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="bg-bone rounded-xl border border-midnight/10 p-5">
      <div className="flex items-center justify-end mb-3">
        {!adding ? (
          <Button variant="ghost" onClick={() => setAdding(true)}>
            Add contact
          </Button>
        ) : null}
      </div>

      {contacts.length === 0 && !adding ? (
        <p className="text-sm text-grey-on-light">No contacts yet.</p>
      ) : null}

      {contacts.length > 0 ? (
        <ul className="space-y-3 mb-5">
          {contacts.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-4 py-3 border-b border-midnight/10 last:border-b-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-midnight truncate">
                  {c.first_name} {c.last_name ?? ""}
                  {c.role ? <span className="text-grey-on-light font-normal"> · {c.role}</span> : null}
                </p>
                <p className="text-xs text-grey-on-light truncate">
                  {[c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              {c.is_primary ? (
                <Badge tone="copper">Primary</Badge>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSetPrimary(c.id)}
                  disabled={settingPrimary === c.id}
                  className="text-xs text-grey-on-light hover:text-midnight transition-colors whitespace-nowrap disabled:opacity-50"
                >
                  {settingPrimary === c.id ? "Setting…" : "Set as primary"}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {adding ? (
        <form onSubmit={handleAdd} className="space-y-4 pt-2" noValidate>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="First name" htmlFor="contact-firstName" required error={firstNameError}>
              <Input
                id="contact-firstName"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  if (firstNameError) setFirstNameError(undefined);
                }}
              />
            </Field>
            <Field label="Last name" htmlFor="contact-lastName" optional>
              <Input id="contact-lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Email" htmlFor="contact-email" optional>
              <Input id="contact-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Phone" htmlFor="contact-phone" optional>
              <Input id="contact-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
          </div>
          <Field label="Role" htmlFor="contact-role" optional hint="Their job title or role at the organisation.">
            <Input id="contact-role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Owner" />
          </Field>

          {error ? (
            <p role="alert" className="text-sm text-error">
              {error}
            </p>
          ) : null}

          <div className="flex items-center gap-3">
            <Button type="submit" loading={saving}>
              {saving ? "Adding…" : "Add contact"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                resetForm();
                setAdding(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
