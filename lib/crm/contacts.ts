import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Contact = {
  id: string;
  organisation_id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  is_primary: boolean;
  created_at: string;
};

export async function listContacts(organisationId: string): Promise<Contact[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("crm")
    .from("contacts")
    .select("id, organisation_id, first_name, last_name, email, phone, role, is_primary, created_at")
    .eq("organisation_id", organisationId)
    // Primary contact first, then most recently added.
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[listContacts]", error.message);
    return [];
  }
  return data;
}
