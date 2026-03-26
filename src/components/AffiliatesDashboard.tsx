import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Users2,
  TrendingUp,
  RefreshCw,
  Search,
  ExternalLink,
  Award,
  ShoppingCart,
  RotateCcw,
  Coins,
  Activity,
  Copy,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Badge } from './ui/badge';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { tezosService, AffiliatePartner, AffiliateOp } from '../lib/tezos';
import { Skeleton } from './ui/skeleton';

const AFFILIATE_CONTRACT = 'KT1Hg3ymQBL5nfAbb1JZ8G8AGPZ4cpcko2H2';

function shortAddr(addr: string) {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function timeAgo(ts: string) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function copyAddr(addr: string) {
  navigator.clipboard.writeText(addr);
}

const AffiliatesDashboard = () => {
  const [partners, setPartners] = useState<AffiliatePartner[]>([]);
  const [recentOps, setRecentOps] = useState<AffiliateOp[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [p, r] = await Promise.all([
        tezosService.getAffiliateOnChainData(),
        tezosService.getAffiliateRecentOps(),
      ]);
      setPartners(p);
      setRecentOps(r);
    } catch (err) {
      console.error('Failed to load affiliate data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = partners.filter(
    (p) =>
      p.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPartners = partners.length;
  const totalBuys = partners.reduce((a, c) => a + c.buys, 0);
  const totalRenewals = partners.reduce((a, c) => a + c.renewals, 0);
  const totalVolume = partners.reduce((a, c) => a + c.volumeXtz, 0);

  const chartData = partners.slice(0, 10).map((p) => ({
    address: shortAddr(p.address),
    buys: p.buys,
    renewals: p.renewals,
  }));

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Affiliate Analytics
          </h1>
          <p className="text-muted-foreground">
            On-chain affiliate link usage from the Tezos Domains{' '}
            <a
              href={`https://tzkt.io/${AFFILIATE_CONTRACT}/operations`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-primary transition-colors"
            >
              AffiliateBuyRenew
            </a>{' '}
            contract.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="group"
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`}
          />
          Refresh
        </Button>
      </header>

      {/* KPI Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-background/50 backdrop-blur-sm border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Affiliate Partners</CardTitle>
            <Users2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPartners}</div>
            <p className="text-xs text-muted-foreground">Unique affiliate addresses</p>
          </CardContent>
        </Card>
        <Card className="bg-background/50 backdrop-blur-sm border-accent/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Affiliate Buys</CardTitle>
            <ShoppingCart className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBuys.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Domains bought via affiliates</p>
          </CardContent>
        </Card>
        <Card className="bg-background/50 backdrop-blur-sm border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Affiliate Renewals</CardTitle>
            <RotateCcw className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRenewals.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Domains renewed via affiliates</p>
          </CardContent>
        </Card>
        <Card className="bg-background/50 backdrop-blur-sm border-accent/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
            <Coins className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalVolume.toLocaleString()} XTZ</div>
            <p className="text-xs text-muted-foreground">Revenue through affiliate links</p>
          </CardContent>
        </Card>
      </section>

      {/* Chart + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-background/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Top Affiliates by Usage</CardTitle>
            <CardDescription>
              Buys and renewals facilitated by the top 10 affiliate partners.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] p-0 pr-4">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground) / 0.1)" />
                  <XAxis dataKey="address" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} cursor={{ fill: 'hsl(var(--primary) / 0.05)' }} />
                  <Bar dataKey="buys" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} name="Buys" />
                  <Bar dataKey="renewals" stackId="a" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} name="Renewals" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No affiliate transactions found on-chain.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-background/50 backdrop-blur-sm border-accent/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-accent" />
              Recent Affiliate Ops
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[340px] overflow-y-auto">
            {recentOps.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No recent affiliate operations.</p>
            ) : (
              recentOps.slice(0, 8).map((op) => (
                <div key={op.id} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center ${op.type === 'buy' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'}`}>
                      {op.type === 'buy' ? <ShoppingCart className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{op.domain}</p>
                      <p className="text-[11px] text-muted-foreground">
                        via {shortAddr(op.affiliate)} · {op.amount.toFixed(1)} XTZ
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] text-muted-foreground">{timeAgo(op.timestamp)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Full Table */}
      <Card className="bg-background/50 backdrop-blur-sm">
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle>All Affiliate Partners</CardTitle>
            <CardDescription>
              Every address that has facilitated a buy or renewal through the affiliate contract.
            </CardDescription>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by address..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Affiliate Address</TableHead>
                <TableHead className="text-right">Buys</TableHead>
                <TableHead className="text-right">Renewals</TableHead>
                <TableHead className="text-right">Total Ops</TableHead>
                <TableHead className="text-right">Volume (XTZ)</TableHead>
                <TableHead className="text-right">Last Active</TableHead>
                <TableHead className="text-right">Link</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p, i) => (
                <TableRow key={p.address}>
                  <TableCell className="font-mono text-sm">
                    <div className="flex items-center gap-2">
                      {i < 3 && (
                        <Award
                          className={`h-3.5 w-3.5 shrink-0 ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-slate-400' : 'text-amber-600'}`}
                        />
                      )}
                      <span className="truncate max-w-[160px]">{p.address}</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100" onClick={() => copyAddr(p.address)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{p.buys}</TableCell>
                  <TableCell className="text-right">{p.renewals}</TableCell>
                  <TableCell className="text-right font-semibold">{p.totalOps}</TableCell>
                  <TableCell className="text-right">{p.volumeXtz.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">{timeAgo(p.lastActive)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                      <a href={`https://tzkt.io/${p.address}/operations`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    {partners.length === 0
                      ? 'No affiliate transactions found on-chain yet.'
                      : 'No affiliates matching your search.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AffiliatesDashboard;
