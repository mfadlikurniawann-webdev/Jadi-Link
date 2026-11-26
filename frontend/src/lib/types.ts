export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: User;
}

export interface ShortLink {
  id: string;
  code: string;
  shortUrl: string;
  targetUrl: string;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export interface LinkList {
  items: ShortLink[];
  page: number;
  limit: number;
  hasNextPage: boolean;
}

export interface CreateLink {
  targetUrl: string;
  alias?: string;
  expiresAt?: string;
}

export interface UpdateLink {
  targetUrl?: string;
  expiresAt?: string | null;
  isActive?: boolean;
}

export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown';

export interface Analytics {
  linkId: string;
  period: { timezone: 'UTC'; days: 30; from: string; to: string };
  totalClicks: number;
  clicksLast30Days: number;
  uniqueVisitorsLast30Days: number;
  dailyClicks: { date: string; clicks: number }[];
  topReferrers: { referrer: string | null; clicks: number }[];
  countries: { country: string | null; clicks: number }[];
  devices: { device: DeviceType; clicks: number }[];
}
