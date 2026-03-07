import React from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onClose: () => void;
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Error boundary for the expanded overlay.
 * Catches render crashes so the entire canvas doesn't go blank.
 */
export class FlowOverlayErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[FlowOverlay] Render crash:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 z-[45] flex flex-col bg-background">
          <div className="flex items-center gap-2 px-4 py-2 bg-destructive text-white shrink-0">
            <AlertTriangle className="w-4 h-4" />
            <h2 className="text-sm font-semibold flex-1">Overlay crashed</h2>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20"
              onClick={this.props.onClose}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="max-w-md text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                This node's expanded view encountered an error. Close and try again.
              </p>
              <pre className="text-xs text-destructive bg-destructive/5 rounded-lg p-3 text-left overflow-auto max-h-40">
                {this.state.error.message}
              </pre>
              <Button variant="outline" size="sm" onClick={this.props.onClose}>
                Close overlay
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
