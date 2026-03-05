import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Search,
  Blocks,
  LayoutGrid,
  Workflow,
  BarChart3,
  Clock,
  Sparkles,
  Package,
  Cable,
  Code2,
  Plug,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  COMPONENT_REGISTRY,
  getCategories,
  getCategoryCounts,
  type ComponentEntry,
} from "@/lib/componentRegistry";

const CATEGORY_META: Record<
  ComponentEntry["category"],
  { label: string; icon: typeof Blocks; color: string; description: string }
> = {
  shared: {
    label: "Shared",
    icon: Package,
    color: "text-blue-500",
    description: "Cross-cutting components used across the entire application",
  },
  notebook: {
    label: "Notebook",
    icon: LayoutGrid,
    color: "text-emerald-500",
    description: "Components powering the 3-panel notebook workspace",
  },
  flow: {
    label: "Flow Canvas",
    icon: Workflow,
    color: "text-violet-500",
    description: "Infinite canvas node/edge visual workflow builder",
  },
  bschart: {
    label: "BS Chart",
    icon: BarChart3,
    color: "text-amber-500",
    description: "Visual diagram and flowchart designer",
  },
  timeline: {
    label: "Timeline",
    icon: Clock,
    color: "text-rose-500",
    description: "Timeline event creation and visualization",
  },
  ftux: {
    label: "FTUX Shell",
    icon: Sparkles,
    color: "text-cyan-500",
    description: "First-time user experience shell and dock",
  },
};

function ComponentCard({ component }: { component: ComponentEntry }) {
  const cat = CATEGORY_META[component.category];
  const CatIcon = cat.icon;

  return (
    <Link
      href={`/components/${component.id}`}
      className="no-underline"
    >
      <div className="group rounded-lg border bg-card hover:bg-accent/5 hover:border-primary/30 transition-all duration-200 p-4 h-full flex flex-col cursor-pointer">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <CatIcon className={cn("w-4 h-4 shrink-0", cat.color)} />
            <h3 className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
              {component.name}
            </h3>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 group-hover:text-primary transition-colors" />
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3 flex-1">
          {component.description}
        </p>

        {/* Stats row */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground/70">
          <span className="flex items-center gap-1">
            <Code2 className="w-3 h-3" />
            {component.props.length} props
          </span>
          {component.hooks.length > 0 && (
            <span className="flex items-center gap-1">
              <Cable className="w-3 h-3" />
              {component.hooks.length} hooks
            </span>
          )}
          {component.apiEndpoints.length > 0 && (
            <span className="flex items-center gap-1">
              <Plug className="w-3 h-3" />
              {component.apiEndpoints.length} APIs
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function ComponentLibrary() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<
    ComponentEntry["category"] | "all"
  >("all");

  const categories = getCategories();
  const categoryCounts = getCategoryCounts();

  const filtered = useMemo(() => {
    let items = COMPONENT_REGISTRY;
    if (activeCategory !== "all") {
      items = items.filter((c) => c.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q),
      );
    }
    return items;
  }, [search, activeCategory]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1.5 h-7">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Blocks className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-serif font-bold tracking-tight">
              Component Library
            </h1>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            {COMPONENT_REGISTRY.length} components
          </Badge>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search components..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>

          <div className="flex items-center gap-1 flex-wrap">
            <Button
              variant={activeCategory === "all" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setActiveCategory("all")}
            >
              All ({COMPONENT_REGISTRY.length})
            </Button>
            {categories.map((cat) => {
              const meta = CATEGORY_META[cat];
              const Icon = meta.icon;
              return (
                <Button
                  key={cat}
                  variant={activeCategory === cat ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setActiveCategory(cat)}
                >
                  <Icon className={cn("w-3 h-3", activeCategory !== cat && meta.color)} />
                  {meta.label} ({categoryCounts[cat] || 0})
                </Button>
              );
            })}
          </div>
        </div>

        {/* Category description */}
        {activeCategory !== "all" && (
          <p className="text-sm text-muted-foreground mb-4">
            {CATEGORY_META[activeCategory].description}
          </p>
        )}

        {/* Grid */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((component) => (
              <ComponentCard key={component.id} component={component} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Blocks className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No components match your search.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
