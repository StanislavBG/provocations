/**
 * ChatSettings — configuration panel for messaging preferences.
 * Inspired by Slack/Discord/Signal settings patterns.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Shield, Bell, Eye, Clock, Volume2, LayoutList } from "lucide-react";
import type { ChatPreferencesData, PresenceStatus } from "@shared/schema";

interface ChatSettingsProps {
  onBack: () => void;
}

const PRESENCE_OPTIONS: { value: PresenceStatus; label: string; description: string }[] = [
  { value: "available", label: "Available", description: "Others can see you're online" },
  { value: "busy", label: "Busy", description: "Show as busy, still receive messages" },
  { value: "away", label: "Away", description: "Appear away from keyboard" },
  { value: "invisible", label: "Invisible", description: "Appear offline to others" },
];

const RETENTION_OPTIONS = [
  { value: "1", label: "1 day" },
  { value: "3", label: "3 days" },
  { value: "7", label: "7 days (default)" },
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
];

const defaults: ChatPreferencesData = {
  presenceStatus: "available",
  customStatusText: null,
  notificationsEnabled: true,
  notifyOnMentionOnly: false,
  readReceiptsEnabled: true,
  typingIndicatorsEnabled: true,
  messageRetentionDays: 7,
  chatSoundEnabled: true,
  compactMode: false,
};

export function ChatSettings({ onBack }: ChatSettingsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: prefs = defaults } = useQuery<ChatPreferencesData>({
    queryKey: ["/api/chat/preferences"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/chat/preferences");
      return res.json();
    },
  });

  const mutation = useMutation({
    mutationFn: async (update: Partial<ChatPreferencesData>) => {
      const res = await apiRequest("PUT", "/api/chat/preferences", update);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/chat/preferences"], data);
    },
    onError: () => {
      toast({ title: "Failed to save preference", variant: "destructive" });
    },
  });

  const toggle = (key: keyof ChatPreferencesData, value: boolean) => {
    mutation.mutate({ [key]: value });
  };

  return (
    <>
      <div className="flex items-center gap-2 px-3 py-3 border-b">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h2 className="font-serif font-semibold">Chat Settings</h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* ── Presence ── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" />
              Presence
            </h3>
            <div className="space-y-2">
              <Label className="text-sm">Status</Label>
              <Select
                value={prefs.presenceStatus}
                onValueChange={(v) => mutation.mutate({ presenceStatus: v as PresenceStatus })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRESENCE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          opt.value === "available" ? "bg-green-500"
                          : opt.value === "busy" ? "bg-red-500"
                          : opt.value === "away" ? "bg-yellow-500"
                          : "bg-gray-400"
                        }`} />
                        {opt.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          <Separator />

          {/* ── Notifications ── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5" />
              Notifications
            </h3>
            <div className="space-y-4">
              <SettingRow
                label="Enable notifications"
                description="Receive alerts for new messages"
                checked={prefs.notificationsEnabled}
                onChange={(v) => toggle("notificationsEnabled", v)}
              />
              <SettingRow
                label="Mentions only"
                description="Only notify when someone @mentions you"
                checked={prefs.notifyOnMentionOnly}
                onChange={(v) => toggle("notifyOnMentionOnly", v)}
              />
              <SettingRow
                label="Sound"
                description="Play a sound for new messages"
                checked={prefs.chatSoundEnabled}
                onChange={(v) => toggle("chatSoundEnabled", v)}
                icon={<Volume2 className="w-3.5 h-3.5" />}
              />
            </div>
          </section>

          <Separator />

          {/* ── Privacy ── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              Privacy
            </h3>
            <div className="space-y-4">
              <SettingRow
                label="Read receipts"
                description="Let others know when you've read their messages"
                checked={prefs.readReceiptsEnabled}
                onChange={(v) => toggle("readReceiptsEnabled", v)}
              />
              <SettingRow
                label="Typing indicators"
                description="Show when you're typing a message"
                checked={prefs.typingIndicatorsEnabled}
                onChange={(v) => toggle("typingIndicatorsEnabled", v)}
              />
            </div>
          </section>

          <Separator />

          {/* ── Message Retention ── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Message Retention
            </h3>
            <p className="text-xs text-muted-foreground mb-2">
              Messages are automatically deleted after this period. All message data is encrypted at rest.
            </p>
            <Select
              value={String(prefs.messageRetentionDays)}
              onValueChange={(v) => mutation.mutate({ messageRetentionDays: parseInt(v, 10) })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RETENTION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          <Separator />

          {/* ── Display ── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <LayoutList className="w-3.5 h-3.5" />
              Display
            </h3>
            <SettingRow
              label="Compact mode"
              description="Reduce spacing between messages"
              checked={prefs.compactMode}
              onChange={(v) => toggle("compactMode", v)}
            />
          </section>

          {/* Encryption notice */}
          <div className="rounded-lg bg-muted/50 p-3 flex items-start gap-2">
            <Shield className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium">Encrypted at rest</p>
              <p className="text-[11px] text-muted-foreground">
                All messages are encrypted with AES-256-GCM before storage
                and auto-purged based on your retention setting.
              </p>
            </div>
          </div>
        </div>
      </ScrollArea>
    </>
  );
}

function SettingRow({
  label,
  description,
  checked,
  onChange,
  icon,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="space-y-0.5">
        <Label className="text-sm flex items-center gap-1.5">
          {icon}
          {label}
        </Label>
        <p className="text-[11px] text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
