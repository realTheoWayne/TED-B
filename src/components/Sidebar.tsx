import { Globe, LayoutDashboard, BarChart3, PieChart, Award, Settings, HelpCircle } from 'lucide-react';
import { Button } from './ui/button';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard' },
  { icon: BarChart3, label: 'Marketplace' },
  { icon: PieChart, label: 'Distribution' },
  { icon: Award, label: 'Leaderboards' },
];

interface SidebarContentProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function SidebarContent({ activeTab, onTabChange }: SidebarContentProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b flex items-center gap-3">
        <div className="bg-primary/20 p-2 rounded-lg">
          <Globe className="w-6 h-6 text-primary" />
        </div>
        <span className="font-bold text-xl tracking-tight">TD Insight</span>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => (
          <Button
            key={item.label}
            variant="ghost"
            onClick={() => onTabChange(item.label)}
            className={`w-full justify-start gap-3 ${activeTab === item.label ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </Button>
        ))}
      </nav>
      <div className="p-4 border-t space-y-2">
        <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground">
          <Settings className="w-4 h-4" /> Settings
        </Button>
        <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground">
          <HelpCircle className="w-4 h-4" /> Support
        </Button>
      </div>
    </div>
  );
}
