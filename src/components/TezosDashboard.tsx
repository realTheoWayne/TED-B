import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Users, Globe, Clock, ArrowUpRight, ArrowDownRight, Search,
  TrendingUp, Menu, RefreshCw, Minus, ExternalLink
} from 'lucide-react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { tezosService, DomainStats, ActivityItem, ChartData, ExtensionData } from '../lib/tezos';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import { SidebarContent } from './Sidebar';
import { captureAffiliateFromUrl, trackAffiliateLinkClick } from '../lib/affiliateTracking';

const POLL_INTERVAL = 30_000; // 30 seconds

function formatChange(val: number | null | undefined): { text: string; up: boolean | null } {
  if (val === null || val === undefined) return { text: '—', up: null };
  const up = val >= 0;
  return { text: `${up ? '+' : ''}${val}%`, up };
}

function timeAgo(date: Date): string {
  const s = Math.round((Date.now() - date.getTime()) / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export function TezosDashboard() {
  const [stats, setStats] = useState<DomainStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [growthData, setGrowthData] = useState<ChartData[]>([]);
  const [topHolders, setTopHolders] = useState<{ address: string; count: number }[]>([]);
  const [extensions, setExtensions] = useState<ExtensionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [lastUpdatedText, setLastUpdatedText] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [ready, setReady] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    else setRefreshing(true);

    try {
      const [s, a, g, h, e] = await Promise.all([
        tezosService.getStats(),
        tezosService.getRecentActivity(),
        tezosService.getGrowthData(),
        tezosService.getTopHolders(),
        tezosService.getExtensionDistribution()
      ]);
      setStats(s);
      setActivity(a);
      setGrowthData(g);
      setTopHolders(h);
      setExtensions(e);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      if (isInitial) setLoading(false);
      else setRefreshing(false);
    }
  }, []);

  // Capture affiliate params on mount
  useEffect(() => {
    captureAffiliateFromUrl();
  }, []);

  // Initial load
  useEffect(() => {
    loadData(true).then(() => {
      // Small delay to let React commit the DOM before revealing
      requestAnimationFrame(() => setReady(true));
    });
  }, [loadData]);

  // Auto-refresh polling every 30s
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      loadData(false);
    }, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadData]);

  // Update "last updated" text every second
  useEffect(() => {
    const tick = setInterval(() => {
      if (lastUpdated) setLastUpdatedText(timeAgo(lastUpdated));
    }, 1000);
    return () => clearInterval(tick);
  }, [lastUpdated]);

  /** Helper to track clicks on outbound affiliate / partner links */
  const handleAffiliateClick = useCallback((url: string, label: string) => {
    trackAffiliateLinkClick(url, label);
    window.open(url, '_blank', 'noopener');
  }, []);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  }, []);

  const statCards = [
    { label: 'Total Registered', value: stats?.totalDomains?.toLocaleString() || '0', ...formatChange(stats?.totalDomainsChange), icon: Globe },
    { label: 'New (24h)', value: stats?.new24h?.toLocaleString() || '0', ...formatChange(stats?.new24hChange), icon: TrendingUp },
    { label: 'Renewals (24h)', value: stats?.renewals24h?.toLocaleString() || '0', ...formatChange(stats?.renewalsChange), icon: Clock },
    { label: 'Active Domains', value: stats?.activeUsers?.toLocaleString() || '0', ...formatChange(stats?.activeUsersChange), icon: Users },
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="w-64 border-r bg-card hidden lg:flex flex-col">
        <SidebarContent activeTab={activeTab} onTabChange={handleTabChange} />
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64">
                <SidebarContent activeTab={activeTab} onTabChange={handleTabChange} />
              </SheetContent>
            </Sheet>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{activeTab}</h1>
              <p className="text-muted-foreground">
                {activeTab === 'Dashboard' && 'Live data from the Tezos blockchain'}
                {activeTab === 'Marketplace' && 'Explore recent sales and pricing trends'}
                {activeTab === 'Distribution' && 'Domain extension and ownership breakdown'}
                {activeTab === 'Leaderboards' && 'Top collectors in the Tezos community'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Live indicator */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span>Live</span>
              {lastUpdatedText && <span className="hidden sm:inline">· {lastUpdatedText}</span>}
            </div>
            <Button variant="outline" size="icon" onClick={() => loadData(false)} disabled={refreshing} className="h-9 w-9">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-10 w-64 bg-card/50 border-border/50 focus:border-primary/50 transition-colors" placeholder="Search domain..." />
            </div>
          </div>
        </header>

        <AnimatePresence mode="wait">
        {loading && !ready ? (
          <motion.div
            key="loader"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="flex items-center justify-center min-h-[60vh]"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent shadow-[0_0_20px_rgba(44,125,247,0.3)]" />
              <p className="text-muted-foreground animate-pulse font-medium">Loading live data from TzKT&hellip;</p>
            </div>
          </motion.div>
        ) : activeTab === 'Dashboard' ? (
          <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }}>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {statCards.map((stat, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                  <Card className="hover:shadow-lg transition-all hover:-translate-y-1">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="bg-primary/10 p-2 rounded-lg">
                          <stat.icon className="w-5 h-5 text-primary" />
                        </div>
                        {stat.up !== null ? (
                          <Badge variant={stat.up ? 'default' : 'destructive'} className="flex gap-1 items-center">
                            {stat.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            {stat.text}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="flex gap-1 items-center">
                            <Minus className="w-3 h-3" /> {stat.text}
                          </Badge>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                        <h3 className="text-2xl font-bold">{stat.value}</h3>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <motion.div className="lg:col-span-2" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}>
                <Card>
                  <CardHeader>
                    <CardTitle>Daily Registrations</CardTitle>
                    <CardDescription>Domain registrations per day (last 30 days)</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={growthData}>
                        <defs>
                          <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} itemStyle={{ color: 'hsl(var(--primary))' }} />
                        <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorCount)" strokeWidth={2} name="Registrations" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}>
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle>Extensions</CardTitle>
                    <CardDescription>Domain extension distribution</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[250px] flex flex-col items-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={extensions} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                          {extensions.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="grid grid-cols-2 gap-4 mt-4 w-full">
                      {extensions.map((ext) => (
                        <div key={ext.name} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ext.color }}></div>
                          <span className="text-xs font-medium">{ext.name}</span>
                          <span className="text-xs text-muted-foreground ml-auto">{ext.value}%</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Volume and Holders Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }}>
                <Card>
                  <CardHeader>
                    <CardTitle>Daily Volume</CardTitle>
                    <CardDescription>Registration spend in XTZ per day</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={growthData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} cursor={{ fill: 'hsl(var(--primary) / 0.1)' }} />
                        <Bar dataKey="volume" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Volume (XTZ)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 }}>
                <Card>
                  <CardHeader>
                    <CardTitle>Top Holders</CardTitle>
                    <CardDescription>Addresses with the most domain registrations</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {topHolders.length === 0 ? (
                      <p className="text-muted-foreground text-sm">Loading holder data&hellip;</p>
                    ) : (
                      <div className="space-y-5">
                        {topHolders.map((holder, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold">
                                {i + 1}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-medium truncate w-32 md:w-48 font-mono">
                                  {holder.address.slice(0, 8)}...{holder.address.slice(-4)}
                                </span>
                                <span className="text-xs text-muted-foreground">{holder.count} domains</span>
                              </div>
                            </div>
                            <div className="w-24 bg-secondary h-2 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${(holder.count / topHolders[0].count) * 100}%` }}
                                transition={{ duration: 1, delay: 1 }}
                                className="bg-primary h-full"
                              ></motion.div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Recent Activity Table */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Recent Activity</CardTitle>
                    <CardDescription>Latest domain registrations and renewals (live)</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => loadData(false)} disabled={refreshing}>
                    {refreshing ? 'Refreshing...' : 'Refresh'}
                  </Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Domain</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Owner</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead className="text-right">Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activity.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.domain}</TableCell>
                          <TableCell>
                            <Badge variant={item.type === 'buy' ? 'default' : 'secondary'}>
                              {item.type === 'buy' ? 'BUY' : 'RENEW'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground font-mono text-xs">{item.address.slice(0, 8)}...{item.address.slice(-4)}</TableCell>
                          <TableCell>{item.amount?.toFixed(2)} XTZ</TableCell>
                          <TableCell className="text-right text-muted-foreground text-xs">
                            {new Date(item.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </motion.div>

            {/* Affiliate / Partner Links Section */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }} className="mt-8">
              <Card>
                <CardHeader>
                  <CardTitle>Quick Links</CardTitle>
                  <CardDescription>Useful Tezos Domains resources</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { label: 'Register a Domain', url: 'https://tezos.domains' },
                      { label: 'TzKT Explorer', url: 'https://tzkt.io' },
                      { label: 'Tezos.Domains Docs', url: 'https://docs.tezos.domains' },
                      { label: 'Objkt Marketplace', url: 'https://objkt.com' },
                    ].map((link) => (
                      <Button
                        key={link.label}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => handleAffiliateClick(link.url, link.label)}
                      >
                        {link.label}
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <div className="bg-secondary p-4 rounded-full">
              <Globe className="w-12 h-12 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold">{activeTab} View is under development</h3>
            <p className="text-muted-foreground text-center max-w-md">
              We are working hard to bring you more detailed {activeTab.toLowerCase()} insights. Stay tuned for updates!
            </p>
            <Button onClick={() => setActiveTab('Dashboard')}>Back to Dashboard</Button>
          </motion.div>
        )}
        </AnimatePresence>
      </main>
    </div>
  );
}
