import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Register from "@/pages/register";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Devices from "@/pages/devices";
import Chat from "@/pages/chat";
import LogicEditor from "@/pages/logic-editor";
import Knowledge from "@/pages/knowledge";
import KnowledgeEditor from "@/pages/knowledge-editor";
import Behaviors from "@/pages/behaviors";
import BehaviorEditor from "@/pages/behavior-editor";
import Billing from "@/pages/billing";
import Settings from "@/pages/settings";
import Broadcast from "@/pages/broadcast";
import WebAssistants from "@/pages/web-assistants";
import PublicChat from "@/pages/public-chat";

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  // Custom sidebar width for chatbot application
  const style = {
    "--sidebar-width": "16rem",       // 256px for better navigation
    "--sidebar-width-icon": "4rem",   // default icon width
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="text-center">
          <div className="h-32 w-32 mx-auto animate-spin rounded-full border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Public routes (not authenticated)
  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/register" component={Register} />
        <Route path="/login" component={Login} />
        <Route path="/chat/:slug" component={PublicChat} />
        <Route path="/" component={Landing} />
        <Route component={Landing} />
      </Switch>
    );
  }

  // Check for public chat route even if authenticated (to allow testing)
  if (window.location.pathname.startsWith('/chat/')) {
    return (
      <Switch>
        <Route path="/chat/:slug" component={PublicChat} />
        <Route component={NotFound} />
      </Switch>
    );
  }


  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-2 border-b border-border">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
          </header>
          <main className="flex-1 overflow-auto">
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/devices" component={Devices} />
              <Route path="/chat" component={Chat} />
              <Route path="/logic" component={LogicEditor} />
              <Route path="/knowledge/new" component={KnowledgeEditor} />
              <Route path="/knowledge/:id" component={KnowledgeEditor} />
              <Route path="/knowledge" component={Knowledge} />
              <Route path="/behaviors/new" component={BehaviorEditor} />
              <Route path="/behaviors/:id" component={BehaviorEditor} />
              <Route path="/behaviors" component={Behaviors} />
              <Route path="/behaviors" component={Behaviors} />
              <Route path="/web-assistants" component={WebAssistants} />
              <Route path="/broadcast" component={Broadcast} />
              <Route path="/billing" component={Billing} />
              <Route path="/settings" component={Settings} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
