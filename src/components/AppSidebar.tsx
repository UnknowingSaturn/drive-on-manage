import { 
  LayoutDashboard, 
  Users, 
  Truck, 
  MapPin, 
  Calendar, 
  FileText, 
  Settings,
  LogOut,
  UserCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  MessageCircle,
  Building2,
  Calculator,
  Trophy,
  Receipt,
  Package,
  TestTube
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const adminItems = [
  { title: "Dashboard", url: "/admin/dashboard", icon: LayoutDashboard },
  { title: "Locations", url: "/admin/companies", icon: Building2 },
  { title: "Driver Management", url: "/admin/drivers", icon: Users },
  { title: "Van Management", url: "/admin/vans", icon: Truck },
  { title: "Round Management", url: "/admin/rounds", icon: MapPin },
  { title: "Schedule View", url: "/admin/schedule", icon: Calendar },
  { title: "Live Map", url: "/admin/live-map", icon: MapPin },
  { title: "EOD Reports", url: "/admin/reports", icon: FileText },
  { title: "SOD Reports", url: "/admin/start-of-day-reports", icon: Package },
  { title: "Finance", url: "/admin/finance", icon: Calculator },
];

const supervisorItems = [
  { title: "Dashboard", url: "/admin/dashboard", icon: LayoutDashboard },
  { title: "Driver Management", url: "/admin/drivers", icon: Users },
  { title: "Van Management", url: "/admin/vans", icon: Truck },
  { title: "Round Management", url: "/admin/rounds", icon: MapPin },
  { title: "Schedule View", url: "/admin/schedule", icon: Calendar },
  { title: "EOD Reports", url: "/admin/reports", icon: FileText },
  { title: "SOD Reports", url: "/admin/start-of-day-reports", icon: Package },
];

const driverItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "My Profile", url: "/driver/profile", icon: UserCircle },
  { title: "Start of Day", url: "/driver/start-of-day", icon: Clock },
  { title: "End of Day", url: "/driver/end-of-day", icon: CheckCircle2 },
  { title: "Vehicle Check", url: "/driver/vehicle-check", icon: Truck },
  { title: "Earnings", url: "/driver/earnings", icon: Calculator },
  { title: "Leaderboard", url: "/driver/leaderboard", icon: Trophy },
  { title: "Expenses", url: "/driver/expenses", icon: Receipt },
  { title: "Incident Report", url: "/driver/incident-report", icon: AlertTriangle },
  { title: "News & Chat", url: "/driver/news-chat", icon: MessageCircle },
  
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const currentPath = location.pathname;

  const isAdmin = profile?.user_type === 'admin';
  const isSupervisor = profile?.user_type === 'supervisor';
  const isManagement = isAdmin || isSupervisor;
  
  // Get appropriate menu items based on role
  const getMenuItems = () => {
    if (isAdmin) return adminItems;
    if (isSupervisor) return supervisorItems;
    return driverItems;
  };
  
  const items = getMenuItems();
  const collapsed = state === "collapsed";


  const isActive = (path: string) => currentPath === path;

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "hover:bg-sidebar-accent/50";

  return (
    <Sidebar 
      variant="sidebar"
      collapsible="icon"
      className="hidden md:flex"
    >
      <SidebarHeader className="border-b border-sidebar-border p-4 bg-gradient-dark">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Truck className="h-8 w-8 text-primary animate-truck-drive" />
            <div className="absolute inset-0 h-8 w-8 text-primary-glow opacity-50 blur-sm animate-truck-drive"></div>
          </div>
          {!collapsed && (
            <div>
              <h2 className="text-lg font-bold text-gradient">
                {isManagement ? 'EODrive HQ' : 'EODrive GO+'}
              </h2>
              <p className="text-sm text-sidebar-foreground/70">
                {profile?.first_name || 'User'}
              </p>
            </div>
          )}
        </div>
        {!collapsed && (
          <Badge 
            variant={isManagement ? "default" : "secondary"} 
            className={`w-fit mt-2 ${isManagement ? 'bg-gradient-primary border-primary/30' : 'bg-secondary/50 border-secondary/30'}`}
          >
            {isAdmin ? "Admin" : isSupervisor ? "Supervisor" : "Driver"}
          </Badge>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/70">
            {isManagement ? "Management" : "Driver Tools"}
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      end 
                      className={({ isActive }) => getNavCls({ isActive })}
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/70">
              Settings
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to="/admin/settings" 
                      className={({ isActive }) => getNavCls({ isActive })}
                    >
                      <Settings className="h-4 w-4" />
                      {!collapsed && <span>Settings</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4 bg-gradient-dark">
        <Button 
          variant="outline" 
          onClick={signOut}
          className="w-full justify-start hover:bg-destructive/20 hover:border-destructive/30 hover:text-destructive transition-all duration-300 group"
          size={collapsed ? "icon" : "default"}
        >
          <LogOut className="h-4 w-4 group-hover:animate-pulse" />
          {!collapsed && <span className="ml-2">Sign Out</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}