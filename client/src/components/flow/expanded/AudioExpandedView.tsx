/**
 * AudioExpandedView — Full expanded view for Audio (Voice Capture) nodes.
 *
 * Provides: large transcript view, recording controls, export options.
 */

import { useState, useCallback } from "react";
import { Mic, MicOff, Copy, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProvokeText } from "@/components/ProvokeText";
import { useToast } from "@/hooks/use-toast";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import type { FlowNode } from "../useFlowCanvas";
import { ExpandedViewLayout } from "./ExpandedViewLayout";

interface AudioExpandedViewProps {
  node: FlowNode;
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
}

export function AudioExpandedView({ node, onUpdateNode }: AudioExpandedViewProps) {
  const { toast } = useToast();
  const transcript = node.audioTranscript || "";
  const isRecording = node.audioRecording || false;

  const handleTranscript = useCallback((text: string) => {
    if (!text.trim()) return;
    const updated = transcript ? `${transcript} ${text}` : text;
    onUpdateNode(node.id, {
      audioTranscript: updated,
      content: updated,
      documentContent: updated,
      snippet: updated.slice(0, 200),
    });
  }, [node.id, transcript, onUpdateNode]);

  const handleClear = useCallback(() => {
    onUpdateNode(node.id, {
      audioTranscript: "",
      content: "",
      documentContent: "",
      snippet: "Record audio via microphone — speech is transcribed in real-time using browser speech recognition",
    });
    toast({ title: "Transcript cleared" });
  }, [node.id, onUpdateNode, toast]);

  return (
    <ExpandedViewLayout
      defaultLeftSize={25}
      left={
        <div className="flex flex-col h-full">
        <div className="p-4 space-y-4">
          {/* Recording control */}
          <div className="flex flex-col items-center gap-3 py-4">
            <VoiceRecorder
              onTranscript={handleTranscript}
              onRecordingChange={(recording) => {
                onUpdateNode(node.id, { audioRecording: recording });
              }}
              size="lg"
              variant={isRecording ? "destructive" : "default"}
              className={`h-16 w-16 rounded-full ${isRecording ? "animate-pulse" : ""}`}
            />
            <p className="text-xs text-muted-foreground">
              {isRecording ? "Recording... click to stop" : "Click to start recording"}
            </p>
          </div>

          {/* Stats */}
          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Words</span>
              <Badge variant="outline" className="text-[10px]">
                {transcript ? transcript.split(/\s+/).length : 0}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Characters</span>
              <Badge variant="outline" className="text-[10px]">
                {transcript.length.toLocaleString()}
              </Badge>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2 border-t pt-3">
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-1.5 text-xs"
              onClick={() => {
                navigator.clipboard.writeText(transcript);
                toast({ title: "Copied" });
              }}
              disabled={!transcript}
            >
              <Copy className="w-3.5 h-3.5" />
              Copy Transcript
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-1.5 text-xs text-destructive"
              onClick={handleClear}
              disabled={!transcript}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </Button>
          </div>
        </div>
        </div>
      }
      right={
        <div className="flex-1 flex flex-col min-w-0">
        <div className="px-4 py-2 border-b bg-muted/20 flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Transcript</h3>
          {isRecording && (
            <Badge className="text-[10px] h-5 bg-red-500/20 text-red-600 dark:text-red-400 animate-pulse">
              <Mic className="w-2.5 h-2.5 mr-1" />
              Recording
            </Badge>
          )}
        </div>
        <div className="flex-1 overflow-auto p-4">
          {transcript ? (
            <ProvokeText
              value={transcript}
              onChange={(val) => onUpdateNode(node.id, {
                audioTranscript: val,
                content: val,
                documentContent: val,
                snippet: val.slice(0, 200),
              })}
              chrome="container"
              variant="editor"
              label="Transcript"
              showCopy
              showClear={false}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center h-full">
              <div className="text-center space-y-2">
                <MicOff className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground/50">No transcript yet</p>
                <p className="text-xs text-muted-foreground/40">Click the mic button to start recording</p>
              </div>
            </div>
          )}
        </div>
        </div>
      }
    />
  );
}
