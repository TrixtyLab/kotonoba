export interface DubCreateLinkOptions {
  url: string;
  slug?: string;
  domain?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  tags?: string[];
  comments?: string;
}

export interface DubLinkResult {
  id: string;
  key: string;
  shortUrl: string;
  qrCodeUrl: string;
}

export interface DubLinkItem {
  id: string;
  domain: string;
  key: string;
  url: string;
  shortLink: string;
  clicks: number;
  leads: number;
  sales: number;
  qrCode?: string;
  createdAt: string;
  lastClicked?: string | null;
}

export interface GetDubLinksOptions {
  customDomain?: string;
  siteId?: string;
  tag?: string;
}

export interface DubAnalyticsSummary {
  isConfigured: boolean;
  domain: string;
  totalClicks: number;
  totalLinks: number;
  links: DubLinkItem[];
  topLink: DubLinkItem | null;
}

export interface DubApiTagEntry {
  name?: string;
  slug?: string;
}

export interface DubApiLinkItem {
  id?: string;
  domain?: string;
  key?: string;
  url?: string;
  shortLink?: string;
  comments?: string | null;
  tags?: Array<string | DubApiTagEntry>;
  clicks?: number;
  leads?: number;
  sales?: number;
  qrCode?: string;
  createdAt?: string;
  lastClicked?: string | null;
}
