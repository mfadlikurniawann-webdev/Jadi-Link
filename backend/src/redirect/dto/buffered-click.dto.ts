export interface BufferedClickDto {
  id: string;
  linkId: string;
  clickedAt: Date;
  referrer: string | null;
  country: string | null;
  device: 'mobile' | 'tablet' | 'desktop' | 'bot' | 'unknown';
  visitorHash: string | null;
}
