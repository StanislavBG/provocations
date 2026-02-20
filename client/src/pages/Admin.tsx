import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  Users,
  Activity,
  Database,
  FolderTree,
  Clock,
  FlaskConical,
  AlertTriangle,
} from "lucide-react";
import { Link } from "wouter";
import type {
  AdminDashboardData,
  PersonaUsageStat,
  TrackingEventStat,
} from "@shared/schema";

interface PersonaHierarchyNode {
  persona: {
    id: string;
    label: string;
    domain: string;
    icon: string;
    role: string;
    lastResearchedAt: string | null;
  };
  children: PersonaHierarchyNode[];
}

export default function Admin() {
  const { data: dashboard, isLoading: dashLoading } = useQuery<AdminDashboardData>({
    queryKey: ["/api/admin/dashboard"],
    queryFn: () => apiRequest("GET", "/api/admin/dashboard").then((r) => r.json()),
    refetchInterval: 30_000,
  });

  const { data: hierarchy } = useQuery<PersonaHierarchyNode>({
    queryKey: ["/api/personas/hierarchy"],
    queryFn: () => apiRequest("GET", "/api/personas/hierarchy").then((r) => r.json()),
  });

  const { data: staleData } = useQuery<{ stalePersonas: { id: string; label: string; domain: string; lastResearchedAt: string | null }[] }>({
    queryKey: ["/api/personas/stale"],
    queryFn: () => apiRequest("GET", "/api/personas/stale").then((r) => r.json()),
  });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold font-serif">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Persona hierarchy, usage metrics, and tracking overview
            </p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            icon={<Activity className="w-4 h-4" />}
            label="Total Events"
            value={dashboard?.totalEvents ?? 0}
            loading={dashLoading}
          />
          <KpiCard
            icon={<Users className="w-4 h-4" />}
            label="Total Sessions"
            value={dashboard?.totalSessions ?? 0}
            loading={dashLoading}
          />
          <KpiCard
            icon={<Clock className="w-4 h-4" />}
            label="Avg Write Time"
            value={dashboard?.avgDocumentGenerationMs ? `${(dashboard.avgDocumentGenerationMs / 1000).toFixed(1)}s` : "—"}
            loading={dashLoading}
          />
          <KpiCard
            icon={<Database className="w-4 h-4" />}
            label="Documents"
            value={dashboard?.storageMetadata?.documentCount ?? 0}
            loading={dashLoading}
          />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Persona Hierarchy Tree */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FolderTree className="w-4 h-4" />
                Persona Hierarchy
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hierarchy ? (
                <HierarchyTree node={hierarchy} depth={0} />
              ) : (
                <p className="text-sm text-muted-foreground">Loading hierarchy...</p>
              )}
            </CardContent>
          </Card>

          {/* Stale Personas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Stale Personas ({staleData?.stalePersonas?.length ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {staleData?.stalePersonas?.length ? (
                <div className="space-y-2">
                  {staleData.stalePersonas.map((p) => (
                    <div key={p.id} className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/50 text-sm">
                      <span className="font-medium">{p.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {p.lastResearchedAt
                          ? `Last: ${new Date(p.lastResearchedAt).toLocaleDateString()}`
                          : "Never researched"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">All personas are up to date.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Persona Usage (KPI) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FlaskConical className="w-4 h-4" />
                Persona Usage Frequency
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboard?.personaUsage?.length ? (
                <div className="space-y-2">
                  {dashboard.personaUsage.map((p) => (
                    <UsageBar key={p.personaId} stat={p} maxCount={dashboard.personaUsage[0].usageCount} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No persona usage data yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Event Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="w-4 h-4" />
                Event Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboard?.eventBreakdown?.length ? (
                <div className="space-y-1.5">
                  {dashboard.eventBreakdown.map((e) => (
                    <div key={e.eventType} className="flex items-center justify-between text-sm py-1">
                      <span className="font-mono text-xs">{e.eventType}</span>
                      <span className="font-medium tabular-nums">{e.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No events recorded yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Storage Metadata */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="w-4 h-4" />
              Storage Metadata
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{dashboard?.storageMetadata?.documentCount ?? 0}</div>
                <div className="text-xs text-muted-foreground">Documents</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{dashboard?.storageMetadata?.folderCount ?? 0}</div>
                <div className="text-xs text-muted-foreground">Folders</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{dashboard?.storageMetadata?.maxFolderDepth ?? 0}</div>
                <div className="text-xs text-muted-foreground">Max Folder Depth</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Sub-components ──

function KpiCard({ icon, label, value, loading }: { icon: React.ReactNode; label: string; value: number | string; loading: boolean }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {icon}
          <span className="text-xs font-medium">{label}</span>
        </div>
        <div className="text-2xl font-bold tabular-nums">
          {loading ? "..." : value}
        </div>
      </CardContent>
    </Card>
  );
}

function HierarchyTree({ node, depth }: { node: PersonaHierarchyNode; depth: number }) {
  const domainColors: Record<string, string> = {
    root: "text-indigo-500",
    business: "text-orange-500",
    technology: "text-cyan-500",
  };

  return (
    <div className={depth > 0 ? "ml-4 border-l border-border pl-3" : ""}>
      <div className="flex items-center gap-2 py-1">
        <span className={`text-xs font-medium uppercase ${domainColors[node.persona.domain] ?? "text-muted-foreground"}`}>
          {node.persona.domain}
        </span>
        <span className="font-medium text-sm">{node.persona.label}</span>
        <span className="text-xs text-muted-foreground truncate">{node.persona.role}</span>
      </div>
      {node.children.map((child) => (
        <HierarchyTree key={child.persona.id} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

function UsageBar({ stat, maxCount }: { stat: PersonaUsageStat; maxCount: number }) {
  const pct = maxCount > 0 ? (stat.usageCount / maxCount) * 100 : 0;
  const domainColors: Record<string, string> = {
    business: "bg-orange-500",
    technology: "bg-cyan-500",
    root: "bg-indigo-500",
  };

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{stat.personaLabel}</span>
        <span className="text-xs text-muted-foreground tabular-nums">{stat.usageCount}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${domainColors[stat.domain] ?? "bg-primary"}`}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
    </div>
  );
}
