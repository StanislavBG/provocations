import { Switch, Route } from "wouter";
import { Suspense, lazy, useEffect, useLayoutEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
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
import NotFound from "@/pages/not-found";
import { trackEvent } from "@/lib/tracking";
import { VerboseProvider } from "@/components/VerboseProvider";

// ── Route-level code splitting (E4 optimization) ──
// Heavy page components are lazy-loaded so the initial bundle only contains
// the landing page and auth shell. Each route chunk loads on first navigation.
const FlowWorkspace = lazy(() => import("@/pages/FlowWorkspace"));
const NotebookWorkspace = lazy(() => import("@/pages/NotebookWorkspace"));
const FtuxWorkspace = lazy(() => import("@/pages/FtuxWorkspace"));
const MobilePreview = lazy(() => import("@/pages/MobilePreview"));
const Admin = lazy(() => import("@/pages/Admin"));
const ContextStore = lazy(() => import("@/pages/ContextStore"));
const Pricing = lazy(() => import("@/pages/Pricing"));
const Billing = lazy(() => import("@/pages/Billing"));
const ComponentLibrary = lazy(() => import("@/pages/ComponentLibrary"));
const ComponentShowcase = lazy(() => import("@/pages/ComponentShowcase"));
const ProjectOverview = lazy(() => import("@/pages/ProjectOverview"));
const ComponentCompare = lazy(() => import("@/pages/ComponentCompare"));
const Help = lazy(() => import("@/pages/Help"));

/** Loading skeleton shown while lazy route chunks load */
function RouteFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-4">
        <ProvoIcon className="w-8 h-8 text-primary animate-pulse" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

/** Fires a "login" tracking event once when the signed-in shell mounts. */
function LoginTracker() {
  useEffect(() => {
    trackEvent("login");
  }, []);
  return null;
}

function Router() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path="/mobile" component={MobilePreview} />
        <Route path="/store" component={ContextStore} />
        <Route path="/help/:pageSlug" component={Help} />
        <Route path="/help" component={Help} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/settings/billing" component={Billing} />
        <Route path="/admin" component={Admin} />
        <Route path="/project-overview" component={ProjectOverview} />
        <Route path="/project-component-compare" component={ComponentCompare} />
        <Route path="/components/:componentId" component={ComponentShowcase} />
        <Route path="/components" component={ComponentLibrary} />
        <Route path="/canvas/:canvasId/node/:nodeId">{() => <FlowWorkspace />}</Route>
        <Route path="/canvas/:canvasId">{() => <FlowWorkspace />}</Route>
        <Route path="/flow">{() => <FlowWorkspace />}</Route>
        <Route path="/old" component={NotebookWorkspace} />
        <Route path="/old/:templateId" component={NotebookWorkspace} />
        <Route path="/ftux/:templateId" component={FtuxWorkspace} />
        <Route path="/ftux" component={FtuxWorkspace} />
        <Route path="/app/:templateId" component={NotebookWorkspace} />
        <Route path="/">{() => <FlowWorkspace />}</Route>
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function LandingPage() {
  // Ensure the BG Aurora hero animation is visible on the landing page
  useLayoutEffect(() => {
    const hero = document.getElementById("hero");
    if (hero) hero.style.display = "";
    return () => {
      // Don't hide on unmount — FlowWorkspace manages visibility based on theme
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "transparent" }}>
      {/* Top bar — sign in top-right */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10" style={{ background: "rgba(0,0,0,0.3)", backdropFilter: "blur(12px)" }}>
        <div className="flex items-center gap-2">
          <ProvoIcon className="w-5 h-5 text-primary" />
          <span className="font-serif font-bold text-lg tracking-tight text-white">Provocations</span>
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
        {/* Large centered logo */}
        <ProvoIcon className="w-20 h-20 text-primary mb-8 drop-shadow-lg" />

        <div className="max-w-2xl space-y-6">
          <h1 className="text-4xl sm:text-5xl font-serif font-bold tracking-tight leading-tight text-white drop-shadow-md">
            Work smarter <span className="text-primary">with</span> AI,
            <br />not replaced by it
          </h1>
          <p className="text-lg text-white/70 font-serif leading-relaxed max-w-xl mx-auto">
            Provocations is a productivity suite that enhances how you work with LLMs.
            It challenges your assumptions, stress-tests your ideas through expert personas,
            and helps you shape raw thinking into polished documents — together.
          </p>
          <p className="text-base text-white/50 font-serif italic">
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
          <div className="rounded-lg border border-white/10 p-5 space-y-2" style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(16px)" }}>
            <Brain className="w-6 h-6 text-primary" />
            <h3 className="font-semibold text-sm text-white">14 Expert Personas</h3>
            <p className="text-xs text-white/60 leading-relaxed">
              CEO, Architect, Security Engineer, UX Designer — each challenges a different
              dimension of your thinking. No generic feedback.
            </p>
          </div>
          <div className="rounded-lg border border-white/10 p-5 space-y-2" style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(16px)" }}>
            <Mic className="w-6 h-6 text-primary" />
            <h3 className="font-semibold text-sm text-white">Think Out Loud</h3>
            <p className="text-xs text-white/60 leading-relaxed">
              Speak your messy, unstructured thoughts. Provocations cleans your intent
              and weaves it into the document — no copy-pasting prompts.
            </p>
          </div>
          <div className="rounded-lg border border-white/10 p-5 space-y-2" style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(16px)" }}>
            <MessageCircleQuestion className="w-6 h-6 text-primary" />
            <h3 className="font-semibold text-sm text-white">Challenges, Not Completions</h3>
            <p className="text-xs text-white/60 leading-relaxed">
              Instead of generating text you didn't write, Provocations asks the hard
              questions so the final document is authentically yours.
            </p>
          </div>
        </div>

        {/* Testimonial */}
        <div className="max-w-2xl w-full mt-16">
          <div className="rounded-lg border border-white/10 p-8 space-y-4" style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(16px)" }}>
            <div className="flex gap-3 items-start border-l-4 border-primary pl-4">
              <Quote className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <p className="text-base font-serif italic leading-relaxed text-white/90">
                It lets you think in a messy, unstructured way, and polishes your output
                in any number of ways.
              </p>
            </div>
            <p className="text-sm font-serif leading-relaxed text-white/60">
              "Provo is a collaborator, not a dumb bot. It turned me from a lazy
              'please summarize this' user into someone who knows what they want but doesn't
              have to know exactly how to say it — and can continue to shape the direction
              collaboratively with AI."
            </p>
            <div className="flex items-center gap-3 pt-2 border-t border-white/10">
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">E</span>
              </div>
              <div>
                <p className="text-xs font-medium text-white/90">Early Adopter</p>
                <p className="text-[10px] text-white/50">Product Leader</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-6 text-center">
        <p className="text-xs text-white/40">
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
