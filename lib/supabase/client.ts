import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // @supabase/ssr defaults to PKCE, which requires the code
        // exchange to happen in the SAME browser that requested the
        // link (the verifier lives in that browser's local storage).
        // That's wrong for password-reset/invite emails specifically —
        // the normal case is requesting it in one context and clicking
        // it somewhere else entirely (a phone, a different browser
        // profile, a Mail app). Confirmed this the hard way: a reset
        // requested from one browser context showed "Link expired" when
        // opened in another, even though the link itself was valid
        // (checked directly against auth.flow_state). Implicit flow puts
        // the tokens straight in the URL fragment instead, redeemable by
        // whichever browser actually opens the link.
        flowType: "implicit",
      },
    },
  );
}
