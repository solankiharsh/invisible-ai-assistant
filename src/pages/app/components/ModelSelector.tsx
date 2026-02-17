import { useState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useApp } from "@/contexts";
import { CloakModel } from "@/types";
import { STORAGE_KEYS } from "@/config";
import { safeLocalStorage } from "@/lib";
import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components";

const SELECTED_CLOAK_MODEL_STORAGE_KEY = "selected_cloak_model";

function abbreviateModelName(name: string, maxLen = 18): string {
  if (name.length <= maxLen) return name;
  return name.slice(0, maxLen - 2) + "…";
}

export const ModelSelector = () => {
  const { cloakApiEnabled, setSupportsImages, setCloakApiEnabled } = useApp();
  const [models, setModels] = useState<CloakModel[]>([]);
  const [isModelsLoading, setIsModelsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<CloakModel | null>(null);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const fetchedRef = useRef(false);
  const refetchedWhenOpenRef = useRef(false);

  // In overlay window: sync cloakApiEnabled from localStorage on mount and when opening dropdown so model list appears
  useEffect(() => {
    try {
      if (getCurrentWindow().label === "dashboard") return;
    } catch {
      return;
    }
    const raw = safeLocalStorage.getItem(STORAGE_KEYS.CLOAK_API_ENABLED);
    if (raw === "true") {
      setCloakApiEnabled(true);
    }
  }, [setCloakApiEnabled]);

  useEffect(() => {
    if (!isPopoverOpen) return;
    try {
      if (getCurrentWindow().label === "dashboard") return;
    } catch {
      return;
    }
    const raw = safeLocalStorage.getItem(STORAGE_KEYS.CLOAK_API_ENABLED);
    if (raw === "true") {
      setCloakApiEnabled(true);
    }
  }, [isPopoverOpen, setCloakApiEnabled]);

  // When user opens dropdown and list is empty, refetch once (e.g. initial fetch failed or was slow)
  useEffect(() => {
    if (!isPopoverOpen) {
      refetchedWhenOpenRef.current = false;
      return;
    }
    if (models.length === 0 && !isModelsLoading && !refetchedWhenOpenRef.current) {
      refetchedWhenOpenRef.current = true;
      fetchModels();
    }
  }, [isPopoverOpen, models.length, isModelsLoading]);

  const loadStoredModel = async () => {
    try {
      const storage = await invoke<{ selected_cloak_model?: string }>(
        "secure_storage_get"
      );
      if (storage.selected_cloak_model) {
        const parsed = JSON.parse(storage.selected_cloak_model) as CloakModel;
        setSelectedModel(parsed);
      } else {
        setSelectedModel(null);
      }
    } catch {
      setSelectedModel(null);
    }
  };

  const fetchModels = async () => {
    setIsModelsLoading(true);
    try {
      const fetched = await invoke<CloakModel[]>("fetch_models");
      setModels(Array.isArray(fetched) ? fetched : []);
    } catch (err) {
      console.error("Failed to fetch models:", err);
      setModels([]);
    } finally {
      setIsModelsLoading(false);
    }
  };

  // Match dashboard: fetch models on mount unconditionally so the dropdown list is populated when opened
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchModels();
    loadStoredModel();
  }, []);

  // When cloakApiEnabled turns true (e.g. after sync from dashboard), refresh stored model selection
  useEffect(() => {
    if (!cloakApiEnabled) return;
    loadStoredModel();
  }, [cloakApiEnabled]);

  const handleModelSelect = async (model: CloakModel) => {
    setSelectedModel(model);
    setIsPopoverOpen(false);

    if (cloakApiEnabled) {
      const hasImageSupport = model.modality?.includes("image") ?? false;
      setSupportsImages(hasImageSupport);
    }

    try {
      await invoke("secure_storage_save", {
        items: [
          {
            key: SELECTED_CLOAK_MODEL_STORAGE_KEY,
            value: JSON.stringify(model),
          },
        ],
      });
    } catch (err) {
      console.error("Failed to save model selection:", err);
    }
  };

  if (!cloakApiEnabled) return null;

  return (
    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 shrink-0 text-xs font-medium gap-1 min-w-0 max-w-[140px]"
          disabled={isModelsLoading}
          title={selectedModel ? selectedModel.name : "Select model"}
        >
          <span className="truncate">
            {selectedModel
              ? abbreviateModelName(selectedModel.name)
              : isModelsLoading
                ? "Loading…"
                : "Model"}
          </span>
          <ChevronDown className="h-3 w-3 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        className="z-[9999] w-[280px] p-0 rounded-lg overflow-hidden"
        sideOffset={6}
      >
        <Command shouldFilter={true}>
          <CommandInput
            placeholder="Search model..."
            autoFocus
          />
          <CommandList className="max-h-[240px]">
            <CommandEmpty>No models found.</CommandEmpty>
            <CommandGroup>
              {models.map((model, index) => (
                <CommandItem
                  key={`${model?.id}-${index}`}
                  disabled={!model?.isAvailable}
                  className="cursor-pointer text-xs"
                  onSelect={() => handleModelSelect(model)}
                >
                  <div className="flex flex-col gap-0.5 w-full min-w-0">
                    <span className="font-medium truncate">{model?.name}</span>
                    <span className="text-muted-foreground text-[10px]">
                      {model?.provider}
                      {model?.modality ? ` · ${model.modality}` : ""}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
