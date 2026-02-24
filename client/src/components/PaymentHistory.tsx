import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Receipt } from "lucide-react";

interface Payment {
  id: number;
  stripeSessionId: string;
  amount: number | null;
  currency: string | null;
  status: string;
  priceId: string | null;
  createdAt: string | null;
}

export function PaymentHistory() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest("GET", "/api/stripe/payments")
      .then((res) => res.json())
      .then((data) => {
        setPayments(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load payment history");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
        <Receipt className="h-8 w-8 opacity-40" />
        <p className="text-sm">No payments yet</p>
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-[400px]">
      <div className="space-y-3">
        {payments.map((payment) => (
          <div
            key={payment.id}
            className="flex items-center justify-between rounded-lg border px-4 py-3"
          >
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {payment.amount != null
                  ? `$${(payment.amount / 100).toFixed(2)}`
                  : "—"}
                {payment.currency ? ` ${payment.currency.toUpperCase()}` : ""}
              </p>
              {payment.createdAt && (
                <p className="text-xs text-muted-foreground">
                  {new Date(payment.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              )}
            </div>
            <Badge
              variant={
                payment.status === "completed"
                  ? "default"
                  : payment.status === "pending"
                    ? "secondary"
                    : "destructive"
              }
            >
              {payment.status}
            </Badge>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
