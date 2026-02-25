import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowLeft, Loader2, Zap, Flame, Rocket } from "lucide-react";
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

const tierIcons = [Zap, Flame, Rocket];

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
    <div className="mx-auto">
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

function TokenMeter({ amount }: { amount: number }) {
  const tokens = Math.round(amount / 100 * 50000);
  return (
    <div className="mt-3 text-xs text-muted-foreground font-mono">
      <div className="flex items-center gap-1.5">
        <span>~{tokens.toLocaleString()} tokens</span>
        <span className="text-muted-foreground/50">|</span>
        <span>{Math.round(tokens / 750)} pages of "help"</span>
      </div>
      <div className="w-full bg-muted rounded-full h-1.5 mt-1.5">
        <div
          className="bg-primary rounded-full h-1.5 transition-all"
          style={{ width: `${Math.min((amount / 5000) * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}

const tierPerks: string[][] = [
  [
    "The AI acknowledges your existence",
    "Tokens that vanish like your will to live",
    "A warm feeling (briefly)",
  ],
  [
    "AI pretends to respect your opinions",
    "Enough tokens to argue with a chatbot",
    "Priority access to existential dread",
  ],
  [
    "AI writes your performance review",
    "Tokens for days (approximately 1.5 days)",
    "The PHB will never understand this",
  ],
];

export default function Pricing() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<StripeProduct[]>([]);

  const params = new URLSearchParams(window.location.search);
  const success = params.get("success") === "true";
  const canceled = params.get("canceled") === "true";

  useEffect(() => {
    if (!success && !canceled) {
      apiRequest("GET", "/api/stripe/config")
        .then((res) => res.json())
        .then((data) => setProducts(data.products || []))
        .catch(() => {
          // Stripe not configured
        });
    }
  }, [success, canceled]);

  async function handleCheckout(priceId: string) {
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/stripe/create-checkout-session", {
        priceId,
      });
      const data = await res.json();
      if (data.sessionUrl) {
        window.location.href = data.sessionUrl;
      }
    } catch (error) {
      toast({
        title: "Token Purchase Failed",
        description: "The AI couldn't even take your money. That's a new low.",
        variant: "destructive",
      });
      setLoading(false);
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
            <CardTitle className="font-serif text-2xl">Tokens Acquired!</CardTitle>
            <CardDescription className="font-serif italic">
              "Money well spent," said no engineer ever about token pricing.
              <br />
              But seriously — thank you. The AI promises to be slightly less sarcastic now.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button variant="outline" onClick={() => setLocation("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to the Cubicle
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
    <div className="h-screen flex flex-col overflow-hidden bg-background">
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
        </div>
      </div>

      {/* Pricing Content — single-screen, no scroll */}
      <div className="flex-1 flex flex-col justify-center max-w-6xl mx-auto px-6 w-full">
        {/* Title */}
        <div className="text-center mb-4">
          <h1 className="font-serif text-3xl font-bold tracking-tight mb-2">
            Feed the AI. It's Hungry.
          </h1>
          <p className="text-muted-foreground text-base max-w-2xl mx-auto">
            Every provocation, challenge, and piece of advice costs tokens.
            Tokens cost money. Money comes from you. It's the circle of AI life.
          </p>
          <RotatingQuote />
        </div>

        {/* Product cards + Comic — side by side */}
        <div className="flex gap-6 items-start mb-4">
          {/* Product column */}
          <div className="flex gap-4 shrink-0">
            {products.map((product, index) => {
              const TierIcon = tierIcons[index % tierIcons.length];
              const perks = tierPerks[index % tierPerks.length];
              return (
                <Card
                  key={product.id}
                  className={`relative flex flex-col transition-transform hover:scale-[1.02] w-[260px] ${
                    index === 1 ? "border-primary/50 shadow-lg" : ""
                  }`}
                >
                  {index === 1 && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground font-mono text-xs">
                        PHB's CHOICE
                      </Badge>
                    </div>
                  )}
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2 mb-1">
                      <TierIcon className="h-4 w-4 text-primary" />
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        {product.type === "one_time" ? "One-time" : "Recurring"}
                      </Badge>
                    </div>
                    <CardTitle className="font-serif text-lg">{product.name}</CardTitle>
                    <CardDescription className="text-xs">{product.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 pt-0">
                    <div className="mb-1">
                      <span className="text-3xl font-bold">
                        ${(product.amount / 100).toFixed(product.amount % 100 === 0 ? 0 : 2)}
                      </span>
                      <span className="text-muted-foreground ml-1 text-sm">
                        {product.type === "one_time" ? "one-time" : "/month"}
                      </span>
                    </div>
                    <TokenMeter amount={product.amount} />
                    <ul className="space-y-1.5 text-xs text-muted-foreground mt-3">
                      {perks.map((perk, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <Check className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                          {perk}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter className="pt-0">
                    <Button
                      className="w-full"
                      size="sm"
                      onClick={() => handleCheckout(product.priceId)}
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Taking your money...
                        </>
                      ) : (
                        <>
                          {index === 0
                            ? "Sacrifice a Coffee"
                            : index === 1
                            ? "Appease the AI"
                            : "Go Full Wally"}
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}

            {products.length === 0 && (
              <div className="w-[260px] text-center text-muted-foreground py-8">
                <pre className="text-xs leading-tight font-mono mb-3 mx-auto inline-block select-none">
{`   ┌─────┐
   │ .  . │
   │  __  │
   │ /  \\ │
   └──┬──┘
      │
   ┌──┴──┐
   │zzz  │
   └─────┘`}
                </pre>
                <p className="font-mono text-xs">Loading token packages...</p>
                <Loader2 className="h-4 w-4 animate-spin mx-auto mt-2" />
              </div>
            )}
          </div>

          {/* Comic strip — fills remaining space */}
          <div className="flex-1 min-w-0">
            <DilbertComicStrip />
          </div>
        </div>

        {/* Footer quip */}
        <div className="text-center text-[11px] text-muted-foreground font-mono space-y-0.5 shrink-0">
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
