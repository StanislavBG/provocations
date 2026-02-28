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
  UserButton,
} from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { LogIn, Quote, Brain, MessageCircleQuestion, Mic } from "lucide-react";
import { ProvoIcon } from "@/components/ProvoIcon";
import NotebookWorkspace from "@/pages/NotebookWorkspace";
import Admin from "@/pages/Admin";
import ContextStore from "@/pages/ContextStore";
import Pricing from "@/pages/Pricing";
import NotFound from "@/pages/not-found";
import { trackEvent } from "@/lib/tracking";
import { VerboseProvider } from "@/components/VerboseProvider";

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
      <Route path="/store" component={ContextStore} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/admin" component={Admin} />
      <Route path="/app/:templateId" component={NotebookWorkspace} />
      <Route path="/" component={NotebookWorkspace} />
      <Route component={NotFound} />
    </Switch>
  );
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar — sign in top-right */}
      <header className="flex items-center justify-between px-6 py-4 border-b bg-card/50">
        <div className="flex items-center gap-2">
          <ProvoIcon className="w-5 h-5 text-primary" />
          <span className="font-serif font-bold text-lg tracking-tight">Provocations</span>
        </div>
        <SignInButton mode="modal">
          <Button data-testid="button-sign-in" variant="default" size="sm" className="gap-2">
            <LogIn className="w-4 h-4" />
            Sign In
          </Button>
        </SignInButton>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="max-w-2xl space-y-6">
          <h1 className="text-4xl sm:text-5xl font-serif font-bold tracking-tight leading-tight">
            Work smarter <span className="text-primary">with</span> AI,
            <br />not replaced by it
          </h1>
          <p className="text-lg text-muted-foreground font-serif leading-relaxed max-w-xl mx-auto">
            Provocations is a productivity suite that enhances how you work with LLMs.
            It challenges your assumptions, stress-tests your ideas through expert personas,
            and helps you shape raw thinking into polished documents — together.
          </p>
          <p className="text-base text-muted-foreground/80 font-serif italic">
            You bring the ideas. AI brings the tough questions. Better work, together.
          </p>

          <div className="pt-4">
            <SignInButton mode="modal">
              <Button size="lg" className="gap-2 text-base px-8">
                <ProvoIcon className="w-5 h-5" />
                Get Started
              </Button>
            </SignInButton>
          </div>
        </div>

        {/* How it's different */}
        <div className="max-w-3xl w-full mt-20 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
          <div className="rounded-lg border bg-card p-5 space-y-2">
            <Brain className="w-6 h-6 text-primary" />
            <h3 className="font-semibold text-sm">14 Expert Personas</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              CEO, Architect, Security Engineer, UX Designer — each challenges a different
              dimension of your thinking. No generic feedback.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-5 space-y-2">
            <Mic className="w-6 h-6 text-primary" />
            <h3 className="font-semibold text-sm">Think Out Loud</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Speak your messy, unstructured thoughts. Provocations cleans your intent
              and weaves it into the document — no copy-pasting prompts.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-5 space-y-2">
            <MessageCircleQuestion className="w-6 h-6 text-primary" />
            <h3 className="font-semibold text-sm">Challenges, Not Completions</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Instead of generating text you didn't write, Provocations asks the hard
              questions so the final document is authentically yours.
            </p>
          </div>
        </div>

        {/* Testimonial */}
        <div className="max-w-2xl w-full mt-16">
          <div className="rounded-lg border border-primary/20 bg-card/80 p-8 space-y-4">
            <div className="flex gap-3 items-start border-l-4 border-primary pl-4">
              <Quote className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <p className="text-base font-serif italic leading-relaxed text-foreground/90">
                It lets you think in a messy, unstructured way, and polishes your output
                in any number of ways.
              </p>
            </div>
            <p className="text-sm font-serif leading-relaxed text-muted-foreground">
              "Provo is a collaborator, not a dumb bot. It turned me from a lazy
              'please summarize this' user into someone who knows what they want but doesn't
              have to know exactly how to say it — and can continue to shape the direction
              collaboratively with AI."
            </p>
            <div className="flex items-center gap-3 pt-2 border-t border-border/50">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">E</span>
              </div>
              <div>
                <p className="text-xs font-medium">Early Adopter</p>
                <p className="text-[10px] text-muted-foreground">Product Leader</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-6 text-center">
        <p className="text-xs text-muted-foreground">
          A productivity suite designed to enhance how you work with LLMs.
        </p>
      </footer>
    </div>
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
              <ProvoIcon className="w-8 h-8 text-primary animate-pulse" />
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          </div>
        </ClerkLoading>
        <ClerkLoaded>
          <SignedOut>
            <LandingPage />
          </SignedOut>
          <SignedIn>
            <LoginTracker />
            <VerboseProvider>
              <Router />
            </VerboseProvider>
          </SignedIn>
        </ClerkLoaded>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
