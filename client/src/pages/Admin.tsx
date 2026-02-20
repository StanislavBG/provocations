import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Users,
  Activity,
  Database,
  FolderTree,
  Clock,
  FlaskConical,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Shield,
  BarChart3,
  FileText,
} from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import type {
  AdminDashboardData,
  PersonaUsageStat,
  Persona,
} from "@shared/schema";
import { getAllPersonas } from "@shared/personas";

interface PersonaHierarchyNode {
  persona: {
    id: string;
    label: string;
    domain: string;
    icon: string;
    role: string;
    description: string;
    lastResearchedAt: string | null;
  };
  children: PersonaHierarchyNode[];
}

export default function Admin() {
  const { isAdmin, isLoading: roleLoading } = useRole();

  const { data: dashboard, isLoading: dashLoading } = useQuery<AdminDashboardData>({
    queryKey: ["/api/admin/dashboard"],
    queryFn: () => apiRequest("GET", "/api/admin/dashboard").then((r) => r.json()),
    refetchInterval: 30_000,
    enabled: isAdmin,
  });

  const { data: hierarchy } = useQuery<PersonaHierarchyNode>({
    queryKey: ["/api/personas/hierarchy"],
    queryFn: () => apiRequest("GET", "/api/personas/hierarchy").then((r) => r.json()),
    enabled: isAdmin,
  });

  const { data: staleData } = useQuery<{ stalePersonas: { id: string; label: string; domain: string; lastResearchedAt: string | null }[] }>({
    queryKey: ["/api/personas/stale"],
    queryFn: () => apiRequest("GET", "/api/personas/stale").then((r) => r.json()),
    enabled: isAdmin,
  });

  // Loading state
  if (roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Access denied
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <Shield className="w-12 h-12 text-muted-foreground mx-auto" />
          <h1 className="text-xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">You do not have permission to view this page.</p>
          <Link href="/">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Workspace
            </Button>
          </Link>
        </div>
      </div>
    );
  }

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
              Usage analytics, persona hierarchy, and research management
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="dashboard">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="dashboard" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Usability Dashboard
            </TabsTrigger>
            <TabsTrigger value="personas" className="gap-2">
              <FolderTree className="w-4 h-4" />
              Persona Hierarchy
            </TabsTrigger>
          </TabsList>

          {/* ════════════════════════════════════════ */}
          {/* Tab 1: Usability Dashboard               */}
          {/* ════════════════════════════════════════ */}
          <TabsContent value="dashboard" className="space-y-6 mt-6">
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
              {/* Persona Usage */}
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
          </TabsContent>

          {/* ════════════════════════════════════════ */}
          {/* Tab 2: Persona Hierarchy                 */}
          {/* ════════════════════════════════════════ */}
          <TabsContent value="personas" className="space-y-6 mt-6">
            <div className="grid md:grid-cols-3 gap-6">
              {/* Hierarchy Tree */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FolderTree className="w-4 h-4" />
                    Full Hierarchy
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

              {/* Stale Personas + Research Trigger */}
              <div className="space-y-6">
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
                                : "Never"}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">All personas are up to date.</p>
                    )}
                  </CardContent>
                </Card>

                <ResearchTriggerCard />
              </div>
            </div>

            {/* Full Persona Descriptions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="w-4 h-4" />
                  Persona Definitions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PersonaDefinitionList />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
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

const domainColors: Record<string, string> = {
  root: "text-indigo-500",
  business: "text-orange-500",
  technology: "text-cyan-500",
  marketing: "text-green-500",
};

const domainBgColors: Record<string, string> = {
  root: "bg-indigo-500",
  business: "bg-orange-500",
  technology: "bg-cyan-500",
  marketing: "bg-green-500",
};

function HierarchyTree({ node, depth }: { node: PersonaHierarchyNode; depth: number }) {
  return (
    <div className={depth > 0 ? "ml-4 border-l border-border pl-3" : ""}>
      <div className="flex items-center gap-2 py-1.5">
        <Badge variant="outline" className={`text-[10px] uppercase ${domainColors[node.persona.domain] ?? "text-muted-foreground"}`}>
          {node.persona.domain}
        </Badge>
        <span className="font-medium text-sm">{node.persona.label}</span>
        <span className="text-xs text-muted-foreground truncate hidden sm:inline">{node.persona.role}</span>
      </div>
      {node.children.map((child) => (
        <HierarchyTree key={child.persona.id} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

function UsageBar({ stat, maxCount }: { stat: PersonaUsageStat; maxCount: number }) {
  const pct = maxCount > 0 ? (stat.usageCount / maxCount) * 100 : 0;

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{stat.personaLabel}</span>
        <span className="text-xs text-muted-foreground tabular-nums">{stat.usageCount}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${domainBgColors[stat.domain] ?? "bg-primary"}`}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
    </div>
  );
}

function ResearchTriggerCard() {
  const [isTriggering, setIsTriggering] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleTrigger = async () => {
    setIsTriggering(true);
    setResult(null);
    try {
      const response = await apiRequest("POST", "/api/generate-challenges", {
        document: "Current persona hierarchy evaluation request. The Master Researcher should analyze all domains (business, technology, marketing) for completeness, freshness, and coverage gaps.",
        objective: "Evaluate and refresh the persona hierarchy. Identify missing knowledge worker roles, stale definitions, and domain coverage gaps.",
        selectedPersonas: ["master_researcher"],
      });
      const data = await response.json();
      if (data.challenges?.length > 0) {
        setResult(data.challenges[0].content);
      } else {
        setResult("Master Researcher returned no findings.");
      }
    } catch {
      setResult("Failed to trigger research. Check server logs.");
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical className="w-4 h-4 text-indigo-500" />
          Ad-Hoc Research
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Trigger the Master Researcher to evaluate the persona hierarchy for completeness, freshness, and domain coverage.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleTrigger}
          disabled={isTriggering}
          className="w-full gap-2"
        >
          {isTriggering ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Researching...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Trigger Master Researcher
            </>
          )}
        </Button>
        {result && (
          <div className="mt-3 p-3 rounded-md bg-muted/50 text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">
            {result}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PersonaDefinitionList() {
  const personas = getAllPersonas();
  const grouped = {
    business: personas.filter((p) => p.domain === "business"),
    technology: personas.filter((p) => p.domain === "technology"),
    marketing: personas.filter((p) => p.domain === "marketing"),
  };

  return (
    <div className="space-y-6">
      {(Object.entries(grouped) as [string, Persona[]][]).map(([domain, list]) => (
        <div key={domain}>
          <h3 className={`text-sm font-semibold uppercase mb-3 ${domainColors[domain] ?? "text-muted-foreground"}`}>
            {domain} Domain ({list.length})
          </h3>
          <div className="space-y-3">
            {list.map((p) => (
              <div key={p.id} className="border rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{p.label}</span>
                  <Badge variant="secondary" className="text-[10px]">{p.id}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{p.role}</p>
                <p className="text-xs">{p.description}</p>
                <div className="flex gap-4 mt-2">
                  <div className="flex-1">
                    <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Challenge Focus</div>
                    <p className="text-xs text-muted-foreground">{p.summary.challenge}</p>
                  </div>
                  <div className="flex-1">
                    <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Advice Focus</div>
                    <p className="text-xs text-muted-foreground">{p.summary.advice}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
