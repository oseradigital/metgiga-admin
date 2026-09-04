"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadClientDocument, deleteClientDocument } from "@/lib/crm/actions";
import type { ClientDocument } from "@/lib/crm/document-types";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// The team's side of Client Portal Stage 2 increment 2 — upload a file
// here, it shows up on the client's own /documents page (via the new
// crm.client_documents client SELECT policy) and in their Recent
// activity. No edit-in-place: a wrong upload is deleted and re-added.
export function DocumentsPanel({
  organisationId,
  documents,
}: {
  organisationId: string;
  documents: ClientDocument[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState<string | undefined>();
  const [fileError, setFileError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const file = fileInputRef.current?.files?.[0];
    let hasError = false;
    if (!title.trim()) {
      setTitleError("Enter a title.");
      hasError = true;
    } else {
      setTitleError(undefined);
    }
    if (!file) {
      setFileError("Choose a file.");
      hasError = true;
    } else {
      setFileError(undefined);
    }
    if (hasError) return;

    const formData = new FormData();
    formData.set("organisationId", organisationId);
    formData.set("title", title.trim());
    formData.set("file", file!);

    setSaving(true);
    const result = await uploadClientDocument(formData);
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setTitle("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setAdding(false);
    router.refresh();
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const result = await deleteClientDocument(id, organisationId);
    setDeletingId(null);
    if (result.ok) router.refresh();
  }

  return (
    <div className="bg-bone rounded-xl border border-midnight/10 p-5">
      <div className="flex items-center justify-end mb-3">
        {!adding ? (
          <Button variant="ghost" onClick={() => setAdding(true)}>
            Add document
          </Button>
        ) : null}
      </div>

      {documents.length === 0 && !adding ? (
        <p className="text-sm text-grey-on-light">No documents shared with this client yet.</p>
      ) : null}

      {documents.length > 0 ? (
        <ul className="mb-2">
          {documents.map((doc, i) => (
            <li
              key={doc.id}
              className={`flex items-center justify-between gap-4 py-2.5 ${i > 0 ? "border-t border-midnight/10" : ""}`}
            >
              <div className="min-w-0">
                <p className="text-sm text-midnight truncate">{doc.title}</p>
                <p className="text-xs text-grey-on-light">
                  {formatDate(doc.created_at)}
                  {formatBytes(doc.file_size) ? ` · ${formatBytes(doc.file_size)}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(doc.id)}
                disabled={deletingId === doc.id}
                className="text-xs text-grey-on-light hover:text-error transition-colors shrink-0 disabled:opacity-50"
              >
                {deletingId === doc.id ? "Removing…" : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {adding ? (
        <form onSubmit={handleAdd} className="space-y-4 pt-2" noValidate>
          <Field label="Title" htmlFor="document-title" required error={titleError}>
            <Input
              id="document-title"
              placeholder="e.g. Q3 performance report"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (titleError) setTitleError(undefined);
              }}
            />
          </Field>
          <Field label="File" htmlFor="document-file" required error={fileError}>
            <input
              ref={fileInputRef}
              id="document-file"
              type="file"
              onChange={() => fileError && setFileError(undefined)}
              className="w-full text-sm text-midnight file:mr-3 file:h-9 file:px-4 file:rounded-lg file:border-0 file:bg-midnight file:text-bone file:text-sm file:font-medium file:cursor-pointer"
            />
          </Field>
          {error ? (
            <p role="alert" className="text-sm text-error">
              {error}
            </p>
          ) : null}
          <div className="flex items-center gap-3">
            <Button type="submit" loading={saving}>
              {saving ? "Uploading…" : "Upload"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
