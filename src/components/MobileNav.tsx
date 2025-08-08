import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Menu, X, LogOut, Truck } from 'lucide-react';
import { 
  LayoutDashboard, 
  Users, 
  MapPin, 
  Calendar, 
  FileText, 
  Settings,
  UserCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  MessageCircle,
  Building2,
  Calculator,
  DollarSign,
  Star,
  Trophy,
  Receipt
} from "lucide-react";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

const adminItems = [
  { title: "Dashboard", url: "/admin/dashboard", icon: LayoutDashboard },
  { title: "Companies", url: "/admin/companies", icon: Building2 },
  { title: "Driver Management", url: "/admin/drivers", icon: Users },
  { title: "Driver Engagement", url: "/admin/engagement", icon: Trophy },
  { title: "Van Management", url: "/admin/vans", icon: Truck },
  { title: "Round Management", url: "/admin/rounds", icon: MapPin },
  { title: "Schedule View", url: "/admin/schedule", icon: Calendar },
  { title: "EOD Reports", url: "/admin/reports", icon: FileText },
  { title: "Finance", url: "/admin/finance", icon: Calculator },
];

const driverItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "My Profile", url: "/driver/profile", icon: UserCircle },
  { title: "Earnings Tracker", url: "/driver/earnings", icon: DollarSign },
  { title: "Leaderboard", url: "/driver/leaderboard", icon: Trophy },
  { title: "Route Feedback", url: "/driver/feedback", icon: Star },
  { title: "Expense Tracker", url: "/driver/expenses", icon: Receipt },
  { title: "Start of Day", url: "/driver/start-of-day", icon: Clock },
  { title: "End of Day", url: "/driver/end-of-day", icon: CheckCircle2 },
  { title: "Vehicle Check", url: "/driver/vehicle-check", icon: Truck },
  { title: "Incident Report", url: "/driver/incident-report", icon: AlertTriangle },
  { title: "News & Chat", url: "/driver/news-chat", icon: MessageCircle },
];

interface MobileNavProps {
  className?: string;
}

export function MobileNav({ className }: MobileNavProps) {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const isAdmin = profile?.user_type === 'admin';
  const items = isAdmin ? adminItems : driverItems;
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath === path;

  const getNavCls = (path: string) =>
    isActive(path) 
      ? "flex items-center space-x-3 px-4 py-3 rounded-lg bg-primary text-primary-foreground font-medium" 
      : "flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-accent text-foreground";

  return (
    <div className={`md:hidden ${className}`}>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="touch-target">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        
        <SheetContent side="left" className="w-80 no-overflow">
          <SheetHeader className="border-b pb-4 mb-4">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Truck className="h-8 w-8 text-primary animate-truck-drive" />
                <div className="absolute inset-0 h-8 w-8 text-primary-glow opacity-50 blur-sm animate-truck-drive"></div>
              </div>
              <div>
                <SheetTitle className="text-lg font-bold text-gradient">LogiFlow</SheetTitle>
                <p className="text-sm text-muted-foreground">
                  {profile?.first_name || 'User'}
                </p>
              </div>
            </div>
            <Badge 
              variant={isAdmin ? "default" : "secondary"} 
              className={`w-fit ${isAdmin ? 'bg-gradient-primary border-primary/30' : 'bg-secondary/50 border-secondary/30'}`}
            >
              {isAdmin ? "Admin" : "Driver"}
            </Badge>
          </SheetHeader>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                {isAdmin ? "Administration" : "Driver Tools"}
              </h3>
              <nav className="space-y-2">
                {items.map((item) => (
                  <NavLink
                    key={item.title}
                    to={item.url}
                    className={getNavCls(item.url)}
                    onClick={() => setOpen(false)}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.title}</span>
                  </NavLink>
                ))}
              </nav>
            </div>

            {isAdmin && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">Settings</h3>
                <nav className="space-y-2">
                  <NavLink
                    to="/admin/settings"
                    className={getNavCls('/admin/settings')}
                    onClick={() => setOpen(false)}
                  >
                    <Settings className="h-5 w-5" />
                    <span>Settings</span>
                  </NavLink>
                </nav>
              </div>
            )}

            <div className="pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={() => {
                  signOut();
                  setOpen(false);
                }}
                className="w-full justify-start hover:bg-destructive/20 hover:border-destructive/30 hover:text-destructive transition-all duration-300 group mobile-button"
              >
                <LogOut className="h-4 w-4 mr-3 group-hover:animate-pulse" />
                Sign Out
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}