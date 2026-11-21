export interface StorageConfig {
  provider: "local" | "s3" | "r2";
  bucket?: string;
  region?: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  publicUrl?: string;
  uploadDir: string;
}

export interface MediaFileItem {
  filename: string;
  path: string;
  url: string;
  size: number;
  updatedAt: Date;
  folder: string;
}

export interface MediaFolderItem {
  name: string;
  path: string;
}

export interface UploadResult {
  url: string;
  filename: string;
  path: string;
  size: number;
  mimeType: string;
}

export interface MediaListingResult {
  currentFolder: string;
  parentFolder: string | null;
  folders: MediaFolderItem[];
  files: MediaFileItem[];
  nextCursor?: string | null;
}

export type StoredMediaReadResult =
  | {
      status: "ok";
      body: ReadableStream<Uint8Array> | Buffer;
      contentType: string;
      contentLength?: number;
      etag?: string;
    }
  | {
      status: "not-modified";
      etag?: string;
    }
  | {
      status: "not-found";
    };

export interface OrphanCleanupResult {
  deletedCount: number;
  freedBytes: number;
  deletedPaths: string[];
}
