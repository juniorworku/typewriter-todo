const { _electron: electron } = require(
  process.env.PLAYWRIGHT_MODULE || "playwright",
);
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
(async () => {
  const project = path.resolve(__dirname, "..");
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "pixel-ui-"));
  const vault = path.join(temp, "vault");
  await fs.mkdir(vault);
  let app;
  try {
    app = await electron.launch({
      executablePath: path.join(project, "node_modules/electron/dist/electron"),
      args: [
        ...(process.env.PIXEL_TEST_NO_SANDBOX ? ["--no-sandbox"] : []),
        project,
      ],
      env: { ...process.env, XDG_CONFIG_HOME: path.join(temp, "config") },
      timeout: 30000,
    });
    const page = await app.firstWindow();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.getByRole("heading", { level: 1 }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert.equal(
      await page.evaluate(() => document.fonts.check("16px VT323")),
      true,
    );
    await app.evaluate(({ dialog }, vault) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [vault],
      });
    }, vault);
    await page.getByRole("button", { name: "Open settings" }).click();
    await page.getByRole("dialog").waitFor();
    await page.getByRole("button", { name: "CHOOSE FOLDER..." }).click();
    await page.getByText(vault, { exact: true }).waitFor();
    assert.equal(
      await page.evaluate(async () => (await window.desk.config()).vault),
      "",
    );
    await page.getByRole("button", { name: "SAVE SETTINGS" }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });

    assert.equal(
      await page.evaluate(() => typeof window.desk.log),
      "undefined",
    );
    const entry = page.getByLabel("New task or study block");
    await entry.fill("Review transformer architecture #study");
    await entry.press("Enter");
    await page
      .getByText("Review transformer architecture #study", { exact: true })
      .waitFor();
    await entry.press("Tab");
    await entry.fill("Sketch the attention mechanism");
    await entry.press("Enter");
    await page
      .getByText("Sketch the attention mechanism", { exact: true })
      .waitFor();
    await entry.press("Shift+Tab");
    await entry.fill("Read one chapter #reading");
    await entry.press("Enter");
    await page
      .getByText("Read one chapter #reading", { exact: true })
      .waitFor();
    await page
      .getByRole("checkbox", {
        name: "Complete Sketch the attention mechanism",
      })
      .click();
    await page.waitForFunction(
      () =>
        document
          .querySelector(
            '[aria-label="Complete Sketch the attention mechanism"]',
          )
          .getAttribute("aria-checked") === "true",
    );
    let text = await fs.readFile(
      path.join(vault, "Study & Tasks", "Study-Plan.md"),
      "utf8",
    );
    assert.match(text, /  - \[x\] Sketch.*created::.*completed::/);
    await page
      .getByRole("button", {
        name: "Edit Read one chapter #reading",
        exact: true,
      })
      .click();
    await page.getByLabel("Edit task text").fill("Read chapter 4 #reading");
    await page.getByRole("button", { name: "SAVE", exact: true }).click();
    await page.getByText("Read chapter 4 #reading", { exact: true }).waitFor();
    await fs.appendFile(
      path.join(vault, "Study & Tasks", "Study-Plan.md"),
      "- [ ] Added in Obsidian\n",
    );
    await page
      .getByText("Added in Obsidian", { exact: true })
      .waitFor({ timeout: 8000 });
    await page.getByRole("button", { name: "CRT MODE", exact: true }).click();
    assert.equal(
      await page
        .locator(".desktop")
        .evaluate((el) => el.classList.contains("dark")),
      true,
    );
    await page.reload();
    await page
      .getByRole("button", { name: "PAPER MODE", exact: true })
      .waitFor();
    if (process.env.PIXEL_SCREENSHOT_DIR)
      await page.screenshot({
        path: path.join(
          process.env.PIXEL_SCREENSHOT_DIR,
          "typewriter-todo-crt.png",
        ),
        fullPage: true,
      });
    await page.getByRole("button", { name: "PAPER MODE", exact: true }).click();
    await page.getByRole("button", { name: "CRT MODE", exact: true }).waitFor();
    await entry.focus();
    await entry.press("ArrowUp");
    assert.equal(
      await page.evaluate(() =>
        document.activeElement.getAttribute("aria-label"),
      ),
      "Complete Added in Obsidian",
    );
    await page.keyboard.press("Escape");
    assert.equal(
      await page.evaluate(() =>
        document.activeElement.getAttribute("aria-label"),
      ),
      "Open settings",
    );
    await page.getByRole("heading", { level: 1 }).click();
    if (process.env.PIXEL_SCREENSHOT_DIR)
      await page.screenshot({
        path: path.join(
          process.env.PIXEL_SCREENSHOT_DIR,
          "typewriter-todo.png",
        ),
        fullPage: true,
      });
    text = await fs.readFile(
      path.join(vault, "Study & Tasks", "Study-Plan.md"),
      "utf8",
    );
    assert.match(text, /Read chapter 4 #reading \[created::/);

    assert.deepEqual(errors, []);
    console.log(
      "PASS: standalone Electron flow, native-picker bridge, bundled font, Markdown sync, and zero renderer errors.",
    );
  } finally {
    if (app) await app.close();
    await fs.rm(temp, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
