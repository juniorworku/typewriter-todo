const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld(
  "desk",
  Object.fromEntries(
    [
      "config",
      "chooseVault",
      "saveConfig",
      "tasks",
      "addTask",
      "toggle",
      "editTask",
    ].map((name) => [name, (data) => ipcRenderer.invoke(name, data)]),
  ),
);
