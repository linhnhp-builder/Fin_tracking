import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardLayout from "./components/DashboardLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import Categories from "./pages/Categories";
import Transactions from "./pages/Transactions";
import AIChat from "./pages/AIChat";
import Investments from "./pages/Investments";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/ai-chat" component={AIChat} />
        <Route path="/categories" component={Categories} />
        <Route path="/transactions" component={Transactions} />
        <Route path="/investments" component={Investments} />
        <Route path="/reports" component={Reports} />
        <Route path="/settings" component={Settings} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
