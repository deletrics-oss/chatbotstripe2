import { Home, MessageSquare, Smartphone, FileJson, Send, CreditCard, Settings, LogOut, BookOpen, Brain } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";

const menuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
  },
  {
    title: "Dispositivos",
    url: "/devices",
    icon: Smartphone,
  },
  {
    title: "Conversas",
    url: "/chat",
    icon: MessageSquare,
  },
  {
    title: "Lógicas",
    url: "/logic",
    icon: FileJson,
  },
  {
    title: "Base de Conhecimento",
    url: "/knowledge",
    icon: BookOpen,
  },
  {
    title: "Comportamentos do Bot",
    url: "/behaviors",
    icon: Brain,
  },
  {
    title: "Disparo em Massa",
    url: "/broadcast",
    icon: Send,
  },
  {
    title: "Planos",
    url: "/billing",
    icon: CreditCard,
  },
  {
    title: "Configurações",
    url: "/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  const getPlanBadge = (plan: string) => {
    const badges = {
      free: { label: "Free Trial", variant: "secondary" as const },
      basic: { label: "Básico", variant: "default" as const },
      full: { label: "Full", variant: "default" as const },
    };
    return badges[plan as keyof typeof badges] || badges.free;
  };

  const planBadge = user ? getPlanBadge(user.currentPlan) : null;

  return (
    <Sidebar data-testid="sidebar-main">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-lg font-semibold px-4 py-3">
            ChatBot Host v2.5
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive} data-testid={`nav-${item.url.slice(1) || 'dashboard'}`}>
                      <Link href={item.url}>
                        <item.icon className="w-5 h-5" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        {user && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-2 rounded-lg">
              <Avatar className="h-10 w-10">
                <AvatarImage src={undefined} />
                <AvatarFallback>
                  {user.firstName?.[0] || user.email?.[0] || user.username?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" data-testid="text-user-name">
                  {user.firstName || user.email?.split('@')[0]}
                </p>
                <p className="text-xs text-muted-foreground truncate" data-testid="text-user-email">
                  {user.email}
                </p>
              </div>
            </div>

            {planBadge && (
              <Badge variant={planBadge.variant} className="w-full justify-center" data-testid="badge-plan">
                {planBadge.label}
              </Badge>
            )}

            <button
              onClick={async () => {
                try {
                  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
                  window.location.href = '/login';
                } catch (error) {
                  console.error('Logout error:', error);
                  window.location.href = '/login';
                }
              }}
              className="flex items-center gap-2 w-full p-2 text-sm rounded-lg hover-elevate active-elevate-2 text-destructive"
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4" />
              <span>Sair</span>
            </button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
