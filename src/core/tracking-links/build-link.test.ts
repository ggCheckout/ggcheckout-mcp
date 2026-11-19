import { describe, expect, it } from 'vitest';
import { buildLink } from './build-link.js';
import { TEMPLATE_QUERY } from './templates.js';

const dest = 'https://pay.example.com/checkout/abc';

describe('buildLink templates', () => {
  it('meta: the UTMify template verbatim, macros unencoded, in the preview and the ad field', () => {
    const link = buildLink({ destinationUrl: dest, platform: 'meta' });
    expect(link.adParameters).toBe(
      'utm_source=FB&utm_campaign={{campaign.name}}|{{campaign.id}}&utm_medium={{adset.name}}|{{adset.id}}&utm_content={{ad.name}}|{{ad.id}}&utm_term={{placement}}',
    );
    expect(link.finalUrl).toBe(`${dest}?${link.adParameters}`);
    expect(link.trackingTemplate).toBeUndefined();
    expect(link.where[1]).toContain(dest);
  });

  it('tiktok: verbatim', () => {
    expect(buildLink({ destinationUrl: dest, platform: 'tiktok' }).adParameters).toBe(
      'utm_source=tiktok&utm_campaign=__CAMPAIGN_NAME__|__CAMPAIGN_ID__&utm_medium=__AID_NAME__|__AID__&utm_content=__CID_NAME__|__CID__&utm_term=__PLACEMENT__',
    );
  });

  it('kwai: verbatim, with the :: separators', () => {
    expect(buildLink({ destinationUrl: dest, platform: 'kwai' }).adParameters).toBe(
      'utm_source=kwai&utm_campaign=__CMPNID__&utm_medium=__ADSETID__&utm_content=__ADID__::__CALLBACK__::__KS_PIXELID__',
    );
  });

  it('google: an account-level tracking template starting at {lpurl}, no ad parameters, clean final URL preview', () => {
    const link = buildLink({ destinationUrl: dest, platform: 'google' });
    expect(link.trackingTemplate).toBe(
      '{lpurl}?utm_source=google&utm_campaign={campaignid}&utm_medium={adgroupid}&utm_content={creative}&utm_term={placement}::{keyword}&keyword={keyword}&device={device}&network={network}',
    );
    expect(link.adParameters).toBeUndefined();
    expect(link.finalUrl).toBe(`${dest}?${TEMPLATE_QUERY.google}`);
    expect(link.where.join(' ')).toContain('Modelo de acompanhamento');
  });

  it('every template carries the campaign-name warning and the old-campaign note', () => {
    for (const platform of ['meta', 'tiktok', 'google', 'kwai'] as const) {
      const notes = buildLink({ destinationUrl: dest, platform }).notes.join(' ');
      expect(notes).toContain('"|", "#", "&" nem "?"');
      expect(notes).toContain('já foram publicadas');
    }
  });

  it('kwai says it only covers new ad sets', () => {
    expect(buildLink({ destinationUrl: dest, platform: 'kwai' }).notes.join(' ')).toContain('conjuntos de anúncios novos');
  });
});

describe('buildLink manual', () => {
  it('writes the fields in a fixed order and percent-encodes the values', () => {
    const link = buildLink({
      destinationUrl: dest,
      platform: 'manual',
      manual: { utm_campaign: 'Black Friday & cia', utm_source: 'insta', utm_term: 'ação/ç#1', src: ' vip ' },
    });
    expect(link.adParameters).toBe('utm_source=insta&utm_campaign=Black%20Friday%20%26%20cia&utm_term=a%C3%A7%C3%A3o%2F%C3%A7%231&src=vip');
    expect(link.finalUrl).toBe(`${dest}?${link.adParameters}`);
    expect(link.params).toEqual([
      { key: 'utm_source', value: 'insta', source: 'manual' },
      { key: 'utm_campaign', value: 'Black Friday & cia', source: 'manual' },
      { key: 'utm_term', value: 'ação/ç#1', source: 'manual' },
      { key: 'src', value: 'vip', source: 'manual' },
    ]);
  });

  it('ignores blank values and refuses a manual link with none', () => {
    expect(() => buildLink({ destinationUrl: dest, platform: 'manual', manual: { utm_source: '   ' } })).toThrow(/at least one/);
    expect(buildLink({ destinationUrl: dest, platform: 'manual', manual: { utm_source: 'a', utm_medium: '' } }).adParameters)
      .toBe('utm_source=a');
  });
});

describe('buildLink merge', () => {
  it('keeps the destination query and never duplicates a key: manual replaces it', () => {
    const link = buildLink({
      destinationUrl: 'https://example.com/p?ref=amigo&utm_source=old#oferta',
      platform: 'manual',
      manual: { utm_source: 'new', utm_medium: 'bio' },
    });
    expect(link.finalUrl).toBe('https://example.com/p?ref=amigo&utm_source=new&utm_medium=bio#oferta');
    expect(link.params.filter((p) => p.key === 'utm_source')).toHaveLength(1);
    expect(link.notes.join(' ')).toContain('substituíram');
    // The clean URL to paste elsewhere no longer carries the replaced key.
    expect(link.finalUrl.match(/utm_source/g)).toHaveLength(1);
  });

  it('a template drops the keys the destination already has, in the ad field too', () => {
    const link = buildLink({ destinationUrl: 'https://example.com/p?utm_source=newsletter', platform: 'meta' });
    expect(link.adParameters).not.toContain('utm_source');
    expect(link.finalUrl.match(/utm_source=/g)).toHaveLength(1);
    expect(link.finalUrl).toContain('utm_source=newsletter');
    expect(link.notes.join(' ')).toContain('utm_source');
  });

  it('a manual value overrides the template value in place and is encoded', () => {
    const link = buildLink({ destinationUrl: dest, platform: 'meta', manual: { utm_source: 'Face Book' } });
    expect(link.adParameters!.startsWith('utm_source=Face%20Book&utm_campaign={{campaign.name}}')).toBe(true);
    expect(link.params[0]).toEqual({ key: 'utm_source', value: 'Face Book', source: 'manual' });
  });

  it('adds src and sck to a template without touching its macros', () => {
    const link = buildLink({ destinationUrl: dest, platform: 'tiktok', manual: { sck: 'tt1' } });
    expect(link.adParameters!.endsWith('utm_term=__PLACEMENT__&sck=tt1')).toBe(true);
  });

  it('keeps the existing query of a google destination in the preview', () => {
    const link = buildLink({ destinationUrl: 'https://example.com/p?ref=1', platform: 'google' });
    expect(link.finalUrl.startsWith('https://example.com/p?ref=1&utm_source=google')).toBe(true);
  });

  it('rejects a destination that is not a URL', () => {
    expect(() => buildLink({ destinationUrl: 'not a url', platform: 'meta' })).toThrow(/not a valid URL/);
  });
});
