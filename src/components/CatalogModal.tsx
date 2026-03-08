import type { CatalogModel, ModelRecord } from "../types";
import { compactRuntimeName } from "../utils/format";
import { invoke } from "@tauri-apps/api/core";
import { useState, useEffect } from "react";

type CatalogModalProps = {
  busy: boolean;
  catalogFilter: string;
  catalogModels: CatalogModel[];
  models: ModelRecord[];
  onClose: () => void;
  onFilterChange: (value: string) => void;
  onAddCatalogModel: (model: CatalogModel) => Promise<void> | void;
};

type HFModel = {
  id: string;
  modelId?: string;
  author?: string;
  downloads?: number;
  tags?: string[];
  siblings?: Array<{ path?: string; rfilename?: string; size?: number }>;
};

export function CatalogModal({
  busy,
  catalogFilter,
  models,
  onClose,
  onFilterChange,
  onAddCatalogModel
}: CatalogModalProps) {
  const [searchResults, setSearchResults] = useState<CatalogModel[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    // Автоматический поиск популярных моделей при открытии
    if (!hasSearched) {
      searchHuggingFace("llama");
    }
  }, []);

  async function searchHuggingFace(query?: string) {
    const searchQuery = query || catalogFilter.trim() || "llama";
    
    setSearching(true);
    setHasSearched(true);
    try {
      const results = await invoke<HFModel[]>("search_hf_models", {
        query: searchQuery,
        limit: 30
      });
      
      console.log("HF API Response:", results);
      
      const catalogModels: CatalogModel[] = results.flatMap((hfModel) => {
        const siblings = hfModel.siblings || [];
        const ggufFiles = siblings.filter((s) => {
          const filename = s.path || s.rfilename || "";
          return filename.endsWith(".gguf");
        });
        const repoId = hfModel.id || hfModel.modelId || "unknown";
        
        console.log(`Model: ${repoId}, GGUF files:`, ggufFiles.length);
        
        if (ggufFiles.length === 0) {
          return [];
        }
        
        // Берем только Q4_K_M файлы для компактности
        const q4Files = ggufFiles.filter(f => {
          const filename = f.path || f.rfilename || "";
          return filename.includes("Q4_K_M");
        });
        const filesToShow = q4Files.length > 0 ? q4Files.slice(0, 1) : ggufFiles.slice(0, 1);
        
        return filesToShow.map((file) => {
          const filename = file.path || file.rfilename || "unknown.gguf";
          const sizeGB = file.size ? (file.size / (1024 * 1024 * 1024)).toFixed(1) : "?";
          return {
            id: `${repoId}:${filename}`,
            title: repoId.split("/").pop() || repoId,
            repoId,
            filename,
            runtimeHint: "llama_cpp" as const,
            summary: `${(hfModel.downloads || 0).toLocaleString()} downloads from Hugging Face`,
            tags: hfModel.tags?.slice(0, 5) || ["gguf"],
            size: `${sizeGB} GB`
          };
        });
      });
      
      console.log("Catalog models:", catalogModels);
      setSearchResults(catalogModels);
    } catch (error) {
      console.error("Search failed:", error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="catalog-modal" onClick={(event) => event.stopPropagation()}>
        <div className="settings-top">
          <div>
            <p className="pane-label">Hugging Face</p>
            <h3>Model Search</h3>
          </div>
          <button className="mini-button" onClick={onClose} type="button">
            X
          </button>
        </div>
        <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
          <input
            className="search-input"
            value={catalogFilter}
            onChange={(event) => onFilterChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                searchHuggingFace();
              }
            }}
            placeholder="Search models: llama, qwen, gemma, phi, mistral..."
            style={{ flex: 1 }}
          />
          <button
            onClick={() => searchHuggingFace()}
            disabled={searching}
            type="button"
            style={{ minWidth: "100px" }}
          >
            {searching ? "Searching..." : "Search"}
          </button>
        </div>
        
        {searching ? (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
            <p>Searching Hugging Face...</p>
          </div>
        ) : searchResults.length === 0 && hasSearched ? (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
            <p>No models found. Try different keywords.</p>
          </div>
        ) : (
          <div className="catalog-grid">
            {searchResults.map((model) => {
              const exists = models.some((entry) => entry.id === `${model.repoId}:${model.filename}`);
              return (
                <article className="catalog-card" key={model.id}>
                  <div className="catalog-card-top">
                    <div>
                      <p className="pane-label">{compactRuntimeName(model.runtimeHint)}</p>
                      <h3>{model.title}</h3>
                    </div>
                    <span className="state-badge">{model.size}</span>
                  </div>
                  <p>{model.summary}</p>
                  <div className="tag-row">
                    {model.tags.map((tag, idx) => (
                      <span className="tag" key={`${tag}-${idx}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="catalog-meta">
                    <strong>{model.repoId}</strong>
                    <span>{model.filename}</span>
                  </div>
                  <button disabled={busy || exists} onClick={() => onAddCatalogModel(model)} type="button">
                    {exists ? "Added" : "Add to Library"}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
