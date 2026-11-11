type Config = { vault: string; tasks: string; sound: boolean; dark: boolean };
import { useState, useRef } from "react";
export function useSounds() {
  const ctx = useRef<AudioContext | null>(null);
  function unlock() {
    ctx.current ??= new AudioContext();
    void ctx.current.resume();
  }
  function play(kind: "key" | "return") {
    if (!ctx.current) return;
    const c = ctx.current;
    const notes = kind === "return" ? [440, 220] : [120 + Math.random() * 100];
    notes.forEach((f, i) => {
      const o = c.createOscillator(),
        g = c.createGain(),
        at = c.currentTime + i * 0.12;
      o.type = kind === "key" ? "triangle" : "square";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.035, at);
      g.gain.exponentialRampToValueAtTime(
        0.001,
        at + (kind === "key" ? 0.035 : 0.12),
      );
      o.connect(g).connect(c.destination);
      o.start(at);
      o.stop(at + 0.14);
    });
  }
  return { unlock, play };
}
export function Settings({
  config,
  onSave,
  onClose,
}: {
  config: Config;
  onSave: (c: Config) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(config),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  return (
    <div className="shade">
      <section
        className="modal pixel"
        role="dialog"
        aria-modal="true"
        aria-label="Vault settings"
        onKeyDown={(e) => {
          if (e.key !== "Tab") return;
          const nodes = e.currentTarget.querySelectorAll<HTMLElement>(
            "button:not(:disabled), input:not(:disabled)",
          );
          const first = nodes[0],
            last = nodes[nodes.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }}
      >
        <header>
          <h2>VAULT / SETTINGS</h2>
          <button autoFocus onClick={onClose} aria-label="Close settings">
            X
          </button>
        </header>
        <label>OBSIDIAN VAULT</label>
        <p className="path">{draft.vault || "NO VAULT CONNECTED"}</p>
        <button
          onClick={async () => {
            try {
              const c = await window.desk.chooseVault();
              if (c) setDraft({ ...draft, vault: c.vault });
            } catch (e) {
              setError(String(e));
            }
          }}
        >
          CHOOSE FOLDER...
        </button>
        <label>
          TARGET SUBFOLDER
          <input
            value={draft.tasks}
            onChange={(e) =>
              setDraft({
                ...draft,
                tasks: e.target.value,
              })
            }
          />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={draft.sound}
            onChange={(e) => setDraft({ ...draft, sound: e.target.checked })}
          />{" "}
          KEY + CARRIAGE SOUNDS
        </label>
        {error && <p role="alert">{error}</p>}
        <button
          disabled={saving}
          className="primary"
          onClick={async () => {
            setSaving(true);
            try {
              await onSave(draft);
              onClose();
            } catch (e) {
              setError(String(e));
            } finally {
              setSaving(false);
            }
          }}
        >
          SAVE SETTINGS
        </button>
        <p className="muted">
          All files stay local. Escape closes this window.
        </p>
      </section>
    </div>
  );
}
