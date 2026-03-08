import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Check, ArrowLeft, Loader2, Zap, Flame, Rocket, Crown, Sparkles } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface StripeProduct {
  id: string;
  name: string;
  description: string;
  priceId: string;
  amount: number;
  currency: string;
  type: "one_time" | "recurring";
}

const dilbertQuotes = [
  '"I asked the AI for a summary. It gave me a novel. That\'ll be $47."',
  '"My boss said AI would save us money. He was the first one it replaced."',
  '"Every token is a tiny scream from my credit card."',
];

const comicPanels = [
  {
    character: "Dilbert",
    line: "I need more tokens to finish this document.",
    mood: "desperate",
  },
  {
    character: "Pointy-Haired Boss",
    line: "What's a token? Is that like Bitcoin?",
    mood: "clueless",
  },
  {
    character: "Dilbert",
    line: "It's what I pay so the AI can tell me my writing needs work.",
    mood: "defeated",
  },
];

function DilbertComicStrip() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-2 border-foreground/20 rounded-lg overflow-hidden bg-card">
        {comicPanels.map((panel, i) => (
          <div
            key={i}
            className={`p-6 flex flex-col items-center text-center ${
              i < comicPanels.length - 1 ? "md:border-r-2 border-b-2 md:border-b-0 border-foreground/20" : ""
            }`}
          >
            {/* ASCII art character */}
            <pre className="text-xs leading-tight font-mono mb-3 text-muted-foreground select-none">
              {panel.character === "Dilbert" && panel.mood === "desperate"
                ? `   ┌─────┐
   │ O  O │
   │  __  │
   │ /  \\ │
   └──┬──┘
      │
   ┌──┴──┐
   │     │
   │ $$$ │
   └─────┘`
                : panel.character === "Pointy-Haired Boss"
                ? `     /\\
    /  \\
   /    \\
   │ O  O │
   │  ??  │
   │ \\__/ │
   └──┬──┘
      │
   ┌──┴──┐
   │ TIE │
   └─────┘`
                : `   ┌─────┐
   │ -  - │
   │  __  │
   │ \\__/ │
   └──┬──┘
      │
   ┌──┴──┐
   │     │
   │ ...  │
   └─────┘`}
            </pre>
            <p className="text-xs font-bold text-primary mb-1 font-mono uppercase tracking-wider">
              {panel.character}
            </p>
            <div className="relative bg-background border border-foreground/20 rounded-lg p-3 mt-1">
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-background border-l border-t border-foreground/20 rotate-45" />
              <p className="text-sm italic font-serif relative z-10">
                "{panel.line}"
              </p>
            </div>
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground mt-2 font-mono">
        DILBERT (R) by Scott Adams — (parody, please don't sue us, we can't even afford tokens)
      </p>
    </div>
  );
}

function RotatingQuote() {
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % dilbertQuotes.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <p className="text-muted-foreground text-sm italic font-serif max-w-xl mx-auto mt-4 transition-opacity duration-500">
      {dilbertQuotes[quoteIndex]}
    </p>
  );
}

// ── Subscription plan definitions ──

interface PlanDef {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number; // per month when billed annually
  icon: typeof Zap;
  popular?: boolean;
  features: string[];
  limits: string[];
}

const plans: PlanDef[] = [
  {
    id: "free",
    name: "Free",
    description: "Get started with AI-powered provocations",
    monthlyPrice: 0,
    annualPrice: 0,
    icon: Zap,
    features: [
      "25 LLM calls per day",
      "5 image generations per day",
      "3 canvases, 15 nodes each",
      "100 MB storage",
      "14 expert personas",
      "Voice capture",
    ],
    limits: [
      "No text-to-speech",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    description: "For serious knowledge workers",
    monthlyPrice: 19,
    annualPrice: 15.20, // 20% discount
    icon: Sparkles,
    popular: true,
    features: [
      "200 LLM calls per day",
      "50 image generations per day",
      "Unlimited canvases & nodes",
      "5 GB storage",
      "50 TTS minutes per month",
      "All expert personas",
      "Priority support",
    ],
    limits: [],
  },
  {
    id: "team",
    name: "Team",
    description: "For teams that ship together",
    monthlyPrice: 39,
    annualPrice: 31.20, // 20% discount
    icon: Crown,
    features: [
      "500 LLM calls per day",
      "200 image generations per day",
      "Unlimited canvases & nodes",
      "25 GB storage",
      "200 TTS minutes per month",
      "All expert personas",
      "Team collaboration",
      "Priority support",
    ],
    limits: [],
  },
];

export default function Pricing() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [annual, setAnnual] = useState(false);
  const [oneTimeProducts, setOneTimeProducts] = useState<StripeProduct[]>([]);

  const params = new URLSearchParams(window.location.search);
  const success = params.get("success") === "true";
  const canceled = params.get("canceled") === "true";

  // Fetch current plan
  useEffect(() => {
    apiRequest("GET", "/api/billing/status")
      .then((res) => res.json())
      .then((data) => setCurrentPlan(data.plan ?? "free"))
      .catch(() => setCurrentPlan("free"));
  }, []);

  // Fetch one-time products (Buy a Coffee, etc.)
  useEffect(() => {
    if (!success && !canceled) {
      apiRequest("GET", "/api/stripe/config")
        .then((res) => res.json())
        .then((data) => setOneTimeProducts(data.products || []))
        .catch(() => {});
    }
  }, [success, canceled]);

  async function handleSubscribe(planId: string) {
    if (planId === "free") return;

    setLoading(planId);
    try {
      // Determine price ID from env-configured Stripe prices
      const envKey = annual
        ? `STRIPE_${planId.toUpperCase()}_ANNUAL_PRICE_ID`
        : `STRIPE_${planId.toUpperCase()}_PRICE_ID`;

      // Use the billing checkout endpoint which creates subscription-mode sessions
      const res = await apiRequest("POST", "/api/billing/checkout-session", {
        priceId: envKey, // Server maps this to actual Stripe price
      });
      const data = await res.json();
      if (data.sessionUrl) {
        window.location.href = data.sessionUrl;
      }
    } catch {
      toast({
        title: "Checkout Failed",
        description: "Could not start the checkout process. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  }

  async function handleOneTimeCheckout(priceId: string) {
    setLoading(priceId);
    try {
      const res = await apiRequest("POST", "/api/stripe/create-checkout-session", { priceId });
      const data = await res.json();
      if (data.sessionUrl) {
        window.location.href = data.sessionUrl;
      }
    } catch {
      toast({
        title: "Purchase Failed",
        description: "The AI couldn't even take your money. That's a new low.",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  }

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardHeader className="text-center">
            <pre className="text-xs leading-tight font-mono mb-3 text-muted-foreground mx-auto select-none">
{`   ┌─────┐
   │ ^  ^ │
   │  __  │
   │ \\__/ │
   └──┬──┘
   \\  │  /
   ┌──┴──┐
   │ YAY │
   └─────┘`}
            </pre>
            <CardTitle className="font-serif text-2xl">Welcome Aboard!</CardTitle>
            <CardDescription className="font-serif italic">
              Your plan is now active. Go create something remarkable.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center gap-3">
            <Button variant="outline" onClick={() => setLocation("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Canvas
            </Button>
            <Button onClick={() => setLocation("/settings/billing")}>
              View Billing
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (canceled) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardHeader className="text-center">
            <pre className="text-xs leading-tight font-mono mb-3 text-muted-foreground mx-auto select-none">
{`   ┌─────┐
   │ -  - │
   │  __  │
   │ /  \\ │
   └──┬──┘
      │
   ┌──┴──┐
   │  ?  │
   └─────┘`}
            </pre>
            <CardTitle className="font-serif text-2xl">Checkout Abandoned</CardTitle>
            <CardDescription className="font-serif italic">
              "I too have stared into the checkout page and chosen survival."
              <br />— Dilbert, probably
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center gap-3">
            <Button variant="outline" onClick={() => setLocation("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Flee to Safety
            </Button>
            <Button onClick={() => {
              window.history.replaceState({}, "", "/pricing");
              window.location.reload();
            }}>
              Try Again (Bravely)
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-auto">
      {/* Header */}
      <div className="border-b shrink-0">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="font-serif text-lg font-bold text-foreground">Provocations</span>
          </button>
          {currentPlan && currentPlan !== "free" && (
            <Button variant="ghost" size="sm" onClick={() => setLocation("/settings/billing")}>
              Manage Billing
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="font-serif text-3xl font-bold tracking-tight mb-2">
            Choose Your Plan
          </h1>
          <p className="text-muted-foreground text-base max-w-2xl mx-auto">
            Every provocation, challenge, and piece of advice costs tokens.
            Pick the plan that matches your ambition.
          </p>
          <RotatingQuote />
        </div>

        {/* Annual toggle */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <span className={`text-sm ${!annual ? "font-medium text-foreground" : "text-muted-foreground"}`}>
            Monthly
          </span>
          <Switch checked={annual} onCheckedChange={setAnnual} />
          <span className={`text-sm ${annual ? "font-medium text-foreground" : "text-muted-foreground"}`}>
            Annual
          </span>
          {annual && (
            <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
              Save 20%
            </Badge>
          )}
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {plans.map((plan) => {
            const isCurrent = currentPlan === plan.id;
            const price = annual ? plan.annualPrice : plan.monthlyPrice;
            const PlanIcon = plan.icon;

            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col transition-transform hover:scale-[1.01] ${
                  plan.popular ? "border-primary/50 shadow-lg" : ""
                } ${isCurrent ? "ring-2 ring-primary" : ""}`}
              >
                {plan.popular && !isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground font-mono text-xs">
                      MOST POPULAR
                    </Badge>
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-green-600 text-white font-mono text-xs">
                      CURRENT PLAN
                    </Badge>
                  </div>
                )}
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <PlanIcon className="h-5 w-5 text-primary" />
                    <CardTitle className="font-serif text-xl">{plan.name}</CardTitle>
                  </div>
                  <CardDescription className="text-xs">{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 pt-0">
                  <div className="mb-4">
                    <span className="text-4xl font-bold">
                      ${price === 0 ? "0" : price.toFixed(price % 1 === 0 ? 0 : 2)}
                    </span>
                    {price > 0 && (
                      <span className="text-muted-foreground ml-1 text-sm">
                        /mo{annual ? " (billed annually)" : ""}
                      </span>
                    )}
                    {plan.id === "team" && (
                      <span className="text-muted-foreground ml-1 text-sm">/user</span>
                    )}
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        {feature}
                      </li>
                    ))}
                    {plan.limits.map((limit, i) => (
                      <li key={`limit-${i}`} className="flex items-start gap-2 text-muted-foreground/60">
                        <span className="h-4 w-4 flex items-center justify-center shrink-0 mt-0.5">—</span>
                        {limit}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter className="pt-0">
                  {isCurrent ? (
                    <Button className="w-full" variant="outline" disabled>
                      Current Plan
                    </Button>
                  ) : plan.id === "free" ? (
                    <Button className="w-full" variant="outline" disabled={currentPlan === "free"}>
                      {currentPlan === "free" ? "Current Plan" : "Downgrade"}
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => handleSubscribe(plan.id)}
                      disabled={loading === plan.id}
                    >
                      {loading === plan.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : currentPlan && currentPlan !== "free" ? (
                        "Change Plan"
                      ) : (
                        "Get Started"
                      )}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* One-time purchases (Buy a Coffee, etc.) */}
        {oneTimeProducts.length > 0 && (
          <div className="mb-10">
            <h2 className="font-serif text-xl font-bold text-center mb-4">Support the Project</h2>
            <div className="flex gap-4 justify-center">
              {oneTimeProducts.map((product) => (
                <Card key={product.id} className="w-[260px]">
                  <CardHeader className="pb-2">
                    <CardTitle className="font-serif text-lg">{product.name}</CardTitle>
                    <CardDescription className="text-xs">{product.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <span className="text-2xl font-bold">
                      ${(product.amount / 100).toFixed(product.amount % 100 === 0 ? 0 : 2)}
                    </span>
                    <span className="text-muted-foreground ml-1 text-sm">one-time</span>
                  </CardContent>
                  <CardFooter className="pt-0">
                    <Button
                      className="w-full"
                      variant="outline"
                      size="sm"
                      onClick={() => handleOneTimeCheckout(product.priceId)}
                      disabled={loading === product.priceId}
                    >
                      {loading === product.priceId ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Flame className="mr-2 h-4 w-4" />
                      )}
                      Buy
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Comic strip */}
        <div className="mb-8">
          <DilbertComicStrip />
        </div>

        {/* Footer quip */}
        <div className="text-center text-[11px] text-muted-foreground font-mono space-y-0.5 pb-8">
          <p>No tokens were harmed in the making of this page.</p>
          <p>
            All proceeds go toward making the AI slightly more provocative
            and keeping the developer caffeinated.
          </p>
        </div>
      </div>
    </div>
  );
}
