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
import ManageAccounts from "@/pages/manage-accounts";
import AccountDetail from "@/pages/account-detail";
import UserRights from "@/pages/user-rights";
import SetupFittingRooms from "@/pages/setup-fitting-rooms";
import Reports from "@/pages/reports";
import UserLogin from "@/pages/user-login";
import UserSignIn from "@/pages/user-signin";
import UserDashboard from "@/pages/user-dashboard";
import FittingRoomsPage from "@/pages/fitting-rooms";
import FittingRoomDetails from "@/pages/fitting-room-details";
import FittingRoomSingle from "@/pages/fitting-room-single";
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
      {/* Root route: staff login */}
      <Route path="/" component={UserSignIn} />
      <Route path="/admin-setup" component={AdminSetup} />
      <Route path="/setup-complete" component={SetupComplete} />
      <Route path="/login" component={Login} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/create-account" component={CreateAccount} />
      <Route path="/manage-accounts" component={ManageAccounts} />
      <Route path="/manage-accounts/:id" component={AccountDetail} />
      <Route path="/user-rights" component={UserRights} />
      <Route path="/setup-fitting-rooms" component={SetupFittingRooms} />
      <Route path="/reports" component={Reports} />
      <Route path="/user-login" component={UserLogin} />
      <Route path="/user-signin" component={UserSignIn} />
      <Route path="/user-dashboard" component={UserDashboard} />
      <Route path="/fitting-rooms" component={FittingRoomsPage} />
      <Route path="/fitting-room-details" component={FittingRoomDetails} />
      <Route path="/fitting-room-single" component={FittingRoomSingle} />

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
