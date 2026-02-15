import { AlertCircleIcon, LoaderIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  setupRequired: boolean;
  error: string;
  isProcessing: boolean;
  isAIProcessing: boolean;
  capturing: boolean;
  signalLevel?: { rms: number; peak: number };
};

export const StatusIndicator = ({
  setupRequired,
  error,
  isProcessing,
  isAIProcessing,
  capturing,
  signalLevel,
}: Props) => {
  // Don't show anything if not capturing and no error
  if (!capturing && !error && !isProcessing && !isAIProcessing) {
    return null;
  }

  return (
    <div className="flex flex-1 items-center gap-2 px-3 py-2 justify-end">
      {/* Priority: Error > AI Processing > Transcribing > Listening */}
      {error && !setupRequired ? (
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircleIcon className="w-4 h-4" />
          <span className="text-xs font-medium">{error}</span>
        </div>
      ) : isAIProcessing ? (
        <div className="flex items-center gap-2 animate-pulse">
          <LoaderIcon className="w-4 h-4 animate-spin" />
          <span className="text-xs font-medium">Generating response...</span>
        </div>
      ) : isProcessing ? (
        <div className="flex items-center gap-2 animate-pulse">
          <LoaderIcon className="w-4 h-4 animate-spin" />
          <span className="text-xs font-medium">Transcribing...</span>
        </div>
      ) : capturing ? (
        <div className="flex items-center gap-2">
          {/* Signal Meter */}
          <div className="flex items-center gap-[2px] h-3 bg-muted/30 px-1 rounded-sm">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={cn(
                  "w-[2px] rounded-full transition-all duration-150",
                  (signalLevel?.rms || 0) * 100 > i * 1.5
                    ? "bg-green-500 h-[100%]"
                    : "bg-muted-foreground/30 h-1"
                )}
              />
            ))}
          </div>
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-medium text-green-600">Listening...</span>
        </div>
      ) : null}
    </div>
  );
};
