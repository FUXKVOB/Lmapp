import type { CatalogModel, ModelRecord } from "../types";
import { compactRuntimeName } from "../utils/format";

type CatalogModalProps = {
  busy: boolean;
  catalogFilter: string;
  catalogModels: CatalogModel[];
  models: ModelRecord[];
  onClose: () => void;
  onFilterChange: (value: string) => void;
  onAddCatalogModel: (model: CatalogModel) => Promise<void> | void;
};

export function CatalogModal({
  busy,
  catalogFilter,
  catalogModels,
  models,
  onClose,
  onFilterChange,
  onAddCatalogModel
}: CatalogModalProps) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="catalog-modal" onClick={(event) => event.stopPropagation()}>
        <div className="settings-top">
          <div>
            <p className="pane-label">Hugging Face</p>
            <h3>Model Catalog</h3>
          </div>
          <button className="mini-button" onClick={onClose} type="button">
            X
          </button>
        </div>
        <input
          className="search-input"
          value={catalogFilter}
          onChange={(event) => onFilterChange(event.target.value)}
          placeholder="Search model catalog"
        />
        <div className="catalog-grid">
          {catalogModels.map((model) => {
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
                  {model.tags.map((tag) => (
                    <span className="tag" key={tag}>
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
      </div>
    </div>
  );
}
