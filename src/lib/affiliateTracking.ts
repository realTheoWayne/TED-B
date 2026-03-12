import { blink } from './blink';

/** Affiliate link parameter keys we parse from the URL */
const AFFILIATE_PARAMS = ['ref', 'aff', 'affiliate', 'partner'] as const;

/** Stored affiliate info */
export interface AffiliateInfo {
  code: string;
  source: string;
  landingPage: string;
  timestamp: string;
}

const STORAGE_KEY = 'td_affiliate';

const AFFILIATE_ANALYTICS_URL = 'https://wgjv5o39--affiliate-analytics.functions.blink.new';

/** Capture affiliate code from URL on first visit */
export function captureAffiliateFromUrl(): AffiliateInfo | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);

  for (const key of AFFILIATE_PARAMS) {
    const code = params.get(key);
    if (code) {
      const info: AffiliateInfo = {
        code,
        source: key,
        landingPage: window.location.pathname,
        timestamp: new Date().toISOString(),
      };

      // Persist in localStorage so it survives page reloads
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(info));
      } catch {
        // storage unavailable
      }

      // Log the affiliate visit event via Blink analytics
      blink.analytics.log('affiliate_visit', {
        affiliate_code: code,
        source_param: key,
        landing_page: window.location.pathname,
        referrer: document.referrer || 'direct',
        full_url: window.location.href,
      });

      // Log to our custom tracker via Edge Function (publicly accessible)
      fetch(`${AFFILIATE_ANALYTICS_URL}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          affiliateCode: code,
          eventType: 'visit'
        })
      }).catch(err => console.error('Failed to log affiliate visit to Edge Function:', err));

      return info;
    }
  }

  return null;
}

/** Get previously captured affiliate info */
export function getStoredAffiliate(): AffiliateInfo | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AffiliateInfo) : null;
  } catch {
    return null;
  }
}

/**
 * Track an affiliate link click — call this when the user
 * clicks an outbound affiliate/partner link.
 */
export function trackAffiliateLinkClick(
  linkUrl: string,
  linkLabel: string,
  metadata?: Record<string, string | number | boolean>
) {
  const affiliate = getStoredAffiliate();

  blink.analytics.log('affiliate_link_click', {
    link_url: linkUrl,
    link_label: linkLabel,
    affiliate_code: affiliate?.code ?? 'none',
    ...metadata,
  });

  if (affiliate?.code) {
    fetch(`${AFFILIATE_ANALYTICS_URL}/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        affiliateCode: affiliate.code,
        eventType: 'click',
        targetUrl: linkUrl,
        label: linkLabel
      })
    }).catch(err => console.error('Failed to log affiliate click to Edge Function:', err));
  }
}

/**
 * Track a conversion event tied to an affiliate
 * (e.g. user signed up, completed an action, etc.)
 */
export function trackAffiliateConversion(
  conversionType: string,
  metadata?: Record<string, string | number | boolean>
) {
  const affiliate = getStoredAffiliate();
  if (!affiliate) return;

  blink.analytics.log('affiliate_conversion', {
    conversion_type: conversionType,
    affiliate_code: affiliate.code,
    source_param: affiliate.source,
    time_since_visit_ms: Date.now() - new Date(affiliate.timestamp).getTime(),
    ...metadata,
  });

  // Log to our custom tracker via Edge Function (publicly accessible)
  fetch(`${AFFILIATE_ANALYTICS_URL}/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      affiliateCode: affiliate.code,
      eventType: 'conversion',
      conversionType: conversionType
    })
  }).catch(err => console.error('Failed to log affiliate conversion to Edge Function:', err));
}

/** Clear affiliate data (e.g., after conversion or expiry) */
export function clearAffiliateData() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // noop
  }
}
