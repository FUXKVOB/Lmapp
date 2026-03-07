import type { RuntimeSettings } from "../types";

type ProfileModalProps = {
  busy: boolean;
  runtime: RuntimeSettings;
  onClose: () => void;
  onPickAvatar: () => Promise<void> | void;
  onRuntimeChange: (runtime: RuntimeSettings) => void;
  onSave: () => Promise<void>;
};

export function ProfileModal({
  busy,
  runtime,
  onClose,
  onPickAvatar,
  onRuntimeChange,
  onSave
}: ProfileModalProps) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="profile-modal" onClick={(event) => event.stopPropagation()}>
        <div className="settings-top">
          <h3>Edit Profile</h3>
          <button className="mini-button" onClick={onClose} type="button">
            X
          </button>
        </div>

        <div className="profile-edit-content">
          <div className="profile-avatar-section">
            {runtime.user_profile.avatar_url ? (
              <img src={runtime.user_profile.avatar_url} alt="Avatar" className="profile-avatar-large" />
            ) : (
              <div className="profile-avatar-large profile-avatar-placeholder">
                {runtime.user_profile.username.charAt(0).toUpperCase()}
              </div>
            )}
            <button className="subtle-button" onClick={onPickAvatar} type="button" style={{ marginTop: "12px" }}>
              Upload from PC
            </button>
            {runtime.user_profile.avatar_url ? (
              <button
                className="mini-button"
                onClick={() =>
                  onRuntimeChange({
                    ...runtime,
                    user_profile: { ...runtime.user_profile, avatar_url: null }
                  })
                }
                type="button"
                style={{ marginTop: "8px" }}
              >
                Remove Avatar
              </button>
            ) : null}
          </div>

          <div className="profile-form">
            <label>
              Username
              <input
                value={runtime.user_profile.username}
                onChange={(event) =>
                  onRuntimeChange({
                    ...runtime,
                    user_profile: { ...runtime.user_profile, username: event.target.value }
                  })
                }
                placeholder="Enter your username"
              />
            </label>

            <label>
              Avatar URL (optional)
              <input
                value={runtime.user_profile.avatar_url?.startsWith("data:") ? "" : (runtime.user_profile.avatar_url ?? "")}
                onChange={(event) =>
                  onRuntimeChange({
                    ...runtime,
                    user_profile: { ...runtime.user_profile, avatar_url: event.target.value || null }
                  })
                }
                placeholder="https://example.com/avatar.jpg"
                disabled={runtime.user_profile.avatar_url?.startsWith("data:")}
              />
              <span style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                {runtime.user_profile.avatar_url?.startsWith("data:")
                  ? "Using uploaded image from PC"
                  : "Enter an image URL or upload a file from this computer."}
              </span>
            </label>
          </div>
        </div>

        <div className="settings-footer">
          <button className="subtle-button" onClick={onClose} type="button">
            Cancel
          </button>
          <button
            disabled={busy}
            onClick={async () => {
              await onSave();
              onClose();
            }}
            type="button"
          >
            Save Profile
          </button>
        </div>
      </div>
    </div>
  );
}
