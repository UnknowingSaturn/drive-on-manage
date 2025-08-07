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
  Calculator
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
  { title: "Companies", url: "/admin/companies", icon: Building2 },
  { title: "Driver Management", url: "/admin/drivers", icon: Users },
  { title: "Van Management", url: "/admin/vans", icon: Truck },
  { title: "Round Management", url: "/admin/rounds", icon: MapPin },
  { title: "Schedule View", url: "/admin/schedule", icon: Calendar },
  { title: "EOD Reports", url: "/admin/reports", icon: FileText },
  { title: "Finance", url: "/admin/finance", icon: Calculator },
];

const driverItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "My Profile", url: "/driver/profile", icon: UserCircle },
  { title: "Start of Day", url: "/driver/start-of-day", icon: Clock },
  { title: "End of Day", url: "/driver/end-of-day", icon: CheckCircle2 },
  { title: "Vehicle Check", url: "/driver/vehicle-check", icon: Truck },
  { title: "Incident Report", url: "/driver/incident-report", icon: AlertTriangle },
  { title: "News & Chat", url: "/driver/news-chat", icon: MessageCircle },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const currentPath = location.pathname;

  const isAdmin = profile?.user_type === 'admin';
  const items = isAdmin ? adminItems : driverItems;
  const collapsed = state === "collapsed";

  const isActive = (path: string) => currentPath === path;

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "hover:bg-sidebar-accent/50";

  return (
    <Sidebar 
      variant="sidebar"
      collapsible="icon"
      className="safe-left"
    >
      <SidebarHeader className="border-b border-sidebar-border p-3 md:p-4 bg-gradient-dark">
        <div className="flex items-center space-x-2 md:space-x-3">
          <div className="relative">
            <Truck className="h-6 w-6 md:h-8 md:w-8 text-primary animate-truck-drive" />
            <div className="absolute inset-0 h-6 w-6 md:h-8 md:w-8 text-primary-glow opacity-50 blur-sm animate-truck-drive"></div>
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <h2 className="text-base md:text-lg font-bold text-gradient truncate">LogiFlow</h2>
              <p className="text-xs md:text-sm text-sidebar-foreground/70 truncate">
                {profile?.first_name || 'User'}
              </p>
            </div>
          )}
        </div>
        {!collapsed && (
          <Badge 
            variant={isAdmin ? "default" : "secondary"} 
            className={`w-fit mt-2 text-xs ${isAdmin ? 'bg-gradient-primary border-primary/30' : 'bg-secondary/50 border-secondary/30'}`}
          >
            {isAdmin ? "Admin" : "Driver"}
          </Badge>
        )}
      </SidebarHeader>

      <SidebarContent className="overflow-y-auto">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/70 text-xs md:text-sm px-3 md:px-4">
            {isAdmin ? "Administration" : "Driver Tools"}
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="min-h-[44px] px-3 md:px-4">
                    <NavLink 
                      to={item.url} 
                      end 
                      className={({ isActive }) => getNavCls({ isActive })}
                    >
                      <item.icon className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0" />
                      {!collapsed && (
                        <span className="text-sm md:text-base truncate min-w-0 flex-1">
                          {item.title}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/70 text-xs md:text-sm px-3 md:px-4">
              Settings
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                <SidebarMenuItem>
                  <SidebarMenuButton asChild className="min-h-[44px] px-3 md:px-4">
                    <NavLink 
                      to="/admin/settings" 
                      className={({ isActive }) => getNavCls({ isActive })}
                    >
                      <Settings className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0" />
                      {!collapsed && (
                        <span className="text-sm md:text-base truncate min-w-0 flex-1">
                          Settings
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3 md:p-4 bg-gradient-dark safe-bottom">
        <Button 
          variant="outline" 
          onClick={signOut}
          className="w-full justify-start hover:bg-destructive/20 hover:border-destructive/30 hover:text-destructive transition-all duration-300 group min-h-[44px]"
          size={collapsed ? "icon" : "default"}
        >
          <LogOut className="h-4 w-4 md:h-5 md:w-5 group-hover:animate-pulse flex-shrink-0" />
          {!collapsed && (
            <span className="ml-2 text-sm md:text-base truncate min-w-0 flex-1">
              Sign Out
            </span>
          )}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}