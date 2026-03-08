import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  CreditCard,
  Crown,
  ExternalLink,
  Loader2,
  Sparkles,
  Zap,
  ImageIcon,
  Mic,
  HardDrive,
  BrainCircuit,
  CheckCircle2,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface BillingStatus {
  plan: "free" | "pro" | "team";
  limits: {
    llmCallsPerDay: number;
    ttsMinsPerMonth: number;
    imagesPerDay: number;
    storageMb: number;
    canvases: number;
    nodesPerCanvas: number;
  };
  usage: {
    llmCallsToday: number;
    ttsMinutesThisMonth: number;
    imagesToday: number;
    storageMb: number;
  };
  subscription: {
    stripeSubscriptionId: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    status: string;
  } | null;
}

const planLabels: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  team: "Team",
};

const planPrices: Record<string, string> = {
  free: "$0",
  pro: "$19/mo",
  team: "$39/user/mo",
};

const planIcons: Record<string, typeof Zap> = {
  free: Zap,
  pro: Sparkles,
  team: Crown,
};

function UsageBar({
  label,
  icon: Icon,
  current,
  limit,
  unit,
}: {
  label: string;
  icon: typeof Zap;
  current: number;
  limit: number;
  unit: string;
}) {
  const isUnlimited = !isFinite(limit);
  const percentage = isUnlimited ? 0 : limit === 0 ? 100 : Math.min((current / limit) * 100, 100);
  const isWarning = percentage >= 80 && percentage < 100;
  const isExceeded = percentage >= 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{label}</span>
        </div>
        <span className={`text-xs font-mono ${isExceeded ? "text-destructive" : isWarning ? "text-yellow-600 dark:text-yellow-400" : "text-muted-foreground"}`}>
          {isUnlimited ? `${current} ${unit}` : `${current} / ${limit} ${unit}`}
        </span>
      </div>
      {!isUnlimited && (
        <Progress
          value={percentage}
          className={`h-2 ${isExceeded ? "[&>div]:bg-destructive" : isWarning ? "[&>div]:bg-yellow-500" : ""}`}
        />
      )}
      {isUnlimited && (
        <div className="text-xs text-muted-foreground/60 italic">Unlimited</div>
      )}
    </div>
  );
}

export default function Billing() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const success = params.get("success") === "true";

  useEffect(() => {
    apiRequest("GET", "/api/billing/status")
      .then((res) => res.json())
      .then((data) => setStatus(data))
      .catch(() => {
        // Default to free plan if billing not configured
        setStatus({
          plan: "free",
          limits: {
            llmCallsPerDay: 25,
            ttsMinsPerMonth: 0,
            imagesPerDay: 5,
            storageMb: 100,
            canvases: 3,
            nodesPerCanvas: 15,
          },
          usage: {
            llmCallsToday: 0,
            ttsMinutesThisMonth: 0,
            imagesToday: 0,
            storageMb: 0,
          },
          subscription: null,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (success) {
      toast({
        title: "Subscription activated",
        description: "Welcome to your new plan. Your limits have been updated.",
      });
      // Clean URL
      window.history.replaceState({}, "", "/settings/billing");
    }
  }, [success, toast]);

  async function handlePortal() {
    setPortalLoading(true);
    try {
      const res = await apiRequest("GET", "/api/billing/portal");
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      toast({
        title: "Could not open billing portal",
        description: "No billing account found. Subscribe to a plan first.",
        variant: "destructive",
      });
    } finally {
      setPortalLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!status) return null;

  const PlanIcon = planIcons[status.plan] || Zap;
  const renewalDate = status.subscription?.currentPeriodEnd
    ? new Date(status.subscription.currentPeriodEnd).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="font-serif text-lg font-bold text-foreground">Provocations</span>
          </button>
          <span className="text-sm text-muted-foreground">Billing</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Current Plan */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <PlanIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="font-serif text-xl">
                    {planLabels[status.plan]} Plan
                  </CardTitle>
                  <CardDescription>
                    {planPrices[status.plan]}
                    {renewalDate && ` \u00b7 Renews ${renewalDate}`}
                    {status.subscription?.cancelAtPeriodEnd && (
                      <span className="text-destructive ml-2">(Cancels at period end)</span>
                    )}
                  </CardDescription>
                </div>
              </div>
              {status.subscription?.status === "past_due" && (
                <Badge variant="destructive">Past Due</Badge>
              )}
              {status.subscription?.status === "active" && (
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Active
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardFooter className="gap-3">
            {status.plan === "free" ? (
              <Button onClick={() => setLocation("/pricing")}>
                <Sparkles className="mr-2 h-4 w-4" />
                Upgrade Plan
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setLocation("/pricing")}>
                  Change Plan
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" className="text-destructive hover:text-destructive">
                      Cancel Subscription
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel your subscription?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Your plan will remain active until the end of your current billing period
                        {renewalDate ? ` (${renewalDate})` : ""}. After that, you will be downgraded
                        to the Free plan with reduced limits.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={handlePortal}
                      >
                        Cancel via Stripe
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </CardFooter>
        </Card>

        {/* Usage Dashboard */}
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">Usage Dashboard</CardTitle>
            <CardDescription>
              {status.plan === "free"
                ? "Your current resource usage on the Free plan"
                : "Track your resource consumption this billing period"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <UsageBar
              label="LLM Calls"
              icon={BrainCircuit}
              current={status.usage.llmCallsToday}
              limit={status.limits.llmCallsPerDay}
              unit="today"
            />
            <UsageBar
              label="Text-to-Speech"
              icon={Mic}
              current={status.usage.ttsMinutesThisMonth}
              limit={status.limits.ttsMinsPerMonth}
              unit="min this month"
            />
            <UsageBar
              label="Image Generation"
              icon={ImageIcon}
              current={status.usage.imagesToday}
              limit={status.limits.imagesPerDay}
              unit="today"
            />
            <UsageBar
              label="Storage"
              icon={HardDrive}
              current={status.usage.storageMb}
              limit={status.limits.storageMb}
              unit="MB"
            />
          </CardContent>
        </Card>

        {/* Payment Method */}
        {status.subscription?.stripeSubscriptionId && (
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-lg">Payment Method</CardTitle>
              <CardDescription>
                Manage your payment method, view invoices, and update billing details via Stripe
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button variant="outline" onClick={handlePortal} disabled={portalLoading}>
                {portalLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="mr-2 h-4 w-4" />
                )}
                Open Billing Portal
                <ExternalLink className="ml-2 h-3 w-3" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Plan Comparison */}
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">Plan Limits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 pr-4 font-medium">Feature</th>
                    <th className="text-center py-2 px-4 font-medium">Free</th>
                    <th className="text-center py-2 px-4 font-medium">Pro</th>
                    <th className="text-center py-2 px-4 font-medium">Team</th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  {[
                    ["LLM Calls/Day", "25", "200", "500"],
                    ["TTS Minutes/Month", "0", "50", "200"],
                    ["Images/Day", "5", "50", "200"],
                    ["Storage", "100 MB", "5 GB", "25 GB"],
                    ["Canvases", "3", "\u221e", "\u221e"],
                    ["Nodes/Canvas", "15", "\u221e", "\u221e"],
                  ].map(([feature, free, pro, team]) => (
                    <tr key={feature} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{feature}</td>
                      <td className={`text-center py-2 px-4 ${status.plan === "free" ? "font-bold text-primary" : ""}`}>{free}</td>
                      <td className={`text-center py-2 px-4 ${status.plan === "pro" ? "font-bold text-primary" : ""}`}>{pro}</td>
                      <td className={`text-center py-2 px-4 ${status.plan === "team" ? "font-bold text-primary" : ""}`}>{team}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
