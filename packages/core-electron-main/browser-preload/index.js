const net = require('net');
const os = require('os');

const { ipcRenderer } = require('electron');

const initForDevtools = () => {
  const getCapturer = () => {
    if (window.__OPENSUMI_DEVTOOLS_GLOBAL_HOOK__?.captureIpc) {
      return window.__OPENSUMI_DEVTOOLS_GLOBAL_HOOK__.captureIpc;
    }
    return;
  };

  const capture = (message) => {
    const capturer = getCapturer();
    if (capturer !== undefined) {
      capturer(message);
    }
  };

  // ipcRenderer.on
  const originalIpcRendererOn = ipcRenderer.on;
  ipcRenderer.on = (channel, handler) => {
    const proxyHandler = (event, ...args) => {
      if (channel !== 'main->browser') {
        capture({ ipcMethod: 'ipcRenderer.on', channel, args });
      }
      handler(event, ...args);
    };
    return originalIpcRendererOn.call(ipcRenderer, channel, proxyHandler);
  };

  // ipcRenderer.send
  const originalIpcRendererSend = ipcRenderer.send;
  ipcRenderer.send = (channel, ...args) => {
    capture({ ipcMethod: 'ipcRenderer.send', channel, args });
    return originalIpcRendererSend.call(ipcRenderer, channel, ...args);
  };

  // ipcRenderer.sendSync
  const originalIpcRendererSendSync = ipcRenderer.sendSync;
  ipcRenderer.sendSync = (channel, ...args) => {
    capture({ ipcMethod: 'ipcRenderer.sendSync', channel, args });
    return originalIpcRendererSendSync.call(ipcRenderer, channel, ...args);
  };

  // ipcRenderer.invoke
  const originalIpcRendererInvoke = ipcRenderer.invoke;
  ipcRenderer.invoke = (channel, ...args) => {
    capture({ ipcMethod: 'ipcRenderer.invoke', channel, args });
    return originalIpcRendererInvoke.call(ipcRenderer, channel, ...args);
  };

  // receive messages that transfered from main process and capture them
  ipcRenderer.on('main->browser', (event, message) => {
    capture(message);
  });
};

// initialize for OpenSumi DevTools
initForDevtools();

const electronEnv = {};

const urlParams = new URLSearchParams(decodeURIComponent(window.location.search));
window.id = Number(urlParams.get('windowId'));
const webContentsId = Number(urlParams.get('webContentsId'));

function createRPCNetConnection() {
  const rpcListenPath = ipcRenderer.sendSync('window-rpc-listen-path', electronEnv.currentWindowId);
  return net.createConnection(rpcListenPath);
}

function createNetConnection(connectPath) {
  return net.createConnection(connectPath);
}

electronEnv.ElectronIpcRenderer = ipcRenderer;
electronEnv.createNetConnection = createNetConnection;
electronEnv.createRPCNetConnection = createRPCNetConnection;

electronEnv.platform = os.platform();
electronEnv.osRelease = os.release();

electronEnv.isElectronRenderer = true;
electronEnv.BufferBridge = Buffer;
electronEnv.currentWindowId = window.id;
electronEnv.currentWebContentsId = webContentsId;
electronEnv.onigWasmPath = require.resolve('vscode-oniguruma/release/onig.wasm');

const metaData = JSON.parse(ipcRenderer.sendSync('window-metadata', electronEnv.currentWindowId));

electronEnv.metadata = metaData;
process.env = Object.assign({}, process.env, metaData.env, { WORKSPACE_DIR: metaData.workspace });

electronEnv.appPath = metaData.appPath;
electronEnv.env = Object.assign({}, process.env);
electronEnv.webviewPreload = metaData.webview.webviewPreload;
electronEnv.plainWebviewPreload = metaData.webview.plainWebviewPreload;
electronEnv.env.EXTENSION_DIR = metaData.extensionDir[0];

global.electronEnv = electronEnv;
Object.assign(global, electronEnv);

if (metaData.preloads) {
  metaData.preloads.forEach((preload) => {
    require(preload);
  });
}
