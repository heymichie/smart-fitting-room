import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

// Pages
import AdminSetup from "@/pages/admin-setup";
import SetupComplete from "@/pages/setup-complete";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import CreateAccount from "@/pages/create-account";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function Router() {
  return (
    <Switch>
      {/* Root route points to the Administrator Setup page */}
      <Route path="/" component={AdminSetup} />
      <Route path="/setup-complete" component={SetupComplete} />
      <Route path="/login" component={Login} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/create-account" component={CreateAccount} />

      {/* Fallback 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
