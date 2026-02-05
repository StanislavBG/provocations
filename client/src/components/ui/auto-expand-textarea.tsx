import * as React from "react";
import { cn } from "@/lib/utils";

export interface AutoExpandTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  minRows?: number;
  maxRows?: number;
}

const AutoExpandTextarea = React.forwardRef<HTMLTextAreaElement, AutoExpandTextareaProps>(
  ({ className, minRows = 3, maxRows = 20, onChange, value, ...props }, ref) => {
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
    const [height, setHeight] = React.useState<string>("auto");

    // Combine refs
    React.useImperativeHandle(ref, () => textareaRef.current as HTMLTextAreaElement);

    const adjustHeight = React.useCallback(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = "auto";

      // Calculate line height (approximate)
      const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 24;
      const minHeight = lineHeight * minRows;
      const maxHeight = lineHeight * maxRows;

      // Get the scroll height and clamp it
      const scrollHeight = textarea.scrollHeight;
      const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);

      textarea.style.height = `${newHeight}px`;
      setHeight(`${newHeight}px`);
    }, [minRows, maxRows]);

    // Adjust on value change
    React.useEffect(() => {
      adjustHeight();
    }, [value, adjustHeight]);

    // Adjust on mount
    React.useEffect(() => {
      adjustHeight();
    }, [adjustHeight]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange?.(e);
      // Adjust after a microtask to ensure value is updated
      requestAnimationFrame(adjustHeight);
    };

    return (
      <textarea
        ref={textareaRef}
        className={cn(
          "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none overflow-y-auto transition-height duration-100",
          className
        )}
        style={{ height }}
        onChange={handleChange}
        value={value}
        {...props}
      />
    );
  }
);

AutoExpandTextarea.displayName = "AutoExpandTextarea";

export { AutoExpandTextarea };
