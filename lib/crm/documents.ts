import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ClientDocument } from "@/lib/crm/document-types";

const DOCUMENT_SELECT = "id, organisation_id, title, storage_path, file_name, file_size, mime_type, created_at";

export async function listDocumentsForOrganisation(organisationId: string): Promise<ClientDocument[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("crm")
    .from("client_documents")
    .select(DOCUMENT_SELECT)
    .eq("organisation_id", organisationId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[listDocumentsForOrganisation]", error.message);
    return [];
  }
  return data ?? [];
}
