import { useMemo } from "react";
import { Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
  Blocks,
  Code2,
  Cable,
  Plug,
  FileCode,
  Check,
  X,
  ChevronRight,
  Package,
  Workflow,
  LayoutGrid,
  BarChart3,
  Clock,
  Sparkles,
  ExternalLink,
  Layers,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  COMPONENT_REGISTRY,
  getComponent,
  type ComponentEntry,
  type PropEntry,
} from "@/lib/componentRegistry";

const CATEGORY_META: Record<
  ComponentEntry["category"],
  { label: string; icon: typeof Blocks; color: string; bgColor: string }
> = {
  shared: { label: "Shared", icon: Package, color: "text-blue-500", bgColor: "bg-blue-500/10" },
  notebook: { label: "Notebook", icon: LayoutGrid, color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
  flow: { label: "Flow Canvas", icon: Workflow, color: "text-violet-500", bgColor: "bg-violet-500/10" },
  bschart: { label: "BS Chart", icon: BarChart3, color: "text-amber-500", bgColor: "bg-amber-500/10" },
  timeline: { label: "Timeline", icon: Clock, color: "text-rose-500", bgColor: "bg-rose-500/10" },
  ftux: { label: "FTUX Shell", icon: Sparkles, color: "text-cyan-500", bgColor: "bg-cyan-500/10" },
};

function PropRow({ prop }: { prop: PropEntry }) {
  return (
    <tr className="border-b border-border/50 last:border-0">
      <td className="py-2 pr-3 align-top">
        <code className="text-xs font-mono font-medium text-foreground">
          {prop.name}
        </code>
      </td>
      <td className="py-2 pr-3 align-top">
        <code className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded whitespace-nowrap">
          {prop.type}
        </code>
      </td>
      <td className="py-2 pr-3 align-top text-center">
        {prop.required ? (
          <Check className="w-3.5 h-3.5 text-emerald-500 mx-auto" />
        ) : (
          <X className="w-3.5 h-3.5 text-muted-foreground/30 mx-auto" />
        )}
      </td>
      <td className="py-2 align-top">
        <span className="text-xs text-muted-foreground">{prop.description}</span>
      </td>
    </tr>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  count,
}: {
  icon: typeof Code2;
  title: string;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-2 mb-3 pb-2 border-b">
      <Icon className="w-4 h-4 text-primary" />
      <h2 className="text-sm font-semibold">{title}</h2>
      {count !== undefined && (
        <Badge variant="secondary" className="text-[9px] h-4">
          {count}
        </Badge>
      )}
    </div>
  );
}

function TOCSidebar({ component }: { component: ComponentEntry }) {
  const sections = [
    { id: "overview", label: "Overview" },
    { id: "props", label: `Props (${component.props.length})` },
    ...(component.hooks.length > 0
      ? [{ id: "hooks", label: `Hooks (${component.hooks.length})` }]
      : []),
    { id: "capabilities", label: `Capabilities (${component.capabilities.length})` },
    ...(component.dependencies.length > 0
      ? [{ id: "dependencies", label: `Dependencies (${component.dependencies.length})` }]
      : []),
    ...(component.apiEndpoints.length > 0
      ? [{ id: "api", label: `API Endpoints (${component.apiEndpoints.length})` }]
      : []),
    { id: "related", label: "Related" },
  ];

  return (
    <nav className="space-y-0.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        On this page
      </p>
      {sections.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className="block text-xs text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded hover:bg-muted/50 no-underline"
        >
          {s.label}
        </a>
      ))}
    </nav>
  );
}

export default function ComponentShowcase() {
  const params = useParams<{ componentId: string }>();
  const componentId = params.componentId || "";

  const component = getComponent(componentId);

  // Find related components (same category, excluding self)
  const related = useMemo(() => {
    if (!component) return [];
    return COMPONENT_REGISTRY.filter(
      (c) => c.category === component.category && c.id !== component.id,
    );
  }, [component]);

  // Components that depend on this one
  const dependedOnBy = useMemo(() => {
    if (!component) return [];
    return COMPONENT_REGISTRY.filter((c) =>
      c.dependencies.includes(component.name),
    );
  }, [component]);

  if (!component) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Blocks className="w-10 h-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">
          Component "{componentId}" not found.
        </p>
        <Link href="/components">
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Library
          </Button>
        </Link>
      </div>
    );
  }

  const cat = CATEGORY_META[component.category];
  const CatIcon = cat.icon;
  const requiredProps = component.props.filter((p) => p.required);
  const optionalProps = component.props.filter((p) => !p.required);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/components">
            <Button variant="ghost" size="sm" className="gap-1.5 h-7">
              <ArrowLeft className="w-3.5 h-3.5" />
              Library
            </Button>
          </Link>
          <ChevronRight className="w-3 h-3 text-muted-foreground/40" />
          <div className="flex items-center gap-2">
            <CatIcon className={cn("w-4 h-4", cat.color)} />
            <span className="text-sm font-medium">{component.name}</span>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex gap-8">
          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Overview */}
            <section id="overview" className="mb-8">
              <div className="flex items-start gap-3 mb-4">
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", cat.bgColor)}>
                  <CatIcon className={cn("w-5 h-5", cat.color)} />
                </div>
                <div>
                  <h1 className="text-xl font-serif font-bold tracking-tight">
                    {component.name}
                  </h1>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-[9px]">
                      {cat.label}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {component.filePath}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {component.description}
              </p>

              {/* Quick stats */}
              <div className="flex items-center gap-4 mt-4 py-3 px-4 rounded-lg bg-muted/30 border">
                <div className="flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-xs font-medium">{component.props.length} props</span>
                  <span className="text-[10px] text-muted-foreground">
                    ({requiredProps.length} required)
                  </span>
                </div>
                {component.hooks.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Cable className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-xs font-medium">{component.hooks.length} hooks</span>
                  </div>
                )}
                {component.apiEndpoints.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Plug className="w-3.5 h-3.5 text-violet-500" />
                    <span className="text-xs font-medium">
                      {component.apiEndpoints.length} API endpoints
                    </span>
                  </div>
                )}
                {component.dependencies.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs font-medium">
                      {component.dependencies.length} dependencies
                    </span>
                  </div>
                )}
              </div>
            </section>

            {/* Props */}
            <section id="props" className="mb-8">
              <SectionHeader icon={Code2} title="Props" count={component.props.length} />
              {component.props.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b text-[10px] uppercase tracking-wider text-muted-foreground">
                        <th className="py-2 pr-3 font-semibold">Name</th>
                        <th className="py-2 pr-3 font-semibold">Type</th>
                        <th className="py-2 pr-3 font-semibold text-center">Req</th>
                        <th className="py-2 font-semibold">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {component.props.map((prop) => (
                        <PropRow key={prop.name} prop={prop} />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  This component does not accept external props.
                </p>
              )}
            </section>

            {/* Hooks */}
            {component.hooks.length > 0 && (
              <section id="hooks" className="mb-8">
                <SectionHeader icon={Cable} title="Hooks" count={component.hooks.length} />
                <div className="space-y-2">
                  {component.hooks.map((hook) => (
                    <div
                      key={hook.name}
                      className="flex items-start gap-3 py-2 px-3 rounded-lg bg-muted/30 border"
                    >
                      <code className="text-xs font-mono font-medium text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                        {hook.name}
                      </code>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">{hook.purpose}</p>
                        <p className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">
                          from {hook.source}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Capabilities */}
            <section id="capabilities" className="mb-8">
              <SectionHeader icon={Zap} title="Capabilities" count={component.capabilities.length} />
              <ul className="space-y-1.5">
                {component.capabilities.map((cap, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Check className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{cap}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Dependencies */}
            {component.dependencies.length > 0 && (
              <section id="dependencies" className="mb-8">
                <SectionHeader
                  icon={Layers}
                  title="Dependencies"
                  count={component.dependencies.length}
                />
                <div className="flex flex-wrap gap-2">
                  {component.dependencies.map((dep) => {
                    const depEntry = COMPONENT_REGISTRY.find((c) => c.name === dep);
                    return depEntry ? (
                      <Link key={dep} href={`/components/${depEntry.id}`}>
                        <Badge
                          variant="outline"
                          className="cursor-pointer hover:bg-primary/10 hover:border-primary/30 transition-colors gap-1"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          {dep}
                        </Badge>
                      </Link>
                    ) : (
                      <Badge key={dep} variant="outline" className="gap-1">
                        <FileCode className="w-2.5 h-2.5" />
                        {dep}
                      </Badge>
                    );
                  })}
                </div>

                {/* Depended-on-by */}
                {dependedOnBy.length > 0 && (
                  <div className="mt-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Used by
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {dependedOnBy.map((c) => (
                        <Link key={c.id} href={`/components/${c.id}`}>
                          <Badge
                            variant="secondary"
                            className="cursor-pointer hover:bg-primary/10 transition-colors gap-1"
                          >
                            <ChevronRight className="w-2.5 h-2.5" />
                            {c.name}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* API Endpoints */}
            {component.apiEndpoints.length > 0 && (
              <section id="api" className="mb-8">
                <SectionHeader
                  icon={Plug}
                  title="API Endpoints"
                  count={component.apiEndpoints.length}
                />
                <div className="space-y-2">
                  {component.apiEndpoints.map((ep, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 py-2 px-3 rounded-lg bg-muted/30 border"
                    >
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] font-mono shrink-0 mt-0.5",
                          ep.method === "GET" && "border-emerald-500/50 text-emerald-600",
                          ep.method === "POST" && "border-blue-500/50 text-blue-600",
                          ep.method === "PUT" && "border-amber-500/50 text-amber-600",
                          ep.method === "PATCH" && "border-orange-500/50 text-orange-600",
                          ep.method === "DELETE" && "border-red-500/50 text-red-600",
                        )}
                      >
                        {ep.method}
                      </Badge>
                      <div className="min-w-0">
                        <code className="text-xs font-mono text-foreground">{ep.endpoint}</code>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{ep.purpose}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Related components */}
            <section id="related" className="mb-8">
              <SectionHeader icon={Blocks} title="Related Components" count={related.length} />
              {related.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {related.map((c) => (
                    <Link key={c.id} href={`/components/${c.id}`} className="no-underline">
                      <div className="group flex items-center gap-3 py-2 px-3 rounded-lg border hover:bg-accent/5 hover:border-primary/30 transition-all cursor-pointer">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium group-hover:text-primary transition-colors truncate">
                            {c.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {c.description.slice(0, 80)}...
                          </p>
                        </div>
                        <ChevronRight className="w-3 h-3 text-muted-foreground/30 shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  No other components in this category.
                </p>
              )}
            </section>
          </div>

          {/* TOC sidebar (hidden on mobile) */}
          <aside className="hidden lg:block w-48 shrink-0 sticky top-20 self-start">
            <TOCSidebar component={component} />
          </aside>
        </div>
      </div>
    </div>
  );
}
