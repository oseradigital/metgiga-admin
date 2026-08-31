-- Step 5: data model expansion for the target 6-stage onboarding IA
-- (Your clinic / Business & team / Marketing access / Content & brand /
-- Agreement / Final review). All nullable — this is schema-ahead-of-UI:
-- Stage 6 builds the actual step forms that populate these. Nothing here
-- touches a column any existing flow (signing, payment, invite) reads or
-- writes, so those should be unaffected — verified after this migration
-- runs, not just assumed.
--
-- Deliberately NOT added, per the spec's own "no duplicate questions"
-- rule — already covered by existing columns from 0001_init.sql:
--   treatmentPriorities        -> "priority treatments"
--   monthlyAdSpendRange        -> "approximate monthly ad budget"
--   currentAgencyOrFreelancer,
--   pastAgencyExperience       -> "worked with an agency before / what
--                                  worked / what frustrated you"
--   brandGuidelinesNotes       -> free-text brand notes (brand_folder_link
--                                  below is a *link*, a distinct thing)

alter table public.onboarding_records
  -- Your clinic (spec section 6)
  add column if not exists legal_company_name text,
  add column if not exists website text,
  -- {name, address}[] — "Add another location" rather than N empty forms.
  add column if not exists locations jsonb not null default '[]'::jsonb,
  add column if not exists contact_role text,
  add column if not exists instagram_handle text,
  add column if not exists tiktok_handle text,
  add column if not exists other_social_channels text,

  -- Business & team (section 7)
  -- {name, role}[]
  add column if not exists practitioners jsonb not null default '[]'::jsonb,
  add column if not exists decision_maker text,
  add column if not exists enquiries_handled_by text,
  add column if not exists content_approver text,
  add column if not exists advertising_approver text,
  add column if not exists urgent_contact text,
  add column if not exists opening_hours text,
  add column if not exists consultation_model text,
  add column if not exists booking_method text,

  -- Marketing access (section 8) — booking-system choice drives the
  -- conditional instructions the spec describes; the connections
  -- themselves live in ad_account_status (broadened below), not here.
  add column if not exists booking_system_name text,

  -- Content & brand (section 9). brand_folder_link is the actual
  -- mechanism this round per the "share a folder link is sufficient for
  -- v1" decision — no upload storage built yet.
  add column if not exists brand_folder_link text,
  add column if not exists brand_feel text[] not null default '{}',
  add column if not exists brands_admired text,
  add column if not exists style_to_avoid text,

  -- Marketing/creative discovery (section 10). Deliberately does NOT
  -- duplicate ad-spend/past-agency questions already captured above.
  add column if not exists growth_priority_services text,
  add column if not exists differentiators text,
  add column if not exists common_questions text,
  add column if not exists objections text,
  add column if not exists ideal_client_type text,
  add column if not exists treatments_not_to_promote text,

  -- Content production (section 11). These describe the CLINIC'S
  -- services/premises/scheduling, not any individual patient — no
  -- special-category health data here (see section 26: patient consent
  -- procedures is a yes/no about whether the clinic has a process, not
  -- collecting anyone's actual health information).
  add column if not exists camera_comfort text
    check (camera_comfort in ('very-comfortable', 'comfortable', 'somewhat-uncomfortable', 'prefer-not-to')),
  add column if not exists who_can_appear text,
  add column if not exists filming_availability text,
  add column if not exists filming_areas text,
  add column if not exists filming_restrictions text,
  add column if not exists filming_suitable_treatments text,
  add column if not exists has_consent_procedures boolean;

-- ad_account_status.platform was scoped to Meta/Google-ads-only
-- (0001_init.sql) — the Marketing Access step's connection cards cover
-- more than that (Analytics, Business Profile, booking system, CRM,
-- "other"). Check constraints can't be altered in place.
alter table public.ad_account_status drop constraint if exists ad_account_status_platform_check;
alter table public.ad_account_status add constraint ad_account_status_platform_check
  check (platform in ('meta', 'google_ads', 'google_analytics', 'google_business_profile', 'booking_system', 'crm', 'other'));
