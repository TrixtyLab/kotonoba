"use server";

import { issueSessionCookies } from "@/lib/auth/cookies";
import { completeSetupWizardService, type SetupWizardData } from "@/lib/services/setup";

export type { SetupWizardData };

/** Executes atomic first-time setup provisioning and signs in the initial super administrator. */
export async function completeSetupWizard(data: SetupWizardData) {
  const res = await completeSetupWizardService(data);
  if (!res.success) {
    return { success: false as const, error: res.error };
  }

  await issueSessionCookies(res.session);
  return { success: true as const, siteId: res.siteId, userId: res.userId };
}
