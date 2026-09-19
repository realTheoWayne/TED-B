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

async function fetchTzktTransactions(query: string, pageSize = 10000): Promise<any[]> {
  const operations: any[] = [];
  let offset = 0;

  while (true) {
    const separator = query.includes('?') ? '&' : '?';
    const page = await fetchJson<any[]>(`${query}${separator}limit=${pageSize}&offset=${offset}`);
    operations.push(...page);
    if (page.length < pageSize) return operations;
    offset += page.length;
  }
}

async function fetchRecentTzktTransactions(query: string, limit: number): Promise<any[]> {
  const separator = query.includes('?') ? '&' : '?';
  const page = await fetchJson<any[]>(`${query}${separator}limit=${limit}`);
  return Array.isArray(page) ? page : [];
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
    const [snapshot, buys, renews] = await Promise.all([
      fetchDomainSnapshot(),
      fetchRecentTzktTransactions(`${TZKT_API}/operations/transactions?target=${BUY_CONTRACT}&entrypoint=buy&status=applied&timestamp.ge=${now48}&sort.desc=id`, 10000),
      fetchRecentTzktTransactions(`${TZKT_API}/operations/transactions?target=${RENEW_CONTRACT}&entrypoint=renew&status=applied&timestamp.ge=${now48}&sort.desc=id`, 10000),
    ]);

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
    const [buys, renews] = await Promise.all([
      fetchRecentTzktTransactions(`${TZKT_API}/operations/transactions?target=${BUY_CONTRACT}&entrypoint=buy&status=applied&sort.desc=id`, 15),
      fetchRecentTzktTransactions(`${TZKT_API}/operations/transactions?target=${RENEW_CONTRACT}&entrypoint=renew&status=applied&sort.desc=id`, 15),
    ]);
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
      const ops = await fetchTzktTransactions(`${TZKT_API}/operations/transactions?target=${AFFILIATE_CONTRACT}&status=applied&sort.desc=id`);

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
      const ops = await fetchRecentTzktTransactions(`${TZKT_API}/operations/transactions?target=${AFFILIATE_CONTRACT}&status=applied&sort.desc=id`, 25);

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
