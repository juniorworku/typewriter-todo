const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("node:path");
const { Store } = require("./store.cjs");
let win, store;
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    win?.show();
    win?.focus();
  });
  app
    .whenReady()
    .then(async () => {
      store = new Store(app.getPath("userData"));
      await store.init();
      const handlers = {
        config: () => store.config,
        chooseVault: async () => {
          const result = await dialog.showOpenDialog(win, {
            properties: ["openDirectory"],
          });
          return result.canceled
            ? null
            : { ...store.config, vault: result.filePaths[0] };
        },
        saveConfig: (input) => store.save(input),
        tasks: () => store.tasks(),
        addTask: (input) => store.addTask(input),
        toggle: (input) => store.toggle(input),
        editTask: (input) => store.editTask(input),
      };
      for (const [name, fn] of Object.entries(handlers))
        ipcMain.handle(name, (event, input) => {
          if (
            event.sender !== win?.webContents ||
            event.senderFrame !== win.webContents.mainFrame
          )
            throw Error("Untrusted request");
          return fn(input);
        });
      function create() {
        win = new BrowserWindow({
          width: 1100,
          height: 850,
          minWidth: 760,
          minHeight: 650,
          backgroundColor: "#f5f2eb",
          webPreferences: {
            preload: path.join(__dirname, "preload.cjs"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            backgroundThrottling: false,
          },
        });
        win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
        win.webContents.on("will-navigate", (e) => e.preventDefault());
        if (!app.isPackaged && process.env.PIXEL_DESK_DEV === "1")
          win.loadURL("http://127.0.0.1:5174");
        else win.loadFile(path.join(__dirname, "../dist/index.html"));
      }
      create();
      app.on("activate", () => {
        if (!BrowserWindow.getAllWindows().length) create();
      });
    })
    .catch((error) => {
      dialog.showErrorBox("Typewriter To-Do could not start", error.message);
      app.quit();
    });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
