import { describe, it, expect } from 'vitest';
import { videosSectionSchema, upsellFields } from './offer-schemas.js';

const section = (video: Record<string, unknown>) => ({ enabled: true, videos: [video] });

describe('videosSectionSchema', () => {
  it('accepts an embed with provider and providerId', () => {
    expect(videosSectionSchema.safeParse(section({ sourceType: 'embed', provider: 'youtube', providerId: 'x' })).success).toBe(true);
  });

  it('accepts a url or upload video with a url', () => {
    expect(videosSectionSchema.safeParse(section({ sourceType: 'upload', url: 'https://v/a.mp4' })).success).toBe(true);
    expect(videosSectionSchema.safeParse(section({ url: 'https://v/a.mp4' })).success).toBe(true);
  });

  it('refuses an embed without providerId, and a url video without url', () => {
    expect(videosSectionSchema.safeParse(section({ sourceType: 'embed', provider: 'vimeo' })).success).toBe(false);
    expect(videosSectionSchema.safeParse(section({ sourceType: 'url' })).success).toBe(false);
  });

  it('refuses more than 4 videos', () => {
    const videos = Array.from({ length: 5 }, () => ({ url: 'https://v/a.mp4' }));
    expect(videosSectionSchema.safeParse({ enabled: true, videos }).success).toBe(false);
  });
});

describe('upsellFields', () => {
  it('takes the price in whole cents above zero', () => {
    expect(upsellFields.price.safeParse(1990).success).toBe(true);
    expect(upsellFields.price.safeParse(19.9).success).toBe(false);
    expect(upsellFields.price.safeParse(0).success).toBe(false);
  });
});
