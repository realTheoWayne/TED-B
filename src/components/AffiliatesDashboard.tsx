import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Users2, 
  MousePointer2, 
  Target, 
  TrendingUp, 
  RefreshCw, 
  Search, 
  ExternalLink, 
  Copy, 
  CheckCircle2,
  Zap,
  Award,
  BarChart3
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
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { tezosService } from '../lib/tezos';
import { Skeleton } from './ui/skeleton';
import { toast } from 'react-hot-toast';

const AffiliatesDashboard = () => {
  const [stats, setStats] = useState<{ code: string; visits: number; clicks: number; conversions: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await tezosService.getAffiliateStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load affiliate stats:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGenerateLink = () => {
    if (!customCode.trim()) {
      toast.error('Please enter a partner code');
      return;
    }
    const baseUrl = window.location.origin;
    const link = `${baseUrl}?ref=${encodeURIComponent(customCode.trim())}`;
    setGeneratedLink(link);
    toast.success('Affiliate link generated!');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const filteredStats = stats.filter(s => 
    s.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalVisits = stats.reduce((acc, curr) => acc + curr.visits, 0);
  const totalClicks = stats.reduce((acc, curr) => acc + curr.clicks, 0);
  const totalConversions = stats.reduce((acc, curr) => acc + curr.conversions, 0);
  const avgConversionRate = totalVisits > 0 ? (totalConversions / totalVisits) * 100 : 0;

  if (loading) {
    return (
      <div className="space-y-6">
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
            Affiliate Program
          </h1>
          <p className="text-muted-foreground">
            Monitor partner performance and manage referral links.
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="group"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
          Refresh Stats
        </Button>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-background/50 backdrop-blur-sm border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Visits</CardTitle>
            <Users2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalVisits.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Unique referral entries</p>
          </CardContent>
        </Card>
        <Card className="bg-background/50 backdrop-blur-sm border-accent/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Link Clicks</CardTitle>
            <MousePointer2 className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalClicks.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Outbound partner clicks</p>
          </CardContent>
        </Card>
        <Card className="bg-background/50 backdrop-blur-sm border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Conversions</CardTitle>
            <Target className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalConversions.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Successful domain actions</p>
          </CardContent>
        </Card>
        <Card className="bg-background/50 backdrop-blur-sm border-accent/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Conv. Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgConversionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Visits to conversions</p>
          </CardContent>
        </Card>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-background/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Partner Leaderboard</CardTitle>
            <CardDescription>Top performing affiliate codes by volume.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] p-0 pr-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground) / 0.1)" />
                <XAxis 
                  dataKey="code" 
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
                  cursor={{ fill: 'hsl(var(--primary) / 0.05)' }}
                />
                <Bar dataKey="visits" radius={[4, 4, 0, 0]}>
                  {stats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? 'hsl(var(--primary))' : 'hsl(var(--accent))'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Generator
            </CardTitle>
            <CardDescription>Create your own referral link.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Your Code</label>
              <div className="flex gap-2">
                <Input 
                  placeholder="e.g. twitter_promo" 
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value)}
                  className="bg-background/50"
                />
                <Button onClick={handleGenerateLink}>Create</Button>
              </div>
            </div>

            {generatedLink && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-lg bg-background border border-primary/20 space-y-3"
              >
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Your Link</p>
                <div className="flex items-center gap-2 bg-muted/50 p-2 rounded border font-mono text-xs overflow-hidden">
                  <span className="truncate flex-1">{generatedLink}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(generatedLink)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-primary font-medium">
                  <CheckCircle2 className="h-3 w-3" />
                  Ready to share on social media
                </div>
              </motion.div>
            )}
            
            <div className="pt-4 border-t border-primary/10">
              <h4 className="text-sm font-semibold mb-2">How it works:</h4>
              <ul className="text-xs space-y-2 text-muted-foreground">
                <li className="flex gap-2">
                  <div className="h-4 w-4 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">1</div>
                  Share your unique link with the community.
                </li>
                <li className="flex gap-2">
                  <div className="h-4 w-4 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">2</div>
                  Visitors are tracked via the <code>ref</code> parameter.
                </li>
                <li className="flex gap-2">
                  <div className="h-4 w-4 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">3</div>
                  Metrics appear here in real-time.
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-background/50 backdrop-blur-sm">
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle>Detailed Breakdown</CardTitle>
            <CardDescription>Performance metrics per affiliate code.</CardDescription>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search codes..." 
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
                <TableHead>Affiliate Code</TableHead>
                <TableHead className="text-right">Visits</TableHead>
                <TableHead className="text-right">Clicks</TableHead>
                <TableHead className="text-right">Conversions</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStats.map((item, i) => {
                const rate = item.visits > 0 ? (item.conversions / item.visits) * 100 : 0;
                return (
                  <TableRow key={item.code}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {i < 3 && <Award className={`h-3 w-3 ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-slate-400' : 'text-amber-600'}`} />}
                        {item.code}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{item.visits.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{item.clicks.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{item.conversions.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs font-mono">{rate.toFixed(1)}%</span>
                        <div className="w-12 bg-secondary h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-primary h-full" 
                            style={{ width: `${Math.min(rate * 5, 100)}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="text-[10px] uppercase bg-emerald-500/5 text-emerald-500 border-emerald-500/20">Active</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredStats.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No partner data found matching your search.
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
