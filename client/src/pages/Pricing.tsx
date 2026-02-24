import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowLeft, Coffee, Loader2 } from "lucide-react";
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

export default function Pricing() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<StripeProduct[]>([]);

  // Read URL search params for success/cancel state
  const params = new URLSearchParams(window.location.search);
  const success = params.get("success") === "true";
  const canceled = params.get("canceled") === "true";

  // Fetch available products from server
  useEffect(() => {
    if (!success && !canceled) {
      apiRequest("GET", "/api/stripe/config")
        .then((res) => res.json())
        .then((data) => setProducts(data.products || []))
        .catch(() => {
          // Stripe not configured — show page without products
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
        title: "Error",
        description: "Failed to start checkout. Please try again.",
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
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
              <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="font-serif text-2xl">Thank you!</CardTitle>
            <CardDescription>
              Your payment was successful. We appreciate your support.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button variant="outline" onClick={() => setLocation("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Workspace
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
            <CardTitle className="font-serif text-2xl">Payment canceled</CardTitle>
            <CardDescription>
              No worries — you can try again whenever you're ready.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center gap-3">
            <Button variant="outline" onClick={() => setLocation("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Workspace
            </Button>
            <Button onClick={() => {
              window.history.replaceState({}, "", "/pricing");
              window.location.reload();
            }}>
              View Plans
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="font-serif text-lg font-bold text-foreground">Provocations</span>
          </button>
        </div>
      </div>

      {/* Pricing Content */}
      <div className="max-w-5xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="font-serif text-4xl font-bold tracking-tight mb-4">
            Support Provocations
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Provocations is a tool that makes you think deeper. If it's helping you
            create better work, consider supporting its continued development.
          </p>
        </div>

        {/* Product Grid — dynamically rendered from server config */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {products.map((product) => (
            <Card key={product.id} className="relative flex flex-col">
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Coffee className="h-5 w-5 text-primary" />
                  <Badge variant="secondary">
                    {product.type === "one_time" ? "One-time" : "Recurring"}
                  </Badge>
                </div>
                <CardTitle className="font-serif text-xl">{product.name}</CardTitle>
                <CardDescription>{product.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="mb-6">
                  <span className="text-4xl font-bold">
                    ${(product.amount / 100).toFixed(product.amount % 100 === 0 ? 0 : 2)}
                  </span>
                  <span className="text-muted-foreground ml-1">
                    {product.type === "one_time" ? "one-time" : "/month"}
                  </span>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    Support independent development
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    Help keep the tool free for everyone
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    Our gratitude and appreciation
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  onClick={() => handleCheckout(product.priceId)}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Redirecting...
                    </>
                  ) : (
                    product.name
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))}

          {products.length === 0 && (
            <div className="col-span-full text-center text-muted-foreground py-8">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3" />
              Loading plans...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
