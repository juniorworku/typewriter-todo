const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { Store, stamp } = require("../electron/store.cjs");
async function setup(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pixel-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const vault = path.join(root, "vault");
  await fs.mkdir(vault);
  const store = new Store(path.join(root, "config"));
  await store.init();
  await store.save({ vault });
  return { store, root, vault };
}

test("nested task creation, completion, reopening and editing preserve timestamps and prose", async (t) => {
  const { store } = await setup(t);
  const file = await store.target(store.config.tasks, "Study-Plan.md");
  await fs.writeFile(file, "# My plan\nKeep this paragraph.\n");
  let r = await store.addTask({ text: "Read chapter #study", depth: 1 });
  assert.equal(r.tasks[0].depth, 1);
  const created = r.tasks[0].created;
  r = await store.toggle(r.tasks[0]);
  let text = await fs.readFile(file, "utf8");
  assert.match(text, /  - \[x\].*\[completed::/);
  assert.ok(text.startsWith("# My plan\nKeep this paragraph.\n"));
  r = await store.editTask({ ...r.tasks[0], text: "Review chapter #study" });
  assert.equal(r.tasks[0].created, created);
  assert.match(await fs.readFile(file, "utf8"), /Review chapter.*completed::/);
  await store.toggle(r.tasks[0]);
  text = await fs.readFile(file, "utf8");
  assert.doesNotMatch(text, /completed::/);
  assert.match(text, /created::/);
});
test("external edits are read and stale app edits cannot overwrite them", async (t) => {
  const { store } = await setup(t);
  const file = await store.target(store.config.tasks, "Study-Plan.md");
  let r = await store.addTask({ text: "Task A", depth: 0 });
  await fs.writeFile(file, "# Obsidian\n- [ ] Changed outside\n");
  await assert.rejects(store.toggle(r.tasks[0]), /changed/);
  await assert.rejects(
    store.editTask({ ...r.tasks[0], text: "Bad overwrite" }),
    /changed/,
  );
  assert.equal((await store.tasks()).tasks[0].text, "Changed outside");
});
test("fenced Markdown examples remain untouched", async (t) => {
  const { store } = await setup(t);
  const file = await store.target(store.config.tasks, "Study-Plan.md");
  await fs.writeFile(
    file,
    "```markdown\n- [ ] Example only\n```\n- [ ] Actual task\n",
  );
  const r = await store.tasks();
  assert.equal(r.tasks.length, 1);
  assert.equal(r.tasks[0].text, "Actual task");
});
test("path containment, symlink protection, serialization, and independent config", async (t) => {
  const { store, root, vault } = await setup(t);
  await assert.rejects(store.save({ tasks: "../outside" }));
  await fs.symlink(root, path.join(vault, "linked"));
  await assert.rejects(store.target("linked", "Study-Plan.md"), /escapes/);
  await Promise.all(
    Array.from({ length: 15 }, (_, i) =>
      store.addTask({ text: "Task " + i, depth: 0 }),
    ),
  );
  assert.equal((await store.tasks()).tasks.length, 15);
  const other = new Store(path.join(root, "config"));
  await other.init();
  assert.equal(other.config.vault, vault);
  assert.equal(other.config.work, undefined);
});
