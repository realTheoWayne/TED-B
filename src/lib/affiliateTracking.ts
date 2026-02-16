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
}

/** Clear affiliate data (e.g., after conversion or expiry) */
export function clearAffiliateData() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // noop
  }
}
