import React, { useCallback, useRef, useEffect, useState } from "react";
import { Mic, Square, Trash2, Lock, Unlock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlowNode } from "./useFlowCanvas";
import { FlowPortDots } from "./FlowPortDots";

interface FlowAudioNodeProps {
  node: FlowNode;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
  onPortMouseDown?: (e: React.MouseEvent, nodeId: string, portType: "input" | "output") => void;
}

export const FlowAudioNode = React.memo(function FlowAudioNode({
  node,
  isSelected,
  onMouseDown,
  onDelete,
  onUpdateNode,
  onPortMouseDown,
}: FlowAudioNodeProps) {
  const recognitionRef = useRef<any>(null);
  const [isRecording, setIsRecording] = useState(node.audioRecording ?? false);
  const transcriptRef = useRef(node.audioTranscript || "");

  // Sync recording state from node (in case of external updates)
  useEffect(() => {
    setIsRecording(node.audioRecording ?? false);
  }, [node.audioRecording]);

  const startRecording = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let finalTranscript = transcriptRef.current;

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          finalTranscript += (finalTranscript ? " " : "") + text;
          transcriptRef.current = finalTranscript;
        } else {
          interim += result[0].transcript;
        }
      }

      const displayText = finalTranscript + (interim ? ` ${interim}` : "");
      onUpdateNode(node.id, {
        audioTranscript: finalTranscript,
        content: finalTranscript,
        snippet: displayText.slice(0, 200) || "Recording...",
      });
    };

    recognition.onerror = () => {
      setIsRecording(false);
      onUpdateNode(node.id, { audioRecording: false });
    };

    recognition.onend = () => {
      // Auto-restart if still supposed to be recording
      if (recognitionRef.current === recognition) {
        try { recognition.start(); } catch { /* already stopped */ }
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
    onUpdateNode(node.id, {
      audioRecording: true,
      snippet: "Recording...",
      label: node.label === "Capture Audio" ? `Recording — ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : node.label,
    });
  }, [node.id, node.label, onUpdateNode]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      rec.onend = null;
      rec.stop();
    }
    setIsRecording(false);
    const transcript = transcriptRef.current;
    onUpdateNode(node.id, {
      audioRecording: false,
      audioTranscript: transcript,
      content: transcript,
      snippet: transcript ? transcript.slice(0, 200) : "No transcript captured",
      label: transcript
        ? `Audio: ${transcript.slice(0, 30)}${transcript.length > 30 ? "..." : ""}`
        : node.label,
    });
  }, [node.id, node.label, onUpdateNode]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  return (
    <div
      className={cn(
        "absolute select-none rounded-lg border-2 shadow-md transition-shadow group flex flex-col",
        "bg-card hover:shadow-lg",
        isRecording ? "border-red-500/80 ring-1 ring-red-500/40" : "border-red-500/60",
        isSelected && "ring-2 ring-primary shadow-lg",
      )}
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
        zIndex: node.zIndex,
      }}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 border-b rounded-t-lg cursor-grab shrink-0",
          isRecording ? "bg-red-500/20 border-red-500/30" : "bg-red-500/10 border-red-500/20",
        )}
        onMouseDown={(e) => onMouseDown(e, node.id)}
      >
        <Mic className={cn("w-3 h-3 shrink-0", isRecording ? "text-red-500 animate-pulse" : "text-red-500")} />
        <span className="text-[10px] font-medium truncate flex-1">{node.label}</span>
        <span className={cn(
          "text-[8px] font-semibold uppercase tracking-wider px-1 py-0.5 rounded",
          isRecording ? "bg-red-500/30 text-red-600 dark:text-red-400" : "bg-red-500/20 text-red-600 dark:text-red-400",
        )}>
          {isRecording ? "REC" : "Audio"}
        </span>
      </div>

      {/* Body */}
      <div
        className="flex-1 overflow-auto min-h-0 flex flex-col items-center justify-center px-2 py-1"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Mic toggle button */}
        <button
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center transition-all",
            isRecording
              ? "bg-red-500 text-white hover:bg-red-600 shadow-md shadow-red-500/30"
              : "bg-red-500/15 text-red-500 hover:bg-red-500/25",
          )}
          onClick={toggleRecording}
        >
          {isRecording ? (
            <Square className="w-4 h-4" />
          ) : (
            <Mic className="w-5 h-5" />
          )}
        </button>

        {/* Transcript preview */}
        <p className="text-[8px] text-muted-foreground mt-1 text-center line-clamp-3 leading-relaxed">
          {node.audioTranscript
            ? node.audioTranscript.slice(-150)
            : isRecording
              ? "Listening..."
              : "Click mic to start recording"}
        </p>
      </div>

      {/* Port dots */}
      <FlowPortDots
        node={node}
        isSelected={isSelected}
        onPortMouseDown={onPortMouseDown}
        accentColor="red"
      />

      {/* Lock + Delete buttons */}
      <div className="absolute -top-2.5 -right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          className={cn(
            "w-5 h-5 rounded-full flex items-center justify-center shadow-sm transition-colors",
            node.locked
              ? "bg-yellow-500 text-white"
              : "bg-muted text-muted-foreground hover:bg-muted-foreground/20",
          )}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onUpdateNode(node.id, { locked: !node.locked });
          }}
          title={node.locked ? "Unlock node" : "Lock node"}
        >
          {node.locked ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
        </button>
        {!node.locked && (
          <button
            className="w-5 h-5 rounded-full bg-destructive/90 text-destructive-foreground flex items-center justify-center shadow-sm hover:bg-destructive transition-colors"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (isRecording) stopRecording();
              onDelete(node.id);
            }}
            title="Delete node"
          >
            <Trash2 className="w-2.5 h-2.5" />
          </button>
        )}
      </div>

      {/* Recording pulse indicator */}
      {isRecording && (
        <div className="absolute -top-1 -left-1 w-3 h-3">
          <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-50" />
          <div className="absolute inset-0.5 bg-red-500 rounded-full" />
        </div>
      )}
    </div>
  );
});
