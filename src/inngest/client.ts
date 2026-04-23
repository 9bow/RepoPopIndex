import { Inngest } from "inngest";

// Must match the App ID in Inngest (Apps → your app). If "Unattached syncs" appears
// in the dashboard, set `INNGEST_APP_ID` in Vercel to the value shown in sync details
// and redeploy, or rename the Inngest app to match the default `repopopindex`.
const appId = process.env.INNGEST_APP_ID ?? "repopopindex";

export const inngest = new Inngest({ id: appId });
