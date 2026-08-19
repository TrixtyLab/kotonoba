"use client";

import React, { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { saveSiteSettings } from "@/actions/settings";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { HardDrive, Save, Cloud, CheckCircle2, Info } from "lucide-react";
import { useRouter } from "@/i18n/routing";

/**
 * Storage configuration state detected from environment variables (.env).
 */
export interface EnvStorageInfo {
  /** Flag denoting if all required Cloudflare R2 environment variables are defined. */
  isR2Configured: boolean;
  /** Flag denoting if S3/R2 credentials are present in environment variables. */
  isS3Configured: boolean;
  /** Name of the Cloudflare R2 bucket from environment variables. */
  r2Bucket?: string;
  /** Masked Account ID string for Cloudflare R2. */
  r2AccountId?: string;
  /** Public CDN or base URL for Cloudflare R2 from environment variables. */
  r2PublicUrl?: string;
  /** S3 bucket name from environment variables. */
  s3Bucket?: string;
  /** AWS S3 region from environment variables. */
  s3Region?: string;
}

/**
 * Configuration properties for the StorageSettingsClient component.
 */
export interface StorageSettingsClientProps {
  /** Target site ID. */
  siteId: string;
  /** Key-value dictionary of existing site settings. */
  initialSettings: Record<string, string>;
  /** Optional environment variable storage status flags. */
  envStorageInfo?: EnvStorageInfo;
}

/**
 * Administrative storage settings interface allowing administrators to switch between local file storage and S3/Cloudflare R2 cloud buckets.
 *
 * @param props - StorageSettingsClientProps configuring site ID and current storage provider settings.
 * @returns React JSX storage settings view.
 */
export function StorageSettingsClient({ siteId, initialSettings, envStorageInfo }: StorageSettingsClientProps) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const toast = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [provider, setProvider] = useState(
    initialSettings.storage_provider || (envStorageInfo?.isR2Configured ? "r2" : "local")
  );
  const [s3Bucket, setS3Bucket] = useState(initialSettings.s3_bucket || "");
  const [s3Region, setS3Region] = useState(initialSettings.s3_region || "auto");
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

  const isR2EnvActive = Boolean(envStorageInfo?.isR2Configured);
  const isS3EnvActive = Boolean(envStorageInfo?.isS3Configured);

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
        {/* Environment Variable Status Banner */}
        {isR2EnvActive && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{t("envR2Detected")}</span>
              </div>
              <span className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded text-[10px] tracking-wide uppercase">
                {t("envActive")}
              </span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              {t("envR2DetectedDesc")}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[11px] text-text-muted">
              {envStorageInfo?.r2Bucket && (
                <div>
                  <span className="font-semibold text-text">Bucket:</span> {envStorageInfo.r2Bucket}
                </div>
              )}
              {envStorageInfo?.r2AccountId && (
                <div>
                  <span className="font-semibold text-text">Account:</span> {envStorageInfo.r2AccountId}
                </div>
              )}
              {envStorageInfo?.r2PublicUrl && (
                <div className="sm:col-span-2">
                  <span className="font-semibold text-text">Public URL:</span> {envStorageInfo.r2PublicUrl}
                </div>
              )}
            </div>
          </div>
        )}

        {!isR2EnvActive && isS3EnvActive && (
          <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{t("envS3Detected")}</span>
              </div>
              <span className="bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-bold px-2 py-0.5 rounded text-[10px] tracking-wide uppercase">
                {t("envActive")}
              </span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              {t("envS3DetectedDesc")}
            </p>
          </div>
        )}

        <Select
          label={t("storageProvider")}
          value={provider}
          onChange={(val) => setProvider(val)}
          options={[
            { value: "local", label: t("storageLocal") },
            { value: "s3", label: t("storageS3") },
            {
              value: "r2",
              label: isR2EnvActive ? `${t("storageR2")} (${t("envActive")})` : t("storageR2"),
            },
          ]}
        />

        {provider === "local" ? (
          <div className="p-4 bg-surface-hover/30 border border-border rounded-xl space-y-2 text-xs">
            <div className="flex items-center gap-2 text-emerald-500 font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>{t("localStorageActive")}</span>
            </div>
            <p className="text-text-muted leading-relaxed">
              {t("localStorageDesc")}
            </p>
          </div>
        ) : (
          <div className="space-y-4 pt-2 border-t border-border">
            {(isR2EnvActive || isS3EnvActive) && (
              <div className="flex items-start gap-2 p-3 bg-surface-hover/40 border border-border rounded-lg text-xs text-text-muted">
                <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <span>{t("fallbackEnvNotice")}</span>
              </div>
            )}

            <Input
              label={t("s3Bucket")}
              value={s3Bucket}
              onChange={(e) => setS3Bucket(e.target.value)}
              placeholder={
                provider === "r2"
                  ? envStorageInfo?.r2Bucket || "my-r2-bucket"
                  : envStorageInfo?.s3Bucket || "my-s3-bucket"
              }
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label={t("s3Region")}
                value={s3Region}
                onChange={(e) => setS3Region(e.target.value)}
                placeholder={
                  provider === "r2" ? "auto" : envStorageInfo?.s3Region || "us-east-1"
                }
              />
              <Input
                label={t("s3Endpoint")}
                value={s3Endpoint}
                onChange={(e) => setS3Endpoint(e.target.value)}
                placeholder={
                  provider === "r2"
                    ? "https://<account-id>.r2.cloudflarestorage.com"
                    : "https://s3.amazonaws.com"
                }
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label={t("s3AccessKey")}
                value={s3AccessKey}
                onChange={(e) => setS3AccessKey(e.target.value)}
                placeholder={
                  isR2EnvActive || isS3EnvActive
                    ? `(${t("inheritedFromEnv")})`
                    : "AKIA..."
                }
              />
              <Input
                label={t("s3SecretKey")}
                type="password"
                value={s3SecretKey}
                onChange={(e) => setS3SecretKey(e.target.value)}
                placeholder={
                  isR2EnvActive || isS3EnvActive
                    ? `•••••••••••••••• (${t("inheritedFromEnv")})`
                    : "••••••••••••••••"
                }
              />
            </div>

            <Input
              label={t("s3PublicUrl")}
              value={s3PublicUrl}
              onChange={(e) => setS3PublicUrl(e.target.value)}
              placeholder={
                envStorageInfo?.r2PublicUrl || "https://media.myblog.com"
              }
              helperText={t("s3PublicUrlHelper")}
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
