import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Organisation } from "@/lib/crm/organisation-types";

// Types/constants live in organisation-types.ts (no "server-only"), so a
// client component can import those directly without pulling in this
// file's DB access — import from there, not from here, for anything
// that isn't a server-side read.

export async function listOrganisations(): Promise<Organisation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("crm")
    .from("organisations")
    .select("id, name, legal_name, website, industry, status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[listOrganisations]", error.message);
    return [];
  }
  return data;
}

export async function getOrganisation(id: string): Promise<Organisation | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("crm")
    .from("organisations")
    .select("id, name, legal_name, website, industry, status, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[getOrganisation]", error.message);
    return null;
  }
  return data;
}
