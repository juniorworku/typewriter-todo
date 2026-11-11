import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Settings, useSounds } from "./shared";
import "./style.css";
type Config = { vault: string; tasks: string; sound: boolean; dark: boolean };
type Task = {
  line: number;
  raw: string;
  done: boolean;
  depth: number;
  text: string;
  created: string;
};
type Rows = { tasks: Task[] };
declare global {
  interface Window {
    desk: {
      config: () => Promise<Config>;
      chooseVault: () => Promise<Config | null>;
      saveConfig: (c: Config) => Promise<Config>;
      tasks: () => Promise<Rows>;
      addTask: (t: { text: string; depth: number }) => Promise<Rows>;
      toggle: (t: Task) => Promise<Rows>;
      editTask: (t: Task & { text: string }) => Promise<Rows>;
    };
  }
}
function App() {
  const [c, setC] = useState<Config>({
      vault: "",
      tasks: "Study & Tasks",
      sound: false,
      dark: false,
    }),
    [settings, setSettings] = useState(false),
    [tasks, setTasks] = useState<Task[]>([]),
    [draft, setDraft] = useState(""),
    [depth, setDepth] = useState(0),
    [error, setError] = useState(""),
    [status, setStatus] = useState("A BLANK PAGE IS A GOOD START."),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState<Task | null>(null),
    [edited, setEdited] = useState("");
  const input = useRef<HTMLInputElement>(null),
    list = useRef<HTMLDivElement>(null),
    refreshing = useRef(false);
  const audio = useSounds();
  async function run(fn: () => Promise<void>) {
    try {
      setError("");
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  async function refresh(quiet = false) {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const r = await window.desk.tasks();
      setTasks(r.tasks);
      if (!quiet) setStatus("REFRESHED FROM STUDY-PLAN.MD");
    } finally {
      refreshing.current = false;
    }
  }
  useEffect(() => {
    void run(async () => {
      const next = await window.desk.config();
      setC(next);
      if (next.vault) await refresh(true);
    });
  }, []);
  useEffect(() => {
    if (!c.vault) return;
    const handler = () => void run(() => refresh(true));
    window.addEventListener("focus", handler);
    const poll = setInterval(handler, 2500);
    return () => {
      clearInterval(poll);
      window.removeEventListener("focus", handler);
    };
  }, [c.vault]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSettings(false);
        setEditing(null);
        if (settings || editing) input.current?.focus();
        else
          (
            document.querySelector(
              '[aria-label="Open settings"]',
            ) as HTMLElement
          )?.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !settings) {
        e.preventDefault();
        input.current?.focus();
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "r" &&
        !settings
      ) {
        e.preventDefault();
        void run(() => refresh());
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });
  function center(el: HTMLElement) {
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  }
  function key(e: React.KeyboardEvent) {
    audio.unlock();
    if (c.sound && e.key.length === 1) audio.play("key");
  }
  async function add() {
    if (busy) return;
    setBusy(true);
    await run(async () => {
      const r = await window.desk.addTask({ text: draft, depth });
      setTasks(r.tasks);
      setDraft("");
      setStatus("NEW LINE SAVED. ONE SMALL STEP FORWARD.");
      if (c.sound) audio.play("return");
      requestAnimationFrame(() => {
        input.current?.focus();
        if (input.current) center(input.current);
      });
    });
    setBusy(false);
  }
  async function preference(change: Partial<Config>) {
    await run(async () =>
      setC(await window.desk.saveConfig({ ...c, ...change })),
    );
  }
  const done = tasks.filter((t) => t.done).length;
  return (
    <div className={"desktop typewriter " + (c.dark ? "dark" : "")}>
      <div className="window pixel">
        <header className="titlebar">
          <span>▤ TYPEWRITER TO-DO</span>
          <div>
            <button
              onClick={() => {
                audio.unlock();
                void preference({ sound: !c.sound });
              }}
            >
              {c.sound ? "KEYS: ON" : "KEYS: OFF"}
            </button>
            <button onClick={() => void preference({ dark: !c.dark })}>
              {c.dark ? "PAPER MODE" : "CRT MODE"}
            </button>
            <button
              aria-label="Open settings"
              onClick={() => setSettings(true)}
            >
              SETUP [+]
            </button>
          </div>
        </header>
        <main>
          <div className="intro">
            <span className="eyebrow">THE DAILY DISPATCH / YOUR OWN PACE</span>
            <span className="badge">
              {new Date().toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
          <h1>ONE LINE AT A TIME.</h1>
          <p className="subtitle">
            To-dos, study plans, and little things worth finishing.
          </p>
          <div className="paper-title">
            <span>STUDY-PLAN.MD</span>
            <span>
              {done} / {tasks.length} COMPLETE{" "}
              <button onClick={() => void run(() => refresh())}>
                ↻ REFRESH
              </button>
            </span>
          </div>
          <section className="paper pixel">
            <div className="ruler">
              1.........2.........3.........4.........5.........6.........7
            </div>
            <div
              ref={list}
              className="lines"
              aria-label="Task list"
              onKeyDown={(e) => {
                if ((e.target as HTMLElement).tagName === "INPUT") return;
                const rows = Array.from(
                  list.current?.querySelectorAll<HTMLButtonElement>(
                    ".row-toggle",
                  ) || [],
                );
                const index = rows.indexOf(
                  document.activeElement as HTMLButtonElement,
                );
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  const next = rows[index + (e.key === "ArrowDown" ? 1 : -1)];
                  if (next) next.focus();
                  else input.current?.focus();
                }
              }}
            >
              {!tasks.length && (
                <div className="empty">
                  <span className="pixel-typewriter">▥</span>
                  <p>THE PAPER IS FRESH.</p>
                  <small>Start with one small thing below.</small>
                </div>
              )}
              {tasks.map((t, i) => (
                <div
                  className={"task-row " + (t.done ? "done" : "")}
                  key={t.line}
                  style={{ paddingLeft: t.depth * 24 }}
                >
                  <span className="line-number">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <button
                    className="row-toggle"
                    role="checkbox"
                    aria-checked={t.done}
                    aria-label={"Complete " + t.text}
                    onFocus={(e) => center(e.currentTarget)}
                    onClick={() =>
                      void run(async () => {
                        setTasks((await window.desk.toggle(t)).tasks);
                        setStatus("CHECKPOINT SAVED.");
                      })
                    }
                  >
                    {t.done ? "X" : " "}
                  </button>
                  <div className="task-text">
                    {editing?.line === t.line ? (
                      <form
                        className="edit-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void run(async () => {
                            setTasks(
                              (
                                await window.desk.editTask({
                                  ...editing,
                                  text: edited,
                                })
                              ).tasks,
                            );
                            setEditing(null);
                            setStatus("EDIT SAVED TO YOUR VAULT.");
                          });
                        }}
                      >
                        <input
                          aria-label="Edit task text"
                          autoFocus
                          value={edited}
                          maxLength={1000}
                          onChange={(e) => setEdited(e.target.value)}
                          onKeyDown={key}
                        />
                        <button>SAVE</button>
                        <button type="button" onClick={() => setEditing(null)}>
                          CANCEL
                        </button>
                      </form>
                    ) : (
                      <>
                        <span>{t.text}</span>
                        <small>
                          {t.created
                            ? "CREATED " + t.created
                            : "FROM YOUR VAULT"}
                          {t.done ? " / COMPLETED" : ""}
                        </small>
                      </>
                    )}
                  </div>
                  {editing?.line !== t.line && (
                    <button
                      className="edit-button"
                      aria-label={"Edit " + t.text}
                      onClick={() => {
                        setEditing(t);
                        setEdited(t.text);
                      }}
                    >
                      EDIT
                    </button>
                  )}
                </div>
              ))}
            </div>
            <form
              className="entry"
              onSubmit={(e) => {
                e.preventDefault();
                void add();
              }}
            >
              <span className="prompt">{"›".repeat(depth + 1)}</span>
              <input
                ref={input}
                aria-label="New task or study block"
                placeholder="Type a task. Press Enter. Keep going..."
                maxLength={1000}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onFocus={(e) => center(e.target)}
                onKeyDown={(e) => {
                  key(e);
                  if (e.key === "Tab" && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                    setDepth((d) =>
                      Math.min(5, Math.max(0, d + (e.shiftKey ? -1 : 1))),
                    );
                  }
                  if (e.key === "ArrowUp" && !draft) {
                    e.preventDefault();
                    list.current
                      ?.querySelectorAll<HTMLButtonElement>(".row-toggle")
                      [tasks.length - 1]?.focus();
                  }
                }}
              />
              <button disabled={busy || !draft.trim()} className="primary">
                {busy ? "..." : "ADD ↵"}
              </button>
            </form>
            <div className="paper-footer">
              INDENT: {depth} / 5 <span>TAB: INDENT · SHIFT+TAB: OUTDENT</span>
            </div>
          </section>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <div className="status pixel">
            <span className={"light " + (c.vault ? "on" : "")} />
            <span>
              {c.vault ? status : "OPEN SETUP TO CONNECT AN OBSIDIAN VAULT."}
            </span>
          </div>
          <footer>
            <span>CTRL/CMD + ENTER: NEW LINE · CTRL/CMD + R: SYNC</span>
            <span>PLAIN TEXT. REAL PROGRESS.</span>
          </footer>
        </main>
      </div>
      {settings && (
        <Settings
          config={c}
          onClose={() => setSettings(false)}
          onSave={async (config) => {
            setC(await window.desk.saveConfig(config));
            await refresh(true);
          }}
        />
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
