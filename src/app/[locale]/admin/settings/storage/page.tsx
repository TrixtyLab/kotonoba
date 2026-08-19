import { getActiveSite } from "@/lib/tenant";
import { getSiteSettings } from "@/actions/settings";
import { notFound } from "next/navigation";
import { StorageSettingsClient, type EnvStorageInfo } from "@/components/admin/settings/StorageSettingsClient";

/**
 * Server page component loading current storage backend configurations and rendering the storage settings editor.
 *
 * @returns React JSX storage settings view.
 */
export default async function StorageSettingsPage() {
  const site = await getActiveSite();
  if (!site) notFound();

  const settingsMap = await getSiteSettings(site.id);

  const envStorageInfo: EnvStorageInfo = {
    isR2Configured: Boolean(
      process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME
    ),
    isS3Configured: Boolean(
      (process.env.S3_BUCKET || process.env.R2_BUCKET_NAME) &&
      (process.env.AWS_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID) &&
      (process.env.AWS_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY)
    ),
    r2Bucket: process.env.R2_BUCKET_NAME,
    r2AccountId: process.env.R2_ACCOUNT_ID ? `${process.env.R2_ACCOUNT_ID.slice(0, 6)}••••••` : undefined,
    r2PublicUrl: process.env.R2_PUBLIC_URL,
    s3Bucket: process.env.S3_BUCKET,
    s3Region: process.env.AWS_REGION,
  };

  return <StorageSettingsClient siteId={site.id} initialSettings={settingsMap} envStorageInfo={envStorageInfo} />;
}
