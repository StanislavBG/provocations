import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useRole } from "@/hooks/use-role";
import { useToast } from "@/hooks/use-toast";
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
  Pencil,
  Lock,
  Unlock,
  Workflow,
  RotateCcw,
} from "lucide-react";
import { Link } from "wouter";
import { useState, useCallback } from "react";
import type {
  AdminDashboardData,
  PersonaUsageStat,
  UserMetricsMatrix,
  Persona,
  EventCategoryReport,
} from "@shared/schema";
import { getAllPersonas, getPersonasByDomain } from "@shared/personas";
import { buildAppLaunchUrl } from "@/lib/appLaunchParams";

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

  const { data: eventReport, isLoading: reportLoading } = useQuery<EventCategoryReport>({
    queryKey: ["/api/admin/event-report"],
    queryFn: () => apiRequest("GET", "/api/admin/event-report").then((r) => r.json()),
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
          <TabsList className="grid w-full grid-cols-4 max-w-2xl">
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
            <TabsTrigger value="agents" className="gap-2">
              <Workflow className="w-4 h-4" />
              LLM Agents
            </TabsTrigger>
          </TabsList>

          {/* ════════════════════════════════════════ */}
          {/* Tab 1: Usability Dashboard               */}
          {/* ════════════════════════════════════════ */}
          <TabsContent value="dashboard" className="space-y-6 mt-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <KpiCard
                icon={<Activity className="w-4 h-4" />}
                label="Total Events"
                value={eventReport?.totalEvents ?? dashboard?.totalEvents ?? 0}
                loading={dashLoading && reportLoading}
              />
              <KpiCard
                icon={<Users className="w-4 h-4" />}
                label="Unique Users"
                value={eventReport?.uniqueUsers ?? 0}
                loading={reportLoading}
              />
              <KpiCard
                icon={<Clock className="w-4 h-4" />}
                label="Total Sessions"
                value={eventReport?.totalSessions ?? dashboard?.totalSessions ?? 0}
                loading={dashLoading && reportLoading}
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

            {/* 30-Day Activity Timeline */}
            {eventReport?.dailyTimeline && eventReport.dailyTimeline.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="w-4 h-4" />
                    30-Day Activity Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <DailyTimeline data={eventReport.dailyTimeline} categories={eventReport.categories} />
                </CardContent>
              </Card>
            )}

            {/* Event Categories */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="w-4 h-4" />
                  Usage by Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                {reportLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                ) : eventReport?.categories?.length ? (
                  <EventCategoryGrid categories={eventReport.categories} totalEvents={eventReport.totalEvents} />
                ) : (
                  <p className="text-sm text-muted-foreground">No events recorded yet.</p>
                )}
              </CardContent>
            </Card>

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

              {/* Storage Metadata */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Database className="w-4 h-4" />
                    Storage Overview
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

          {/* ════════════════════════════════════════ */}
          {/* Tab 4: LLM Agents (Prompt Overrides)    */}
          {/* ════════════════════════════════════════ */}
          <TabsContent value="agents" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Workflow className="w-4 h-4" />
                  LLM Task Prompts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AgentPromptList />
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

/** Category grid — shows each event category as a collapsible card */
function EventCategoryGrid({ categories, totalEvents }: { categories: EventCategoryReport["categories"]; totalEvents: number }) {
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {categories.map((cat) => {
        const pct = totalEvents > 0 ? ((cat.totalCount / totalEvents) * 100).toFixed(1) : "0";
        const isExpanded = expandedCat === cat.id;
        return (
          <button
            key={cat.id}
            onClick={() => setExpandedCat(isExpanded ? null : cat.id)}
            className={`text-left p-3 rounded-lg border transition-all hover:shadow-sm ${
              isExpanded ? "ring-2 ring-offset-1 col-span-2 md:col-span-3 lg:col-span-5" : ""
            }`}
            style={{ borderColor: isExpanded ? cat.color : undefined }}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
              <span className="text-xs font-semibold truncate">{cat.label}</span>
              <span className="text-xs text-muted-foreground ml-auto tabular-nums">{pct}%</span>
            </div>
            <div className="text-lg font-bold tabular-nums">{cat.totalCount.toLocaleString()}</div>
            <div className="w-full bg-muted rounded-full h-1 mt-1.5">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.max(Number(pct), 1)}%`, backgroundColor: cat.color }}
              />
            </div>
            {isExpanded && (
              <div className="mt-3 space-y-1 border-t pt-2">
                {cat.events.map((evt) => (
                  <div key={evt.eventType} className="flex items-center justify-between text-xs py-0.5">
                    <span className="font-mono text-muted-foreground">{evt.eventType}</span>
                    <span className="font-medium tabular-nums">{evt.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Stacked bar chart of daily event volume over last 30 days */
function DailyTimeline({ data, categories }: { data: EventCategoryReport["dailyTimeline"]; categories: EventCategoryReport["categories"] }) {
  const maxTotal = Math.max(...data.map((d) => d.total), 1);
  const catColorMap = new Map(categories.map((c) => [c.id, c.color]));
  const catOrder = categories.map((c) => c.id);

  return (
    <div className="space-y-2">
      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs mb-2">
        {categories.slice(0, 8).map((cat) => (
          <div key={cat.id} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
            <span className="text-muted-foreground">{cat.label}</span>
          </div>
        ))}
      </div>
      {/* Bars */}
      <div className="flex items-end gap-[2px] h-32">
        {data.map((day) => {
          const heightPct = (day.total / maxTotal) * 100;
          return (
            <div
              key={day.date}
              className="flex-1 min-w-[4px] flex flex-col justify-end group relative"
              style={{ height: "100%" }}
              title={`${day.date}: ${day.total} events`}
            >
              <div
                className="w-full rounded-t-sm overflow-hidden flex flex-col-reverse"
                style={{ height: `${Math.max(heightPct, 2)}%` }}
              >
                {catOrder.map((catId) => {
                  const catCount = day.byCategory[catId] ?? 0;
                  if (catCount === 0) return null;
                  const segPct = (catCount / day.total) * 100;
                  return (
                    <div
                      key={catId}
                      style={{
                        height: `${segPct}%`,
                        backgroundColor: catColorMap.get(catId) ?? "#94a3b8",
                        minHeight: "1px",
                      }}
                    />
                  );
                })}
              </div>
              {/* Tooltip on hover */}
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-popover border rounded px-1.5 py-0.5 text-[10px] font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-sm">
                {day.date.slice(5)}: {day.total}
              </div>
            </div>
          );
        })}
      </div>
      {/* Date labels */}
      <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
        <span>{data[0]?.date.slice(5)}</span>
        <span>{data[data.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
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
  const { toast } = useToast();
  const queryClient = useQueryClient();
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

  // Fetch override/lock status from DB
  const { data: overridesData } = useQuery<{ overrides: { personaId: string; humanCurated: boolean; curatedAt: string | null }[] }>({
    queryKey: ["/api/admin/persona-overrides"],
    queryFn: () => apiRequest("GET", "/api/admin/persona-overrides").then((r) => r.json()),
  });
  const overrideMap = new Map(
    (overridesData?.overrides ?? []).map((o) => [o.personaId, o])
  );

  // Lock toggle mutation
  const lockMutation = useMutation({
    mutationFn: async ({ personaId, humanCurated }: { personaId: string; humanCurated: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/personas/${personaId}/lock`, { humanCurated });
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/persona-overrides"] });
      toast({ title: vars.humanCurated ? "Persona locked" : "Persona unlocked", description: `${vars.personaId} is now ${vars.humanCurated ? "human-curated (locked)" : "unlocked for auto-refresh"}` });
    },
    onError: () => {
      toast({ title: "Failed to toggle lock", variant: "destructive" });
    },
  });

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
                            {overrideMap.has(persona.id) && overrideMap.get(persona.id)!.humanCurated && (
                              <span title="Human curated — locked"><Lock className="w-3 h-3 text-amber-600 shrink-0" /></span>
                            )}
                            {isStale && (
                              <span title="Stale — needs refresh"><AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" /></span>
                            )}
                            <span className="text-[11px] text-muted-foreground truncate hidden sm:inline ml-auto max-w-[40%] text-right">
                              {staleInfo?.lastResearchedAt
                                ? new Date(staleInfo.lastResearchedAt).toLocaleDateString()
                                : "—"}
                            </span>
                          </button>

                          {/* Expanded persona detail */}
                          {isSelected && (() => {
                            const override = overrideMap.get(persona.id);
                            const isLocked = override?.humanCurated ?? false;
                            const editUrl = buildAppLaunchUrl({
                              app: "persona-definition",
                              intent: "edit",
                              entityType: "persona",
                              entityId: persona.id,
                              step: "draft",
                              source: "admin",
                            });

                            return (
                              <div className={`ml-5 mt-1 mb-2 p-3 rounded-md border ${meta.borderColor} ${meta.bgColor} space-y-2`}>
                                {/* Action buttons */}
                                <div className="flex items-center gap-2 mb-1">
                                  <a href={editUrl}>
                                    <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7">
                                      <Pencil className="w-3 h-3" />
                                      Edit in Workspace
                                    </Button>
                                  </a>
                                  <Button
                                    size="sm"
                                    variant={isLocked ? "default" : "outline"}
                                    className={`gap-1.5 text-xs h-7 ${isLocked ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}`}
                                    onClick={() => lockMutation.mutate({ personaId: persona.id, humanCurated: !isLocked })}
                                    disabled={lockMutation.isPending}
                                  >
                                    {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                                    {isLocked ? "Locked" : "Lock"}
                                  </Button>
                                  {isLocked && override?.curatedAt && (
                                    <span className="text-[10px] text-amber-600 dark:text-amber-400">
                                      Curated {new Date(override.curatedAt).toLocaleDateString()}
                                    </span>
                                  )}
                                  {override && (
                                    <Badge variant="secondary" className="text-[10px] ml-auto">DB Override</Badge>
                                  )}
                                </div>

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
                            );
                          })()}
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

/** Format a timestamp as a human-readable relative time string */
function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

/** Human-readable labels and descriptions for metric keys */
const METRIC_META: Record<string, { label: string; description: string; unit?: string }> = {
  logins: {
    label: "Logins",
    description: "Number of times the user signed in or loaded the app",
  },
  page_views: {
    label: "Page Views",
    description: "Number of workspace page loads (front page visits)",
  },
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
            <th className="text-right px-3 py-2.5 font-medium whitespace-nowrap" title="Most recent activity timestamp">
              <span className="cursor-help border-b border-dotted border-muted-foreground/40">Last Seen</span>
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
              <td className="text-right px-3 py-2 tabular-nums whitespace-nowrap text-xs">
                {user.lastSeenAt ? (
                  <span title={new Date(user.lastSeenAt).toLocaleString()}>
                    {formatRelativeTime(user.lastSeenAt)}
                  </span>
                ) : (
                  <span className="text-muted-foreground/40">—</span>
                )}
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

  // Fetch override status for indicators
  const { data: overridesData } = useQuery<{ overrides: { personaId: string; humanCurated: boolean }[] }>({
    queryKey: ["/api/admin/persona-overrides"],
    queryFn: () => apiRequest("GET", "/api/admin/persona-overrides").then((r) => r.json()),
  });
  const overrideSet = new Set((overridesData?.overrides ?? []).map((o) => o.personaId));
  const lockedSet = new Set((overridesData?.overrides ?? []).filter((o) => o.humanCurated).map((o) => o.personaId));

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
                  {lockedSet.has(p.id) && (
                    <Badge variant="outline" className="text-[10px] gap-1 text-amber-600 border-amber-300">
                      <Lock className="w-2.5 h-2.5" />
                      Locked
                    </Badge>
                  )}
                  {overrideSet.has(p.id) && !lockedSet.has(p.id) && (
                    <Badge variant="outline" className="text-[10px] text-blue-500 border-blue-300">
                      DB Override
                    </Badge>
                  )}
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

// ── Agent Prompt List — shows all 13 LLM task types with edit/lock/revert ──

interface AgentPromptInfo {
  taskType: string;
  group: string;
  description: string;
  currentPrompt: string;
  isOverridden: boolean;
  humanCurated: boolean;
  curatedBy: string | null;
  curatedAt: string | null;
}

function AgentPromptList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: promptsData, isLoading, isError, error } = useQuery<{ prompts: AgentPromptInfo[] }>({
    queryKey: ["/api/admin/agent-prompts"],
    queryFn: () => apiRequest("GET", "/api/admin/agent-prompts").then((r) => r.json()),
    retry: 1,
  });

  const lockMutation = useMutation({
    mutationFn: async ({ taskType, humanCurated }: { taskType: string; humanCurated: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/agent-overrides/${taskType}/lock`, { humanCurated });
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/agent-prompts"] });
      toast({
        title: vars.humanCurated ? "Prompt locked" : "Prompt unlocked",
        description: `${vars.taskType} is now ${vars.humanCurated ? "locked" : "unlocked"}`,
      });
    },
    onError: () => {
      toast({ title: "Failed to toggle lock", variant: "destructive" });
    },
  });

  const revertMutation = useMutation({
    mutationFn: async (taskType: string) => {
      const res = await apiRequest("DELETE", `/api/admin/agent-overrides/${taskType}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/agent-prompts"] });
      toast({ title: "Reverted to code default" });
    },
    onError: () => {
      toast({ title: "Failed to revert", variant: "destructive" });
    },
  });

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  if (isError) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 space-y-2">
        <p className="text-sm font-medium text-destructive">Failed to load LLM agents</p>
        <p className="text-xs text-muted-foreground">
          {error instanceof Error ? error.message : "Unknown error"}. This usually means the database migration hasn't been run. Try running <code className="font-mono bg-muted px-1 rounded">npm run db:push</code> to create the agent_prompt_overrides table.
        </p>
      </div>
    );
  }

  const prompts = promptsData?.prompts ?? [];

  if (prompts.length === 0) {
    return (
      <div className="rounded-md border border-border bg-muted/30 p-4 space-y-2">
        <p className="text-sm font-medium">No LLM agents found</p>
        <p className="text-xs text-muted-foreground">
          The TASK_TYPES array in server/invoke.ts appears to be empty or the API returned no results. Check server logs for details.
        </p>
      </div>
    );
  }

  // Group prompts by their functional category
  const grouped = prompts.reduce<Record<string, AgentPromptInfo[]>>((acc, p) => {
    const g = p.group || "Other";
    (acc[g] ??= []).push(p);
    return acc;
  }, {});

  // Stable group ordering
  const groupOrder = ["Document Writing", "Persona Interactions", "Interview", "Requirements Discovery", "Utilities"];
  const orderedGroups = groupOrder.filter((g) => grouped[g]?.length);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        All LLM task types used across Provocations, grouped by function. Edit the system prompt to customize behavior.
      </p>
      {orderedGroups.map((groupName) => {
        const groupPrompts = grouped[groupName];
        return (
          <div key={groupName} className="space-y-2">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold">{groupName}</h4>
              <Badge variant="outline" className="text-[10px]">{groupPrompts.length}</Badge>
            </div>
            {groupPrompts.map((prompt) => {
              const editUrl = buildAppLaunchUrl({
                app: "agent-editor",
                intent: "edit",
                entityType: "agent-prompt",
                entityId: prompt.taskType,
                source: "admin",
              });

              return (
                <div
                  key={prompt.taskType}
                  className="flex items-start gap-3 p-3 rounded-md border border-border hover:bg-muted/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm font-mono">{prompt.taskType}</span>
                      {prompt.isOverridden && (
                        <Badge variant="secondary" className="text-[9px]">DB Override</Badge>
                      )}
                      {prompt.humanCurated && (
                        <Lock className="w-3 h-3 text-amber-600 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{prompt.description}</p>
                    <p className="text-[11px] text-muted-foreground/70 mt-1 font-mono truncate max-w-[500px]">
                      {prompt.currentPrompt.slice(0, 120)}...
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <a href={editUrl}>
                      <Button size="sm" variant="outline" className="gap-1 text-xs h-7">
                        <Pencil className="w-3 h-3" />
                        Edit
                      </Button>
                    </a>
                    <Button
                      size="sm"
                      variant={prompt.humanCurated ? "default" : "outline"}
                      className={`gap-1 text-xs h-7 ${prompt.humanCurated ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}`}
                      onClick={() => lockMutation.mutate({ taskType: prompt.taskType, humanCurated: !prompt.humanCurated })}
                      disabled={lockMutation.isPending}
                    >
                      {prompt.humanCurated ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    </Button>
                    {prompt.isOverridden && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1 text-xs h-7 text-muted-foreground"
                        onClick={() => revertMutation.mutate(prompt.taskType)}
                        disabled={revertMutation.isPending}
                      >
                        <RotateCcw className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
