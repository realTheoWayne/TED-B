import { blink } from './blink';

export interface DomainStats {
  totalDomains: number;
  new24h: number;
  renewals24h: number;
  activeUsers: number;
  // Deltas computed from real data
  totalDomainsChange: number | null;
  new24hChange: number | null;
  renewalsChange: number | null;
  activeUsersChange: number | null;
}

export interface ActivityItem {
  id: string;
  type: 'buy' | 'renew' | 'transfer';
  domain: string;
  address: string;
  timestamp: string;
  amount?: number;
}

export interface ChartData {
  date: string;
  count: number;
  volume?: number;
}

export interface ExtensionData {
  name: string;
  value: number;
  color: string;
}

const TZKT_API = 'https://api.tzkt.io/v1';
const BUY_CONTRACT = 'KT191reDVKrLxU9rjTSxg53wRqj6zh8pnHgr';
const RENEW_CONTRACT = 'KT1EVYBj3f1rZHNeUtq4ZvVxPTs77wuHwARU';
const NAME_REGISTRY = 'KT1GBZm7uJvYvHvKZGJ61eA8XF6pAByN8Mv8';

function hexToUtf8(hex: string): string {
  try {
    const bytes = hex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || [];
    return new TextDecoder().decode(new Uint8Array(bytes));
  } catch {
    return hex;
  }
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function fetchCount(url: string): Promise<number> {
  try {
    const res = await fetch(url);
    if (!res.ok) return 0;
    const text = await res.text();
    return text ? parseInt(text, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

function isoAgo(hours: number): string {
  const d = new Date(Date.now() - hours * 3600000);
  return d.toISOString();
}

export const tezosService = {
  async getStats(): Promise<DomainStats> {
    const now24 = isoAgo(24);
    const now48 = isoAgo(48);

    // All counts fetched in parallel
    const [
      totalBuys,
      buysLast24h,
      buysPrev24h,
      renewsLast24h,
      renewsPrev24h,
      uniqueSenders,
    ] = await Promise.all([
      // Total domain registrations (all time)
      fetchCount(
        `${TZKT_API}/operations/transactions/count?target=${BUY_CONTRACT}&entrypoint=buy&status=applied`
      ),
      // New registrations last 24h
      fetchCount(
        `${TZKT_API}/operations/transactions/count?target=${BUY_CONTRACT}&entrypoint=buy&status=applied&timestamp.ge=${now24}`
      ),
      // Registrations 24-48h ago (for delta)
      fetchCount(
        `${TZKT_API}/operations/transactions/count?target=${BUY_CONTRACT}&entrypoint=buy&status=applied&timestamp.ge=${now48}&timestamp.lt=${now24}`
      ),
      // Renewals last 24h
      fetchCount(
        `${TZKT_API}/operations/transactions/count?target=${RENEW_CONTRACT}&entrypoint=renew&status=applied&timestamp.ge=${now24}`
      ),
      // Renewals 24-48h ago
      fetchCount(
        `${TZKT_API}/operations/transactions/count?target=${RENEW_CONTRACT}&entrypoint=renew&status=applied&timestamp.ge=${now48}&timestamp.lt=${now24}`
      ),
      // Unique domain holders from name registry bigmap keys count
      fetchCount(
        `${TZKT_API}/bigmaps/4626/keys/count?active=true`
      ),
    ]);

    // Compute percentage changes
    const pct = (curr: number, prev: number): number | null => {
      if (prev === 0) return curr > 0 ? 100 : null;
      return Math.round(((curr - prev) / prev) * 1000) / 10;
    };

    return {
      totalDomains: totalBuys,
      new24h: buysLast24h,
      renewals24h: renewsLast24h,
      activeUsers: uniqueSenders || 0,
      totalDomainsChange: null, // all-time stat; no delta
      new24hChange: pct(buysLast24h, buysPrev24h),
      renewalsChange: pct(renewsLast24h, renewsPrev24h),
      activeUsersChange: null,
    };
  },

  async getRecentActivity(): Promise<ActivityItem[]> {
    // Fetch recent buys and renewals in parallel
    const [buys, renews] = await Promise.all([
      fetchJson<any[]>(
        `${TZKT_API}/operations/transactions?target=${BUY_CONTRACT}&entrypoint=buy&status=applied&limit=15&sort.desc=id`
      ),
      fetchJson<any[]>(
        `${TZKT_API}/operations/transactions?target=${RENEW_CONTRACT}&entrypoint=renew&status=applied&limit=10&sort.desc=id`
      ),
    ]);

    const items: ActivityItem[] = [];

    if (Array.isArray(buys)) {
      for (const op of buys) {
        const label = op.parameter?.value?.label;
        items.push({
          id: `buy-${op.id}`,
          type: 'buy',
          domain: label ? `${hexToUtf8(label)}.tez` : 'unknown.tez',
          address: op.sender?.address || 'unknown',
          timestamp: op.timestamp,
          amount: (op.amount || 0) / 1_000_000,
        });
      }
    }

    if (Array.isArray(renews)) {
      for (const op of renews) {
        const label = op.parameter?.value?.label ?? op.parameter?.value;
        const name = typeof label === 'string' && /^[0-9a-f]+$/i.test(label)
          ? hexToUtf8(label)
          : (label || 'unknown');
        items.push({
          id: `renew-${op.id}`,
          type: 'renew',
          domain: `${name}.tez`,
          address: op.sender?.address || 'unknown',
          timestamp: op.timestamp,
          amount: (op.amount || 0) / 1_000_000,
        });
      }
    }

    // Sort by timestamp descending, take latest 15
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return items.slice(0, 15);
  },

  async getGrowthData(): Promise<ChartData[]> {
    // Fetch daily registration counts for the last 30 days using TzKT timestamp grouping
    const thirtyDaysAgo = isoAgo(30 * 24);

    const ops = await fetchJson<any[]>(
      `${TZKT_API}/operations/transactions?target=${BUY_CONTRACT}&entrypoint=buy&status=applied&timestamp.ge=${thirtyDaysAgo}&limit=10000&select=timestamp,amount`
    );

    if (!Array.isArray(ops) || ops.length === 0) return [];

    // Bucket by date
    const buckets: Record<string, { count: number; volume: number }> = {};
    const now = new Date();
    // Pre-fill all 30 days so there are no gaps
    for (let i = 30; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      buckets[key] = { count: 0, volume: 0 };
    }

    for (const op of ops) {
      const day = op.timestamp?.slice(0, 10);
      if (day && buckets[day] !== undefined) {
        buckets[day].count += 1;
        buckets[day].volume += (op.amount || 0) / 1_000_000;
      }
    }

    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count: data.count,
        volume: Math.round(data.volume * 100) / 100,
      }));
  },

  async getTopHolders(): Promise<{ address: string; count: number }[]> {
    // Fetch top senders of buy operations with the most distinct transactions
    const ops = await fetchJson<any[]>(
      `${TZKT_API}/operations/transactions?target=${BUY_CONTRACT}&entrypoint=buy&status=applied&limit=10000&select=sender&sort.desc=id`
    );

    if (!Array.isArray(ops) || ops.length === 0) return [];

    const counts: Record<string, number> = {};
    for (const op of ops) {
      const addr = op.sender?.address || op.sender;
      if (addr && typeof addr === 'string') {
        counts[addr] = (counts[addr] || 0) + 1;
      }
    }

    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([address, count]) => ({ address, count }));
  },

  async getExtensionDistribution(): Promise<ExtensionData[]> {
    // Tezos Domains currently only supports .tez; future extensions are not yet live
    // We show the real single-extension scenario
    return [
      { name: '.tez', value: 100, color: 'hsl(var(--primary))' },
    ];
  },

  async getAffiliateStats(): Promise<{ code: string; visits: number; clicks: number; conversions: number }[]> {
    try {
      // For a production app, we would use a SQL aggregate or separate counters.
      // Since blink.db.sql() is restricted to server-side, and client side list() is limited,
      // we'll fetch the recent events and aggregate them manually.
      // In a real high-volume app, we'd use a summary table or Edge Function.
      const events = await blink.db.affiliateEvents.list({
        limit: 1000,
        orderBy: { timestamp: 'desc' }
      });

      if (!events || events.length === 0) return [];

      const stats: Record<string, { visits: number; clicks: number; conversions: number }> = {};

      for (const event of events) {
        const code = event.affiliateCode;
        if (!stats[code]) {
          stats[code] = { visits: 0, clicks: 0, conversions: 0 };
        }

        if (event.eventType === 'visit') stats[code].visits++;
        else if (event.eventType === 'click') stats[code].clicks++;
        else if (event.eventType === 'conversion') stats[code].conversions++;
      }

      return Object.entries(stats)
        .sort(([, a], [, b]) => b.visits - a.visits)
        .map(([code, data]) => ({ code, ...data }));
    } catch (err) {
      console.error('Failed to fetch affiliate stats:', err);
      return [];
    }
  },
};
