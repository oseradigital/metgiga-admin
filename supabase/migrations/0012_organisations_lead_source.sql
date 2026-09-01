-- UX refinement pass: the trimmed "New organisation" form asks for an
-- optional lead source at creation time (how a cold prospect was
-- found) — distinct from crm.deals.source, which is about a specific
-- deal, not the organisation as a whole. A prospect can exist with a
-- known source before any deal does.
alter table crm.organisations add column source text;
