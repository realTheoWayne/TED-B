export interface DomainStats {
  totalDomains: number;
  new24h: number;
  renewals24h: number;
  uniqueOwners: number | null;
  totalDomainsChange: number | null;
  new24hChange: number | null;
  renewalsChange: number | null;
  uniqueOwnersChange: number | null;
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

export interface TezPageSite {
  name: string;
  content: string;
  owner: string;
  link: string;
  timestamp?: string;
}

export interface AffiliatePartner {
  address: string;
  buys: number;
  renewals: number;
  totalOps: number;
  volumeXtz: number;
  uniqueDomains: number;
  lastActive: string;
}

export interface AffiliateOp {
  id: string;
  type: 'buy' | 'renew';
  domain: string;
  affiliate: string;
  sender: string;
  amount: number;
  timestamp: string;
}

interface DomainRecord {
  name: string;
  owner: string;
  data: Array<{ key: string; value: unknown; rawValue: string }>;
}

interface DomainSnapshot {
  totalCount: number;
  domains: DomainRecord[];
  owners: Record<string, number>;
}

const TZKT_API = 'https://api.tzkt.io/v1';
const TEZOS_DOMAINS_API = 'https://api.tezos.domains/graphql';
const BUY_CONTRACT = 'KT191reDVKrLxU9rjTSxg53wRqj6zh8pnHgr';
const RENEW_CONTRACT = 'KT1EVYBj3f1rZHNeUtq4ZvVxPTs77wuHwARU';
const AFFILIATE_CONTRACT = 'KT1Hg3ymQBL5nfAbb1JZ8G8AGPZ4cpcko2H2';

function hexToUtf8(hex: string): string {
  try {
    const bytes = hex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || [];
    return new TextDecoder().decode(new Uint8Array(bytes));
  } catch {
    return hex;
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) throw new Error(`Live data request failed (${res.status})`);
  if (!text) throw new Error('Live data request returned an empty response');
  return JSON.parse(text) as T;
}

/**
 * TzKT rate-limits bursts from a browser, and the dashboard used to fire the
 * same buy/renew queries from several widgets at once. Serialize requests,
 * reuse in-flight work, and back off on 429s so a refresh does not turn into a
 * cascade of failed requests.
 */
let tzktQueue: Promise<unknown> = Promise.resolve();
let lastTzktRequestAt = 0;
const TZKT_MIN_INTERVAL = 750;
const tzktCache = new Map<string, { expiresAt: number; value: unknown }>();
const tzktRequests = new Map<string, Promise<unknown>>();

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchTzktJson<T>(url: string, cacheMs = 60_000): Promise<T> {
  const cached = tzktCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.value as T;

  const inFlight = tzktRequests.get(url);
  if (inFlight) return inFlight as Promise<T>;

  const run = async (): Promise<T> => {
    let attempt = 0;
    while (attempt < 3) {
      const elapsed = Date.now() - lastTzktRequestAt;
      if (elapsed < TZKT_MIN_INTERVAL) await wait(TZKT_MIN_INTERVAL - elapsed);
      lastTzktRequestAt = Date.now();

      const response = await fetch(url);
      const text = await response.text();
      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get('retry-after'));
        const backoff = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 2500 * (attempt + 1);
        attempt += 1;
        await wait(Math.min(backoff, 15_000));
        continue;
      }
      if (!response.ok) throw new Error(`Live data request failed (${response.status})`);
      if (!text) throw new Error('Live data request returned an empty response');

      const value = JSON.parse(text) as T;
      tzktCache.set(url, { expiresAt: Date.now() + cacheMs, value });
      return value;
    }
    throw new Error('Live data request failed (429) after retries');
  };

  const request = tzktQueue.then(run, run);
  tzktQueue = request.then(() => undefined, () => undefined);
  tzktRequests.set(url, request);
  try {
    return await request;
  } finally {
    tzktRequests.delete(url);
  }
}

async function fetchTzktTransactions(query: string, pageSize = 1000): Promise<any[]> {
  const operations: any[] = [];
  let offset = 0;

  while (true) {
    const separator = query.includes('?') ? '&' : '?';
    const page = await fetchTzktJson<any[]>(`${query}${separator}limit=${pageSize}&offset=${offset}`, 300_000);
    operations.push(...page);
    if (page.length < pageSize) return operations;
    offset += page.length;
  }
}

async function fetchRecentTzktTransactions(query: string, limit: number, cacheMs = 60_000): Promise<any[]> {
  const separator = query.includes('?') ? '&' : '?';
  const page = await fetchTzktJson<any[]>(`${query}${separator}limit=${Math.min(limit, 1000)}`, cacheMs);
  return Array.isArray(page) ? page : [];
}

let recentDomainOperationsCache: { loadedAt: number; value: { buys: any[]; renews: any[] } } | null = null;
let recentDomainOperationsRequest: Promise<{ buys: any[]; renews: any[] }> | null = null;

async function fetchRecentDomainOperations(): Promise<{ buys: any[]; renews: any[] }> {
  if (recentDomainOperationsCache && Date.now() - recentDomainOperationsCache.loadedAt < 60_000) {
    return recentDomainOperationsCache.value;
  }
  if (recentDomainOperationsRequest) return recentDomainOperationsRequest;

  recentDomainOperationsRequest = (async () => {
    const since = isoAgo(48);
    const buys = await fetchRecentTzktTransactions(
      `${TZKT_API}/operations/transactions?target=${BUY_CONTRACT}&entrypoint=buy&status=applied&timestamp.ge=${since}&sort.desc=id`,
      1000,
    );
    const renews = await fetchRecentTzktTransactions(
      `${TZKT_API}/operations/transactions?target=${RENEW_CONTRACT}&entrypoint=renew&status=applied&timestamp.ge=${since}&sort.desc=id`,
      1000,
    );
    const value = { buys, renews };
    recentDomainOperationsCache = { loadedAt: Date.now(), value };
    return value;
  })();

  try {
    return await recentDomainOperationsRequest;
  } finally {
    recentDomainOperationsRequest = null;
  }
}

let domainSnapshotCache: { loadedAt: number; value: DomainSnapshot } | null = null;
let domainSnapshotRequest: Promise<DomainSnapshot> | null = null;

async function fetchDomainSnapshot(): Promise<DomainSnapshot> {
  if (domainSnapshotCache && Date.now() - domainSnapshotCache.loadedAt < 300_000) {
    return domainSnapshotCache.value;
  }
  if (domainSnapshotRequest) return domainSnapshotRequest;

  domainSnapshotRequest = (async () => {
    const query = `query {
      domains(first: 50, order: { field: LEVEL, direction: DESC }) {
        totalCount
        items { name owner data { key value rawValue } }
        pageInfo { hasNextPage endCursor }
      }
    }`;
    const response = await fetchJson<{ data?: { domains?: { totalCount: number; items: DomainRecord[] } }; errors?: Array<{ message?: string }> }>(TEZOS_DOMAINS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (response.errors?.length || !response.data?.domains) {
      throw new Error(response.errors?.[0]?.message || 'Tezos Domains returned no domain data');
    }

    const domains = response.data.domains.items;
    const owners: Record<string, number> = {};
    for (const domain of domains) {
      if (domain.owner) owners[domain.owner] = (owners[domain.owner] || 0) + 1;
    }

    const value = { totalCount: response.data.domains.totalCount, domains, owners };
    domainSnapshotCache = { loadedAt: Date.now(), value };
    return value;
  })();

  try {
    return await domainSnapshotRequest;
  } finally {
    domainSnapshotRequest = null;
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
    const [snapshot, recentOperations] = await Promise.all([
      fetchDomainSnapshot(),
      fetchRecentDomainOperations(),
    ]);
    const { buys, renews } = recentOperations;

    const countInWindow = (operations: any[], from: string, to?: string) => operations.filter(op => op.timestamp >= from && (!to || op.timestamp < to)).length;
    const buysLast24h = countInWindow(buys, now24);
    const buysPrev24h = countInWindow(buys, now48, now24);
    const renewsLast24h = countInWindow(renews, now24);
    const renewsPrev24h = countInWindow(renews, now48, now24);
    const pct = (curr: number, prev: number): number | null => {
      if (prev === 0) return curr > 0 ? 100 : null;
      return Math.round(((curr - prev) / prev) * 1000) / 10;
    };

    return {
      totalDomains: snapshot.totalCount,
      new24h: buysLast24h,
      renewals24h: renewsLast24h,
      uniqueOwners: null,
      totalDomainsChange: null,
      new24hChange: pct(buysLast24h, buysPrev24h),
      renewalsChange: pct(renewsLast24h, renewsPrev24h),
      uniqueOwnersChange: null,
    };
  },

  async getRecentActivity(): Promise<ActivityItem[]> {
    const { buys, renews } = await fetchRecentDomainOperations();
    const items: ActivityItem[] = [];

    for (const op of buys) {
      const label = op.parameter?.value?.label;
      items.push({
        id: `buy-${op.id}`,
        type: 'buy',
        domain: label ? `${hexToUtf8(label)}.tez` : 'unknown.tez',
        address: op.parameter?.value?.owner || op.sender?.address || 'unknown',
        timestamp: op.timestamp,
        amount: (op.amount || 0) / 1_000_000,
      });
    }
    for (const op of renews) {
      const label = op.parameter?.value?.label;
      const name = typeof label === 'string' && /^[0-9a-f]+$/i.test(label) ? hexToUtf8(label) : (label || 'unknown');
      items.push({
        id: `renew-${op.id}`,
        type: 'renew',
        domain: `${name}.tez`,
        address: op.sender?.address || 'unknown',
        timestamp: op.timestamp,
        amount: (op.amount || 0) / 1_000_000,
      });
    }
    return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 15);
  },

  async getGrowthData(): Promise<ChartData[]> {
    const thirtyDaysAgo = isoAgo(30 * 24);
    const ops = await fetchTzktTransactions(`${TZKT_API}/operations/transactions?target=${BUY_CONTRACT}&entrypoint=buy&status=applied&timestamp.ge=${thirtyDaysAgo}&select=timestamp,amount`, 1000);
    const buckets: Record<string, { count: number; volume: number }> = {};
    const now = new Date();
    for (let i = 30; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      buckets[d.toISOString().slice(0, 10)] = { count: 0, volume: 0 };
    }
    for (const op of ops) {
      const day = op.timestamp?.slice(0, 10);
      if (day && buckets[day]) {
        buckets[day].count += 1;
        buckets[day].volume += (op.amount || 0) / 1_000_000;
      }
    }
    return Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b)).map(([date, data]) => ({
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      count: data.count,
      volume: Math.round(data.volume * 100) / 100,
    }));
  },

  async getTopHolders(): Promise<{ address: string; count: number }[]> {
    const snapshot = await fetchDomainSnapshot();
    return Object.entries(snapshot.owners)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([address, count]) => ({ address, count }));
  },

  async getExtensionDistribution(): Promise<ExtensionData[]> {
    return [{ name: '.tez', value: 100, color: 'hsl(var(--primary))' }];
  },

  async getTezPageSites(): Promise<TezPageSite[]> {
    const snapshot = await fetchDomainSnapshot();
    return snapshot.domains
      .filter(domain => domain.data.some(item => /content|site|page|ipfs|ipns/i.test(item.key)))
      .slice(0, 50)
      .map(domain => {
        const content = domain.data.find(item => /content|site|page|ipfs|ipns/i.test(item.key));
        return {
          name: domain.name,
          content: typeof content?.value === 'string' ? content.value : content?.rawValue || 'On-chain content record',
          owner: domain.owner,
          link: `https://${domain.name}.page`,
        };
      });
  },

  async getDecentralizedWebStats(): Promise<{ totalSites: number; newSites24h: number | null }> {
    const snapshot = await fetchDomainSnapshot();
    const domainsWithRecords = snapshot.domains.filter(domain => domain.data.length > 0);
    return {
      totalSites: domainsWithRecords.length,
      newSites24h: null,
    };
  },

  /**
   * Fetch real on-chain affiliate data from the Tezos Domains
   * AffiliateBuyRenew contract (KT1Hg3ymQBL5nfAbb1JZ8G8AGPZ4cpcko2H2).
   * Every buy/renew through this contract includes an `affiliate` address param.
   * We query TzKT for all transactions to this contract and aggregate by affiliate address.
   */
  async getAffiliateOnChainData(): Promise<AffiliatePartner[]> {
    try {
      const ops = await fetchTzktTransactions(`${TZKT_API}/operations/transactions?target=${AFFILIATE_CONTRACT}&status=applied&sort.desc=id`, 1000);

      if (ops.length === 0) return [];

      const affiliates: Record<string, { buys: number; renewals: number; volumeMutez: number; domains: Set<string>; lastActive: string }> = {};

      for (const op of ops) {
        const affiliateAddr = op.parameter?.value?.affiliate;
        const entrypoint = op.parameter?.entrypoint;
        const label = op.parameter?.value?.label;

        if (!affiliateAddr || typeof affiliateAddr !== 'string') continue;

        if (!affiliates[affiliateAddr]) {
          affiliates[affiliateAddr] = { buys: 0, renewals: 0, volumeMutez: 0, domains: new Set(), lastActive: '' };
        }

        const entry = affiliates[affiliateAddr];
        if (entrypoint === 'buy') entry.buys++;
        else if (entrypoint === 'renew') entry.renewals++;
        entry.volumeMutez += (op.amount || 0);
        if (label) entry.domains.add(label);
        if (!entry.lastActive || op.timestamp > entry.lastActive) {
          entry.lastActive = op.timestamp;
        }
      }

      return Object.entries(affiliates)
        .map(([address, data]) => ({
          address,
          buys: data.buys,
          renewals: data.renewals,
          totalOps: data.buys + data.renewals,
          volumeXtz: Math.round(data.volumeMutez / 1_000_000 * 100) / 100,
          uniqueDomains: data.domains.size,
          lastActive: data.lastActive,
        }))
        .sort((a, b) => b.totalOps - a.totalOps);
    } catch (err) {
      console.error('Failed to fetch on-chain affiliate data:', err);
      throw err;
    }
  },

  async getAffiliateRecentOps(): Promise<AffiliateOp[]> {
    try {
      const ops = await fetchRecentTzktTransactions(`${TZKT_API}/operations/transactions?target=${AFFILIATE_CONTRACT}&status=applied&sort.desc=id`, 25, 60_000);

      if (ops.length === 0) return [];

      return ops

        .filter((op: any) => op.parameter?.value?.affiliate)
        .map((op: any) => {
          const label = op.parameter?.value?.label;
          return {
            id: String(op.id),
            type: op.parameter?.entrypoint === 'buy' ? 'buy' as const : 'renew' as const,
            domain: label ? `${hexToUtf8(label)}.tez` : 'unknown.tez',
            affiliate: op.parameter.value.affiliate,
            sender: op.sender?.address || 'unknown',
            amount: (op.amount || 0) / 1_000_000,
            timestamp: op.timestamp,
          };
        });
    } catch (err) {
      console.error('Failed to fetch recent affiliate ops:', err);
      throw err;
    }
  },
};
