import { useState } from "react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Header,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components";
import { CheckCircle2, Briefcase, GraduationCap, Users, FileText } from "lucide-react";
import { useApp } from "@/contexts";
import { safeLocalStorage } from "@/lib";
import { STORAGE_KEYS } from "@/config";
import {
  PREBUILT_PROMPTS,
  PREBUILT_PROMPT_CATEGORIES,
  type PrebuiltPrompt,
} from "@/config/prebuilt-prompts";

const SELECTED_PREBUILT_PROMPT_KEY = "selected_prebuilt_prompt";

const categoryIcons: Record<PrebuiltPrompt["category"], typeof Briefcase> = {
  interview: Users,
  professional: Briefcase,
  academic: GraduationCap,
};

export const PrebuiltPrompts = () => {
  const { setSystemPrompt } = useApp();
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(
    () => {
      const stored = safeLocalStorage.getItem(SELECTED_PREBUILT_PROMPT_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          return parsed.id ?? null;
        } catch {
          return null;
        }
      }
      return null;
    }
  );
  const [previewPrompt, setPreviewPrompt] = useState<PrebuiltPrompt | null>(
    null
  );

  const handleSelectPrompt = (prompt: PrebuiltPrompt) => {
    setSystemPrompt(prompt.prompt);
    setSelectedPromptId(prompt.id);

    safeLocalStorage.removeItem(STORAGE_KEYS.SELECTED_SYSTEM_PROMPT_ID);
    safeLocalStorage.removeItem("selected_cloak_prompt");
    safeLocalStorage.setItem(STORAGE_KEYS.SYSTEM_PROMPT, prompt.prompt);
    safeLocalStorage.setItem(
      SELECTED_PREBUILT_PROMPT_KEY,
      JSON.stringify({ id: prompt.id })
    );
  };

  // Clear selection when a user/cloak prompt is picked elsewhere
  useState(() => {
    const userSelected = safeLocalStorage.getItem(
      STORAGE_KEYS.SELECTED_SYSTEM_PROMPT_ID
    );
    const cloakSelected = safeLocalStorage.getItem("selected_cloak_prompt");
    if (userSelected || cloakSelected) {
      setSelectedPromptId(null);
    }
  });

  const categories = Object.keys(PREBUILT_PROMPT_CATEGORIES) as Array<
    PrebuiltPrompt["category"]
  >;

  return (
    <div className="space-y-6 mt-6">
      <div className="border-t border-input/50 pt-6">
        <Header
          title="Prebuilt Templates"
          description="Ready-to-use system prompts for interviews, meetings, sales, and more. Click to activate."
        />
      </div>

      {categories.map((category) => {
        const meta = PREBUILT_PROMPT_CATEGORIES[category];
        const prompts = PREBUILT_PROMPTS.filter(
          (p) => p.category === category
        );
        const Icon = categoryIcons[category];

        return (
          <div key={category} className="space-y-3">
            <div className="flex items-center gap-2">
              <Icon className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">{meta.label}</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {prompts.length}
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
              {prompts.map((prompt) => {
                const isSelected = selectedPromptId === prompt.id;
                return (
                  <Card
                    key={prompt.id}
                    className={`relative border lg:border-2 shadow-none p-4 pb-12 gap-0 group cursor-pointer transition-all hover:shadow-sm ${
                      isSelected
                        ? "!bg-primary/5 dark:!bg-primary/10 border-primary"
                        : "!bg-black/5 dark:!bg-white/5 border-transparent"
                    }`}
                    onClick={() => handleSelectPrompt(prompt)}
                  >
                    {isSelected && (
                      <CheckCircle2 className="size-5 text-green-500 flex-shrink-0 absolute top-2 right-2" />
                    )}
                    <CardHeader className="p-0 pb-0 select-none">
                      <div className="flex items-start justify-between gap-2 relative">
                        <div className="flex-1 space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-[10px] text-base line-clamp-1 flex-1 pr-3">
                              {prompt.name}
                            </CardTitle>
                          </div>
                          <CardDescription className="min-h-[5rem] line-clamp-5 text-xs leading-relaxed">
                            {prompt.description}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <div className="absolute bottom-2 left-4 right-4 flex items-center justify-between gap-2">
                      <span className="text-[10px] lg:text-xs text-muted-foreground select-none">
                        {meta.label}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewPrompt(prompt);
                        }}
                      >
                        <FileText className="size-3.5 mr-1" />
                        View full prompt
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}

      <Dialog
        open={!!previewPrompt}
        onOpenChange={(open) => !open && setPreviewPrompt(null)}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-4">
          {previewPrompt && (
            <>
              <DialogHeader>
                <DialogTitle>{previewPrompt.name}</DialogTitle>
                <DialogDescription className="text-left">
                  {previewPrompt.description}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2 flex-1 min-h-0">
                <span className="text-xs font-medium text-muted-foreground">
                  Full system prompt
                </span>
                <pre className="flex-1 overflow-auto rounded-lg border bg-muted/30 p-4 text-xs leading-relaxed whitespace-pre-wrap font-sans">
                  {previewPrompt.prompt}
                </pre>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewPrompt(null)}
                >
                  Close
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    handleSelectPrompt(previewPrompt);
                    setPreviewPrompt(null);
                  }}
                >
                  Use this prompt
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
