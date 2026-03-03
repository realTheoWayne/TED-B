import React, { useState, useEffect, useCallback } from 'react';
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
  Users
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

const TezPageDashboard = () => {
  const [sites, setSites] = useState<TezPageSite[]>([]);
  const [stats, setStats] = useState({ totalSites: 0, newSites24h: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

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
    } catch (err) {
      console.error('Failed to load decentralized web data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredSites = sites.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.owner.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Mock growth data for the chart
  const growthData = [
    { date: 'Jan 24', count: 380 },
    { date: 'Feb 24', count: 395 },
    { date: 'Mar 24', count: 410 },
    { date: 'Apr 24', count: 425 },
    { date: 'May 24', count: 438 },
    { date: 'Jun 24', count: 452 },
    { date: 'Jul 24', count: 468 },
    { date: 'Aug 24', count: stats.totalSites || 480 },
  ];

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
            Tracking the decentralized web and Tezos Domains integrations.
          </p>
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
            <CardTitle className="text-sm font-medium">Total .Page Sites</CardTitle>
            <Globe className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSites}</div>
            <p className="text-xs text-muted-foreground">
              Across all .tez domains
            </p>
          </CardContent>
        </Card>
        <Card className="bg-background/50 backdrop-blur-sm border-accent/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">New (24h)</CardTitle>
            <TrendingUp className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{stats.newSites24h}</div>
            <p className="text-xs text-muted-foreground">
              Daily deployment average
            </p>
          </CardContent>
        </Card>
        <Card className="bg-background/50 backdrop-blur-sm border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Verified Hosting</CardTitle>
            <ShieldCheck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">84%</div>
            <p className="text-xs text-muted-foreground">
              Sites using IPFS/IPNS
            </p>
          </CardContent>
        </Card>
        <Card className="bg-background/50 backdrop-blur-sm border-accent/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12.4k</div>
            <p className="text-xs text-muted-foreground">
              Estimated monthly visits
            </p>
          </CardContent>
        </Card>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-background/50 backdrop-blur-sm overflow-hidden">
          <CardHeader>
            <CardTitle>Growth Trend</CardTitle>
            <CardDescription>Adoption of .tez.page decentralized websites.</CardDescription>
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
                    <p className="text-xs text-muted-foreground">Active .page redirect</p>
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
            <CardDescription>Explore all domains with decentralized content.</CardDescription>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search domains..." 
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === 'list' ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Content Hash / Record</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSites.map((site) => (
                  <TableRow key={site.name}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {site.name}
                        <Badge variant="outline" className="text-[10px] h-4">.page</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {site.owner.slice(0, 6)}...{site.owner.slice(-4)}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate font-mono text-xs text-muted-foreground">
                      {site.content}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <a href={site.link} target="_blank" rel="noopener noreferrer" className="flex items-center">
                          Visit Site <ExternalLink className="ml-2 h-3 w-3" />
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSites.map((site, i) => (
                <motion.div
                  key={site.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="group hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
                    <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                      <div className="flex justify-between items-start">
                        <div className="h-12 w-12 rounded-xl bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300">
                          <Globe className="h-6 w-6" />
                        </div>
                        <Badge variant="secondary" className="bg-primary/10 text-primary">Live</Badge>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold group-hover:text-primary transition-colors">{site.name}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-1 mb-1">{site.content}</p>
                        <p className="text-xs text-muted-foreground/60">Owner: {site.owner.slice(0, 8)}...</p>
                      </div>
                      <Button className="w-full mt-2 bg-primary/10 text-primary hover:bg-primary hover:text-white border-none" asChild>
                        <a href={site.link} target="_blank" rel="noopener noreferrer">
                          Go to Site <ExternalLink className="ml-2 h-4 w-4" />
                        </a>
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TezPageDashboard;
