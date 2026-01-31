<<<<<<< HEAD
import { useState, useEffect } from "react";
import { Home, MessageSquare, Smartphone, FileJson, Send, CreditCard, Settings, LogOut, BookOpen, Brain, Globe, Clock, Cog } from "lucide-react";
=======
import { Home, MessageSquare, Smartphone, FileJson, Send, CreditCard, Settings, LogOut, BookOpen, Brain, Globe, Crown } from "lucide-react";
>>>>>>> 519d37e14a66e309028e2f561ec7faf86ae39188
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
import { cn } from "@/lib/utils";

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
    title: "Disparo em Massa",
    url: "/broadcast",
    icon: Send,
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
    title: "Assistentes Web",
    url: "/web-assistants",
    icon: Globe,
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

const adminMenuItems = [
  {
    title: "Super Admin",
    url: "/super-admin",
    icon: Crown,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  const [isTrialing, setIsTrialing] = useState(false);

  useEffect(() => {
    if (user) {
      fetch('/api/subscription')
        .then(res => res.json())
        .then(data => {
          if (data) {
            setIsTrialing(data.isTrialing || false);
            setTrialDaysLeft(data.trialDaysLeft ?? null);
          }
        })
        .catch(() => { });
    }
  }, [user]);

  const getPlanBadge = (plan: string) => {
    const badges = {
      free: { label: "Free Trial", variant: "secondary" as const },
      basic: { label: "Básico", variant: "default" as const },
      full: { label: "Full", variant: "default" as const },
    };
    return badges[plan as keyof typeof badges] || badges.free;
  };

  const planBadge = user ? getPlanBadge(user.currentPlan) : null;

  // Add admin menu item dynamically
  const allMenuItems = user?.isAdmin
    ? [...menuItems, { title: "Config Cobrança", url: "/billing-config", icon: Cog }]
    : menuItems;

  return (
    <Sidebar data-testid="sidebar-main">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-lg font-semibold px-4 py-3">
            ChatBot Host v2.5
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {allMenuItems.map((item) => {
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

              {/* Admin-only menu items */}
              {user?.isAdmin && adminMenuItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive} data-testid={`nav-${item.url.slice(1)}`}>
                      <Link href={item.url}>
                        <item.icon className="w-5 h-5 text-yellow-500" />
                        <span className="font-semibold">{item.title}</span>
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
            {/* Trial Days Badge */}
            {isTrialing && trialDaysLeft !== null && (
              <div className={cn(
                "rounded-lg p-3 text-center text-sm",
                trialDaysLeft > 7
                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                  : trialDaysLeft > 3
                    ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"
                    : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
              )} data-testid="trial-badge">
                <div className="flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span className="font-semibold">
                    {trialDaysLeft > 0
                      ? `🎁 ${trialDaysLeft} dias grátis`
                      : "⚠️ Trial expirado"
                    }
                  </span>
                </div>
                <Link href="/billing" className="block mt-2 text-xs underline hover:no-underline">
                  Ver planos →
                </Link>
              </div>
            )}

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
