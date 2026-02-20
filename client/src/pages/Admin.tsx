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
  ChevronRight,
  ChevronDown,
  Circle,
} from "lucide-react";
import { Link } from "wouter";
import { useState, useCallback } from "react";
import type {
  AdminDashboardData,
  PersonaUsageStat,
  UserMetricsMatrix,
  Persona,
} from "@shared/schema";
import { getAllPersonas, getPersonasByDomain } from "@shared/personas";

export default function Admin() {
  const { isAdmin, isLoading: roleLoading } = useRole();

  const { data: dashboard, isLoading: dashLoading } = useQuery<AdminDashboardData>({
    queryKey: ["/api/admin/dashboard"],
    queryFn: () => apiRequest("GET", "/api/admin/dashboard").then((r) => r.json()),
    refetchInterval: 30_000,
    enabled: isAdmin,
  });

  const { data: staleData } = useQuery<{ stalePersonas: { id: string; label: string; domain: string; lastResearchedAt: string | null }[] }>({
    queryKey: ["/api/personas/stale"],
    queryFn: () => apiRequest("GET", "/api/personas/stale").then((r) => r.json()),
    enabled: isAdmin,
  });

  const { data: userMetrics, isLoading: metricsLoading } = useQuery<UserMetricsMatrix>({
    queryKey: ["/api/admin/user-metrics"],
    queryFn: () => apiRequest("GET", "/api/admin/user-metrics").then((r) => r.json()),
    refetchInterval: 30_000,
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
          <TabsList className="grid w-full grid-cols-3 max-w-xl">
            <TabsTrigger value="dashboard" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="user-metrics" className="gap-2">
              <Users className="w-4 h-4" />
              User Metrics
            </TabsTrigger>
            <TabsTrigger value="personas" className="gap-2">
              <FolderTree className="w-4 h-4" />
              Personas
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
          {/* Tab 2: User Metrics Matrix               */}
          {/* ════════════════════════════════════════ */}
          <TabsContent value="user-metrics" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="w-4 h-4" />
                  User Metrics Matrix
                </CardTitle>
              </CardHeader>
              <CardContent>
                {metricsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : userMetrics?.users?.length ? (
                  <UserMetricsTable data={userMetrics} />
                ) : (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No usage metrics recorded yet. Metrics are captured when users save or copy documents.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ════════════════════════════════════════ */}
          {/* Tab 3: Persona Hierarchy                 */}
          {/* ════════════════════════════════════════ */}
          <TabsContent value="personas" className="space-y-6 mt-6">
            {/* Interactive Node Diagram */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FolderTree className="w-4 h-4" />
                  Persona Hierarchy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PersonaNodeDiagram stalePersonas={staleData?.stalePersonas} />
              </CardContent>
            </Card>

            {/* Research Trigger */}
            <ResearchTriggerCard />

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

// ── Node diagram domain config ──

const DOMAIN_META: Record<string, { label: string; color: string; bgColor: string; borderColor: string; ringColor: string; count?: number }> = {
  business: {
    label: "Business",
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-50 dark:bg-orange-950/40",
    borderColor: "border-orange-300 dark:border-orange-700",
    ringColor: "ring-orange-400",
  },
  technology: {
    label: "Technology",
    color: "text-cyan-600 dark:text-cyan-400",
    bgColor: "bg-cyan-50 dark:bg-cyan-950/40",
    borderColor: "border-cyan-300 dark:border-cyan-700",
    ringColor: "ring-cyan-400",
  },
  marketing: {
    label: "Marketing",
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-950/40",
    borderColor: "border-green-300 dark:border-green-700",
    ringColor: "ring-green-400",
  },
};

interface StaleInfo {
  id: string;
  label: string;
  domain: string;
  lastResearchedAt: string | null;
}

function PersonaNodeDiagram({ stalePersonas }: { stalePersonas?: StaleInfo[] }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    root: true,
    business: true,
    technology: true,
    marketing: true,
  });
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);

  const toggleNode = useCallback((id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const staleSet = new Set(stalePersonas?.map((s) => s.id) ?? []);

  const businessPersonas = getPersonasByDomain("business");
  const techPersonas = getPersonasByDomain("technology");
  const marketingPersonas = getPersonasByDomain("marketing");

  const domains = [
    { id: "business", personas: businessPersonas },
    { id: "technology", personas: techPersonas },
    { id: "marketing", personas: marketingPersonas },
  ];

  return (
    <div className="space-y-1">
      {/* Root node */}
      <button
        onClick={() => toggleNode("root")}
        className="flex items-center gap-2 w-full text-left px-3 py-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-300 dark:border-indigo-700 hover:bg-indigo-100 dark:hover:bg-indigo-950/60 transition-colors"
      >
        {expanded.root ? (
          <ChevronDown className="w-4 h-4 text-indigo-500 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-indigo-500 shrink-0" />
        )}
        <FlaskConical className="w-4 h-4 text-indigo-500 shrink-0" />
        <span className="font-semibold text-sm text-indigo-700 dark:text-indigo-300">
          Master Researcher
        </span>
        <span className="text-xs text-indigo-500/70 dark:text-indigo-400/60 hidden sm:inline ml-1">
          Root orchestrator
        </span>
        <Badge variant="outline" className="ml-auto text-[10px] text-indigo-500 border-indigo-300 dark:border-indigo-600">
          {businessPersonas.length + techPersonas.length + marketingPersonas.length} personas
        </Badge>
      </button>

      {/* Domain branches */}
      {expanded.root && (
        <div className="ml-4 border-l-2 border-indigo-200 dark:border-indigo-800">
          {domains.map(({ id: domainId, personas }) => {
            const meta = DOMAIN_META[domainId];
            if (!meta) return null;
            const isExpanded = expanded[domainId];

            return (
              <div key={domainId} className="ml-4 mt-1">
                {/* Connector stub */}
                <div className="relative">
                  <div className="absolute -left-4 top-1/2 w-4 h-px bg-indigo-200 dark:bg-indigo-800" />
                </div>

                {/* Domain node */}
                <button
                  onClick={() => toggleNode(domainId)}
                  className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg border ${meta.bgColor} ${meta.borderColor} hover:opacity-90 transition-all`}
                >
                  {isExpanded ? (
                    <ChevronDown className={`w-4 h-4 ${meta.color} shrink-0`} />
                  ) : (
                    <ChevronRight className={`w-4 h-4 ${meta.color} shrink-0`} />
                  )}
                  <span className={`font-semibold text-sm ${meta.color}`}>
                    {meta.label}
                  </span>
                  <Badge variant="outline" className={`ml-auto text-[10px] ${meta.color}`}>
                    {personas.length}
                  </Badge>
                </button>

                {/* Persona leaf nodes */}
                {isExpanded && (
                  <div className={`ml-4 border-l-2 ${meta.borderColor.replace("border-", "border-l-")}`}>
                    {personas.map((persona) => {
                      const isStale = staleSet.has(persona.id);
                      const isSelected = selectedPersona?.id === persona.id;
                      const staleInfo = stalePersonas?.find((s) => s.id === persona.id);

                      return (
                        <div key={persona.id} className="ml-4 mt-0.5 relative">
                          {/* Connector */}
                          <div className={`absolute -left-4 top-1/2 w-4 h-px ${meta.borderColor.replace("border-", "bg-").replace("dark:border-", "dark:bg-")}`} />

                          <button
                            onClick={() => setSelectedPersona(isSelected ? null : persona)}
                            className={`flex items-center gap-2 w-full text-left px-3 py-1.5 rounded-md transition-all text-sm ${
                              isSelected
                                ? `${meta.bgColor} ring-1 ${meta.ringColor}`
                                : "hover:bg-muted/60"
                            }`}
                          >
                            <Circle className={`w-2 h-2 shrink-0 ${meta.color}`} style={{ fill: "currentColor" }} />
                            <span className="font-medium">{persona.label}</span>
                            {isStale && (
                              <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" title="Stale — needs refresh" />
                            )}
                            <span className="text-[11px] text-muted-foreground truncate hidden sm:inline ml-auto max-w-[40%] text-right">
                              {staleInfo?.lastResearchedAt
                                ? new Date(staleInfo.lastResearchedAt).toLocaleDateString()
                                : "—"}
                            </span>
                          </button>

                          {/* Expanded persona detail */}
                          {isSelected && (
                            <div className={`ml-5 mt-1 mb-2 p-3 rounded-md border ${meta.borderColor} ${meta.bgColor} space-y-2`}>
                              <p className="text-xs font-medium">{persona.role}</p>
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                {persona.description}
                              </p>
                              <div className="grid grid-cols-2 gap-3 pt-1">
                                <div>
                                  <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-0.5">
                                    Challenge
                                  </div>
                                  <p className="text-[11px] text-muted-foreground">
                                    {persona.summary.challenge}
                                  </p>
                                </div>
                                <div>
                                  <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-0.5">
                                    Advice
                                  </div>
                                  <p className="text-[11px] text-muted-foreground">
                                    {persona.summary.advice}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
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

/** Human-readable labels and descriptions for metric keys */
const METRIC_META: Record<string, { label: string; description: string; unit?: string }> = {
  time_saved_minutes: {
    label: "Time Saved",
    description: "Estimated minutes saved through AI collaboration vs. writing from scratch (19 WPM composition speed + reading time)",
    unit: "min",
  },
  author_words: {
    label: "Author Words",
    description: "Words shaped by the user through iterative AI collaboration (total words − first draft words)",
  },
  documents_saved: {
    label: "Docs Saved",
    description: "Number of times the user saved a document to storage",
  },
  documents_copied: {
    label: "Docs Copied",
    description: "Number of times the user copied a document to clipboard",
  },
  total_words_produced: {
    label: "Total Words",
    description: "Cumulative word count across all saved/copied documents",
  },
};

function UserMetricsTable({ data }: { data: UserMetricsMatrix }) {
  return (
    <div className="overflow-x-auto -mx-6">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left px-4 py-2.5 font-semibold sticky left-0 bg-card z-10 min-w-[180px]">
              User
            </th>
            {data.metricKeys.map((key) => {
              const meta = METRIC_META[key];
              return (
                <th
                  key={key}
                  className="text-right px-3 py-2.5 font-medium whitespace-nowrap"
                  title={meta?.description || key}
                >
                  <span className="cursor-help border-b border-dotted border-muted-foreground/40">
                    {meta?.label || key}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {data.users.map((user) => (
            <tr key={user.userId} className="border-b last:border-0 hover:bg-muted/30">
              <td className="px-4 py-2 sticky left-0 bg-card z-10">
                <div className="font-medium truncate max-w-[180px]" title={user.email}>
                  {user.displayName}
                </div>
                <div className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                  {user.email}
                </div>
              </td>
              {data.metricKeys.map((key) => {
                const val = user.metrics[key] ?? 0;
                const meta = METRIC_META[key];
                return (
                  <td key={key} className="text-right px-3 py-2 tabular-nums whitespace-nowrap">
                    {val > 0 ? (
                      <span>
                        {val.toLocaleString()}
                        {meta?.unit && (
                          <span className="text-[10px] text-muted-foreground ml-0.5">
                            {meta.unit}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
