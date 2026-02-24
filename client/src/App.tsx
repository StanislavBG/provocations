import { Switch, Route } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  ClerkLoaded,
  ClerkLoading,
} from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { LogIn, Sparkles } from "lucide-react";
import Workspace from "@/pages/Workspace";
import Admin from "@/pages/Admin";
import ContextStore from "@/pages/ContextStore";
import Pricing from "@/pages/Pricing";
import NotFound from "@/pages/not-found";
import { trackEvent } from "@/lib/tracking";

/** Fires a "login" tracking event once when the signed-in shell mounts. */
function LoginTracker() {
  useEffect(() => {
    trackEvent("login");
  }, []);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Workspace} />
      <Route path="/app/:templateId" component={Workspace} />
      <Route path="/store" component={ContextStore} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/admin" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <ClerkLoading>
          <div className="flex items-center justify-center min-h-screen bg-background">
            <div className="flex flex-col items-center gap-4">
              <Sparkles className="w-8 h-8 text-primary animate-pulse" />
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          </div>
        </ClerkLoading>
        <ClerkLoaded>
          <SignedOut>
            <div className="flex items-center justify-center min-h-screen bg-background">
              <div className="flex flex-col items-center gap-6 p-8 max-w-md text-center">
                <h1 className="text-3xl font-bold font-serif tracking-tight text-foreground">Provocations</h1>
                <p className="text-muted-foreground">
                  A cognitive tool that challenges your thinking. Sign in to get started.
                </p>
                <SignInButton mode="modal">
                  <Button data-testid="button-sign-in" variant="default">
                    <LogIn className="w-4 h-4 mr-2" />
                    Sign In
                  </Button>
                </SignInButton>
              </div>
            </div>
          </SignedOut>
          <SignedIn>
            <LoginTracker />
            <Router />
          </SignedIn>
        </ClerkLoaded>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
