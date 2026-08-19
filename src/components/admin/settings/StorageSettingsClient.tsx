"use client";

import React, { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { saveSiteSettings } from "@/actions/settings";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { HardDrive, Save, Cloud, CheckCircle2 } from "lucide-react";
import { useRouter } from "@/i18n/routing";

/**
 * Configuration properties for the StorageSettingsClient component.
 */
export interface StorageSettingsClientProps {
  /** Target site ID. */
  siteId: string;
  /** Key-value dictionary of existing site settings. */
  initialSettings: Record<string, string>;
}

/**
 * Administrative storage settings interface allowing administrators to switch between local file storage and S3/Cloudflare R2 cloud buckets.
 *
 * @param props - StorageSettingsClientProps configuring site ID and current storage provider settings.
 * @returns React JSX storage settings view.
 */
export function StorageSettingsClient({ siteId, initialSettings }: StorageSettingsClientProps) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const toast = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [provider, setProvider] = useState(initialSettings.storage_provider || "local");
  const [s3Bucket, setS3Bucket] = useState(initialSettings.s3_bucket || "");
  const [s3Region, setS3Region] = useState(initialSettings.s3_region || "us-east-1");
  const [s3Endpoint, setS3Endpoint] = useState(initialSettings.s3_endpoint || "");
  const [s3AccessKey, setS3AccessKey] = useState(initialSettings.s3_access_key || "");
  const [s3SecretKey, setS3SecretKey] = useState(initialSettings.s3_secret_key || "");
  const [s3PublicUrl, setS3PublicUrl] = useState(initialSettings.s3_public_url || "");

  async function handleSave() {
    startTransition(async () => {
      const res = await saveSiteSettings(siteId, {
        storage_provider: provider,
        s3_bucket: s3Bucket,
        s3_region: s3Region,
        s3_endpoint: s3Endpoint,
        s3_access_key: s3AccessKey,
        s3_secret_key: s3SecretKey,
        s3_public_url: s3PublicUrl,
      });

      if (res.success) {
        toast.success(t("saveSuccess"));
        router.refresh();
      } else {
        toast.error(t("saveError"));
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-border">
        <h2 className="text-lg font-bold text-text flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-accent" />
          <span>{t("storage")}</span>
        </h2>
        <p className="text-xs text-text-muted mt-0.5">{t("storageDesc")}</p>
      </div>

      <div className="space-y-5 max-w-2xl">
        <Select
          label={t("storageProvider")}
          value={provider}
          onChange={(val) => setProvider(val)}
          options={[
            { value: "local", label: t("storageLocal") },
            { value: "s3", label: t("storageS3") },
            { value: "r2", label: t("storageR2") },
          ]}
        />

        {provider === "local" ? (
          <div className="p-4 bg-surface-hover/30 border border-border rounded-xl space-y-2 text-xs">
            <div className="flex items-center gap-2 text-emerald-500 font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Almacenamiento Local Activo</span>
            </div>
            <p className="text-text-muted leading-relaxed">
              Los archivos subidos se almacenan en la carpeta local <code className="bg-surface px-1.5 py-0.5 rounded border border-border">/public/uploads/</code> del servidor. Las imágenes se procesan y sirven de forma instantánea.
            </p>
          </div>
        ) : (
          <div className="space-y-4 pt-2 border-t border-border">
            <Input
              label={t("s3Bucket")}
              value={s3Bucket}
              onChange={(e) => setS3Bucket(e.target.value)}
              placeholder="my-kotonoba-bucket"
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label={t("s3Region")}
                value={s3Region}
                onChange={(e) => setS3Region(e.target.value)}
                placeholder="auto o us-east-1"
              />
              <Input
                label={t("s3Endpoint")}
                value={s3Endpoint}
                onChange={(e) => setS3Endpoint(e.target.value)}
                placeholder="https://<account-id>.r2.cloudflarestorage.com"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label={t("s3AccessKey")}
                value={s3AccessKey}
                onChange={(e) => setS3AccessKey(e.target.value)}
                placeholder="AKIA..."
              />
              <Input
                label={t("s3SecretKey")}
                type="password"
                value={s3SecretKey}
                onChange={(e) => setS3SecretKey(e.target.value)}
                placeholder="••••••••••••••••"
              />
            </div>

            <Input
              label={t("s3PublicUrl")}
              value={s3PublicUrl}
              onChange={(e) => setS3PublicUrl(e.target.value)}
              placeholder="https://media.myblog.com"
              helperText="URL pública o CDN asociada al bucket"
            />
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-border flex justify-end">
        <Button
          variant="primary"
          onClick={handleSave}
          loading={isPending}
          icon={<Save className="w-4 h-4" />}
          className="text-xs"
        >
          {tc("save")}
        </Button>
      </div>
    </div>
  );
}
