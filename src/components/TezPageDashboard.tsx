import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Globe, 
  ExternalLink, 
  Search, 
  ShieldCheck, 
  RefreshCw, 
  LayoutGrid, 
  List,
  History,
  TrendingUp,
  FileCode,
  Database,
  ChevronLeft,
  ChevronRight,
  Camera
} from 'lucide-react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from './ui/table';
import { Badge } from './ui/badge';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { tezosService, TezPageSite } from '../lib/tezos';
import { Skeleton } from './ui/skeleton';
import { blink } from '../lib/blink';
import type { PageSnapshotsRow } from '../lib/db-types';

const PAGE_SIZE = 24;
const pageSnapshots = blink.db.table<PageSnapshotsRow>('page_snapshots');

type SiteSnapshot = Pick<PageSnapshotsRow, 'screenshotUrl' | 'capturedAt'>;

const TezPageDashboard = () => {
  const [sites, setSites] = useState<TezPageSite[]>([]);
  const [stats, setStats] = useState<{ totalSites: number; newSites24h: number | null }>({ totalSites: 0, newSites24h: null });
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);
  const [snapshots, setSnapshots] = useState<Record<string, SiteSnapshot>>({});
  const [snapshotsLoading, setSnapshotsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [captureProgress, setCaptureProgress] = useState({ completed: 0, total: 0 });
  const [snapshotMessage, setSnapshotMessage] = useState<string | null>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [failedPreviewIds, setFailedPreviewIds] = useState<Set<string>>(() => new Set());
  const captureRunsRef = useRef(new Set<string>());

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [s, st] = await Promise.all([
        tezosService.getTezPageSites(),
        tezosService.getDecentralizedWebStats()
      ]);
      setSites(s);
      setStats(st);
      setDataError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load live domain records';
      setDataError(message);
      console.error('Failed to load decentralized web data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => fetchData(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchData]);

  useEffect(() => {
    let active = true;
    const unsubscribe = blink.auth.onAuthStateChanged(state => {
      if (active) setCurrentUserId(state.user?.id ?? null);
    });
    pageSnapshots.list({ limit: 10000, orderBy: { capturedAt: 'desc' } })
      .then(rows => {
        if (active) {
          setSnapshots(Object.fromEntries(rows.map(row => [row.domainName, {
            screenshotUrl: row.screenshotUrl,
            capturedAt: row.capturedAt,
          }])));
        }
      })
      .catch(error => {
        if (active) setSnapshotError(error instanceof Error ? error.message : 'Could not load saved screenshots');
      })
      .finally(() => {
        if (active) setSnapshotsLoading(false);
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const filteredSites = useMemo(() => sites.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.owner.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.content.toLowerCase().includes(searchQuery.toLowerCase())
  ), [sites, searchQuery]);
  const pageCount = Math.max(1, Math.ceil(filteredSites.length / PAGE_SIZE));
  const visibleSites = useMemo(
    () => filteredSites.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredSites, page],
  );
  const uncapturedVisibleSites = useMemo(
    () => visibleSites.filter(site => !snapshots[site.name]),
    [visibleSites, snapshots],
  );

  const captureVisibleSnapshots = useCallback(async (batchKey: string) => {
    if (!currentUserId || loading || snapshotsLoading || capturing || captureRunsRef.current.has(batchKey)) return;
    const targets = uncapturedVisibleSites.slice(0, PAGE_SIZE);
    if (targets.length === 0) {
      return;
    }

    captureRunsRef.current.add(batchKey);
    setCapturing(true);
    setSnapshotMessage(null);
    setSnapshotError(null);
    setCaptureProgress({ completed: 0, total: targets.length });
    let nextIndex = 0;
    let completed = 0;
    const failures: string[] = [];

    const worker = async () => {
      while (nextIndex < targets.length) {
        const site = targets[nextIndex++];
        try {
          const screenshotUrl = await blink.data.screenshot(site.link, { width: 1280, height: 800 });
          const capturedAt = new Date().toISOString();
          const row: PageSnapshotsRow = {
            id: site.name,
            userId: currentUserId,
            domainName: site.name,
            screenshotUrl,
            contentUrl: site.content,
            capturedAt,
          };
          let savedRow = row;
          try {
            await pageSnapshots.create(row);
          } catch (error) {
            const existing = await pageSnapshots.get(site.name);
            if (!existing) throw error;
            savedRow = existing;
          }
          setSnapshots(previous => ({
            ...previous,
            [site.name]: { screenshotUrl: savedRow.screenshotUrl, capturedAt: savedRow.capturedAt },
          }));
        } catch (error) {
          const reason = error instanceof Error ? error.message : 'Screenshot capture failed';
          failures.push(`${site.name}: ${reason}`);
        } finally {
          completed += 1;
          setCaptureProgress({ completed, total: targets.length });
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(2, targets.length) }, () => worker()));
    setCapturing(false);
    if (failures.length) {
      setSnapshotError(`${failures.length} snapshot${failures.length === 1 ? '' : 's'} could not be captured. ${failures.slice(0, 2).join(' · ')}`);
    }
    setSnapshotMessage(`${targets.length - failures.length} of ${targets.length} site snapshots saved. Previews are shared with directory visitors.`);
  }, [capturing, currentUserId, loading, snapshotsLoading, uncapturedVisibleSites]);

  useEffect(() => {
    if (!currentUserId || loading || snapshotsLoading || visibleSites.length === 0) return;
    const batchKey = `${currentUserId}:${page}:${searchQuery.trim().toLowerCase()}`;
    const timer = window.setTimeout(() => {
      void captureVisibleSnapshots(batchKey);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [captureVisibleSnapshots, currentUserId, loading, page, searchQuery, snapshotsLoading, visibleSites.length]);

  const growthData = stats.totalSites > 0
    ? [{ date: 'Live snapshot', count: stats.totalSites }]
    : [];
  const snapshotStatus = capturing
    ? `Saving previews ${captureProgress.completed}/${captureProgress.total}…`
    : snapshotsLoading
      ? 'Loading saved previews…'
      : !currentUserId
        ? 'Saved previews are shared. Automatic capture runs when a signed-in visitor opens this page.'
        : uncapturedVisibleSites.length > 0
          ? `Automatically saving up to ${Math.min(uncapturedVisibleSites.length, PAGE_SIZE)} missing previews on this page.`
          : `All ${visibleSites.length} previews on this page are saved.`;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            .Page Analytics
          </h1>
          <p className="text-muted-foreground">
            Browse live .tez domains with saved, one-time previews of their .tez.page websites.
          </p>
          {dataError && <p className="mt-2 text-sm text-destructive">Live data unavailable: {dataError}</p>}
          {snapshotError && <p className="mt-2 text-sm text-destructive">Snapshot issue: {snapshotError}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="group"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
            Refresh
          </Button>
          <div className="flex border rounded-md p-1 bg-background/50 backdrop-blur-sm">
            <Button 
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
              size="icon" 
              className="h-8 w-8"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button 
              variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
              size="icon" 
              className="h-8 w-8"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-background/50 backdrop-blur-sm border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Live .tez.page Sites</CardTitle>
            <Globe className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSites}</div>
            <p className="text-xs text-muted-foreground">
              Domains with a live web:content_url record
            </p>
          </CardContent>
        </Card>
        <Card className="bg-background/50 backdrop-blur-sm border-accent/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">New (24h)</CardTitle>
            <TrendingUp className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.newSites24h === null ? '—' : `+${stats.newSites24h}`}</div>
            <p className="text-xs text-muted-foreground">
              Not provided by the current domain API
            </p>
          </CardContent>
        </Card>
        <Card className="bg-background/50 backdrop-blur-sm border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Sites loaded</CardTitle>
            <ShieldCheck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sites.length.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Matching live website records
            </p>
          </CardContent>
        </Card>
        <Card className="bg-background/50 backdrop-blur-sm border-accent/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Data source</CardTitle>
            <Database className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">TzKT</div>
            <p className="text-xs text-muted-foreground">
              Filtered by web:content_url
            </p>
          </CardContent>
        </Card>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-background/50 backdrop-blur-sm overflow-hidden">
          <CardHeader>
            <CardTitle>Live site index</CardTitle>
            <CardDescription>Current website-record count from TzKT, not a historical growth series.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] p-0 pr-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthData}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground) / 0.1)" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    borderColor: 'hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  stroke="hsl(var(--primary))" 
                  fillOpacity={1} 
                  fill="url(#colorCount)" 
                  strokeWidth={3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-background/50 backdrop-blur-sm border-accent/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-accent" />
              Latest Deployments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {sites.slice(0, 5).map((site, i) => (
              <div key={site.name} className="flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <FileCode className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium group-hover:text-primary transition-colors">{site.name}</p>
                    <p className="text-xs text-muted-foreground">{site.isWebsiteRecord ? 'Website record' : 'On-chain record'}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" asChild className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <a href={site.link} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-background/50 backdrop-blur-sm">
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle>Directory</CardTitle>
            <CardDescription>
              {snapshotsLoading ? 'Loading saved previews…' : `${Object.keys(snapshots).length.toLocaleString()} one-time previews saved`}. Search live website records and browse the captured pages.
            </CardDescription>
          </div>
          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search domains..." 
                className="pl-9"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="flex min-h-10 max-w-xl items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground" role="status" aria-live="polite">
              {capturing ? <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-primary" /> : <Camera className="h-4 w-4 shrink-0 text-primary" />}
              <span>{snapshotStatus}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {capturing && (
            <div className="mb-4 rounded-lg border bg-muted/30 p-3" role="status" aria-live="polite">
              <p className="text-sm font-medium">Capturing and saving screenshots for this directory page…</p>
              <progress className="mt-2 w-full accent-primary" value={captureProgress.completed} max={captureProgress.total} />
            </div>
          )}
          {snapshotMessage && <p className="mb-4 text-sm text-muted-foreground" role="status">{snapshotMessage}</p>}
          {filteredSites.length === 0 ? (
            <div className="rounded-lg border border-dashed px-6 py-12 text-center">
              <Globe className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="font-medium">{sites.length === 0 ? 'No .tez.page sites found' : 'No matching sites'}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {sites.length === 0
                  ? 'TzKT returned no domains with a web:content_url record.'
                  : 'Try a different domain, owner address, or website URL.'}
              </p>
            </div>
          ) : viewMode === 'list' ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Preview</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Record</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleSites.map((site) => (
                  <TableRow key={site.name}>
                    <TableCell>
                      <div className="h-14 w-24 overflow-hidden rounded-md bg-muted">
                        {snapshots[site.name] && !failedPreviewIds.has(site.name) ? (
                          <img
                            src={snapshots[site.name].screenshotUrl}
                            alt={`Saved screenshot of ${site.name}.page`}
                            loading="lazy"
                            className="h-full w-full object-cover object-top"
                            onError={() => setFailedPreviewIds(previous => {
                              if (previous.has(site.name)) return previous;
                              const next = new Set(previous);
                              next.add(site.name);
                              return next;
                            })}
                          />
                        ) : <div className="flex h-full items-center justify-center"><Camera className="h-5 w-5 text-muted-foreground" /></div>}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {site.name}
                        <Badge variant="outline" className="text-[10px] h-4">.tez.page</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {site.owner.slice(0, 6)}...{site.owner.slice(-4)}
                    </TableCell>
                    <TableCell className="max-w-[260px] truncate text-xs text-muted-foreground">
                      <span className="font-mono text-primary">{site.recordKey}</span>{' '}{site.content}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <a href={site.link} target="_blank" rel="noopener noreferrer" className="flex items-center">
                          Open .tez.page <ExternalLink className="ml-2 h-3 w-3" />
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleSites.map((site, i) => (
                <motion.div
                  key={site.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="group hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
                    <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                      <div className="aspect-[16/10] w-full overflow-hidden rounded-lg bg-muted">
                        {snapshots[site.name] && !failedPreviewIds.has(site.name) ? (
                          <img
                            src={snapshots[site.name].screenshotUrl}
                            alt={`Saved screenshot of ${site.name}.page`}
                            loading="lazy"
                            className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
                            onError={() => setFailedPreviewIds(previous => {
                              if (previous.has(site.name)) return previous;
                              const next = new Set(previous);
                              next.add(site.name);
                              return next;
                            })}
                          />
                        ) : (
                          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                            <Camera className="h-7 w-7" />
                            <span className="text-xs">{failedPreviewIds.has(site.name) ? 'Saved preview unavailable' : 'No snapshot yet'}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex justify-between items-start">
                        <div className="h-12 w-12 rounded-xl bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300">
                          <Globe className="h-6 w-6" />
                        </div>
                        <Badge variant="secondary" className="bg-primary/10 text-primary">.tez.page</Badge>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold group-hover:text-primary transition-colors">{site.name}</h3>
                        <p className="text-xs font-mono text-primary mb-1">{site.recordKey}</p>
                        <p className="text-sm text-muted-foreground line-clamp-1">{site.content}</p>
                        <p className="text-xs text-muted-foreground/60">Owner: {site.owner.slice(0, 8)}...</p>
                      </div>
                      <Button className="w-full mt-2 bg-primary/10 text-primary hover:bg-primary hover:text-white border-none" asChild>
                        <a href={site.link} target="_blank" rel="noopener noreferrer">
                          Open .tez.page <ExternalLink className="ml-2 h-4 w-4" />
                        </a>
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
          {filteredSites.length > 0 && (
            <div className="mt-6 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredSites.length)} of {filteredSites.length.toLocaleString()} sites
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page <= 1}>
                  <ChevronLeft className="mr-1 h-4 w-4" /> Previous
                </Button>
                <span className="min-w-16 text-center text-sm text-muted-foreground">{page} / {pageCount}</span>
                <Button variant="outline" size="sm" onClick={() => setPage(current => Math.min(pageCount, current + 1))} disabled={page >= pageCount}>
                  Next <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TezPageDashboard;
