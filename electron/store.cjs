const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const stamp = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
const clean = (s, max = 2000) => {
  if (typeof s !== "string" || s.length > max) throw Error("Invalid text");
  return s.replace(/[\r\n]/g, " ").replace(/<!--/g, "&lt;!--");
};
class Store {
  constructor(configDir) {
    this.dir = configDir;
    this.queue = Promise.resolve();
  }
  serial(fn) {
    const next = this.queue.then(fn);
    this.queue = next.catch(() => {});
    return next;
  }
  async init() {
    await fs.mkdir(this.dir, { recursive: true });
    try {
      this.config = JSON.parse(
        await fs.readFile(path.join(this.dir, "config.json"), "utf8"),
      );
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
      this.config = {
        vault: "",

        tasks: "Study & Tasks",

        sound: false,
        dark: false,
      };
    }
    return this.config;
  }
  async save(input) {
    const c = { ...this.config, ...input };
    for (const k of ["tasks"]) {
      if (
        typeof c[k] !== "string" ||
        !c[k].trim() ||
        path.isAbsolute(c[k]) ||
        c[k].split(/[\\/]/).some((x) => x === ".." || x === "." || !x)
      )
        throw Error("Use a relative subfolder without traversal.");
    }
    if (c.vault) {
      c.vault = await fs.realpath(c.vault);
      if (!(await fs.stat(c.vault)).isDirectory())
        throw Error("Choose a directory");
    }
    await this.serial(async () => {
      const tmp = path.join(this.dir, "config.tmp");
      await fs.writeFile(tmp, JSON.stringify(c, null, 2));
      await fs.rename(tmp, path.join(this.dir, "config.json"));
      this.config = c;
    });
    return c;
  }
  async target(folder, name) {
    if (!this.config.vault)
      throw Error("Choose an Obsidian vault in Settings first.");
    const base = await fs.realpath(this.config.vault);
    let current = base;
    for (const piece of folder.split(/[\\/]/)) {
      if (!piece || piece === ".." || piece === "." || path.isAbsolute(piece))
        throw Error("Invalid folder");
      current = path.join(current, piece);
      try {
        await fs.mkdir(current);
      } catch (e) {
        if (e.code !== "EEXIST") throw e;
      }
      const actual = await fs.realpath(current);
      if (!actual.startsWith(base + path.sep))
        throw Error("Folder escapes the selected vault");
      current = actual;
    }
    const file = path.join(current, name);
    try {
      if ((await fs.lstat(file)).isSymbolicLink())
        throw Error("Refusing symbolic-link note");
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    return file;
  }
  async read(file) {
    try {
      return await fs.readFile(file, "utf8");
    } catch (e) {
      if (e.code === "ENOENT") return "";
      throw e;
    }
  }
  async tasks() {
    const file = await this.target(this.config.tasks, "Study-Plan.md");
    const text = await this.read(file);
    let fence = null;
    return {
      text,
      tasks: text.split(/\r?\n/).flatMap((line, index) => {
        const mark = line.match(/^\s*(`{3,}|~{3,})/);
        if (mark) {
          if (!fence) fence = mark[1];
          else if (mark[1][0] === fence[0] && mark[1].length >= fence.length)
            fence = null;
          return [];
        }
        if (fence) return [];
        const m = line.match(/^(\s*)- \[([ xX])\] (.*)$/);
        if (!m) return [];
        return [
          {
            line: index,
            raw: line,
            done: m[2] !== " ",
            depth: Math.floor(m[1].length / 2),
            text: m[3].replace(/ \[(?:created|completed)::[^\]]*\]/g, ""),
            created: m[3].match(/\[created:: ([^\]]+)\]/)?.[1] || "",
          },
        ];
      }),
    };
  }
  async addTask(input) {
    return this.serial(async () => {
      const text = clean(input.text, 1000).trim();
      if (!text) throw Error("Enter a task");
      const depth = Number(input.depth) || 0;
      if (depth < 0 || depth > 5) throw Error("Invalid nesting");
      const file = await this.target(this.config.tasks, "Study-Plan.md");
      const old = await this.read(file);
      await fs.appendFile(
        file,
        `${old && !old.endsWith("\n") ? "\n" : ""}${"  ".repeat(depth)}- [ ] ${text} [created:: ${stamp()}]\n`,
      );
      return this.tasks();
    });
  }
  async toggle(input) {
    return this.serial(async () => {
      const file = await this.target(this.config.tasks, "Study-Plan.md");
      const old = await this.read(file);
      const lines = old.split("\n");
      if (lines[input.line]?.replace(/\r$/, "") !== input.raw)
        throw Error("This note changed in Obsidian. Refresh and try again.");
      let line = lines[input.line];
      const done = /^- \[[xX]\]/.test(line.trimStart());
      line = line
        .replace(/\[[ xX]\]/, done ? "[ ]" : "[x]")
        .replace(/ \[completed::[^\]]*\]/g, "");
      if (!done) line = line.replace(/\r$/, "") + ` [completed:: ${stamp()}]`;
      lines[input.line] = line;
      const tmp = file + "." + crypto.randomUUID() + ".tmp";
      await fs.writeFile(tmp, lines.join("\n")); // Recheck external edits immediately before committing.
      if ((await this.read(file)) !== old) {
        await fs.unlink(tmp);
        throw Error("Note changed during sync. Refresh and try again.");
      }
      await fs.rename(tmp, file);
      return this.tasks();
    });
  }
  async editTask(input) {
    return this.serial(async () => {
      const file = await this.target(this.config.tasks, "Study-Plan.md");
      const old = await this.read(file);
      const lines = old.split("\n");
      if (lines[input.line]?.replace(/\r$/, "") !== input.raw)
        throw Error("This note changed in Obsidian. Refresh and try again.");
      const text = clean(input.text, 1000).trim();
      if (!text) throw Error("Enter task text.");
      const match = lines[input.line].match(/^(\s*- \[[ xX]\] )/);
      if (!match) throw Error("Invalid task row");
      const fields =
        lines[input.line].match(/ \[(?:created|completed)::[^\]]*\]/g) || [];
      lines[input.line] = match[1] + text + fields.join("");
      const tmp = file + "." + crypto.randomUUID() + ".tmp";
      await fs.writeFile(tmp, lines.join("\n"));
      if ((await this.read(file)) !== old) {
        await fs.unlink(tmp);
        throw Error("Note changed during sync. Refresh and try again.");
      }
      await fs.rename(tmp, file);
      return this.tasks();
    });
  }
}
module.exports = { Store, stamp };
