import { app, BaseWindow, session, WebContentsView } from 'electron';
import path from 'path';
import fs from 'fs';
import { createHistoryHandles } from './main/history';
import {
  getSettings,
  initializeSettings,
  wantsTransparentWindow,
} from './main/settings';
import { initializeApp } from './main/app';
import { setLayoutState } from './main/layout';
import { loadBounds } from './main/bounds/load';
import { saveBounds } from './main/bounds/save';
import { initializePlayer } from './main/mpris';
import { initializeThemeSwitcher } from './main/theme_switcher';
import { createKeyboardHandles } from './main/keyboard';
import { DEEZER_URL } from './main/utils/urls';
import { generateMenu } from './main/menu';
import { initializeZoom, onDimensionsChange } from './main/zoom';
import { DEFAULT_HEIGHT, DEFAULT_WIDTH } from './main/utils/size';
import {
  createLoginHandles,
  handleLoginProtocol,
  isLoggedIn,
  isValidArlCookie,
} from './main/login';
import { LOGIN_ON_LOGIN, LOGIN_ON_LOGOUT } from './common/channels/login';
import { DEEZER_LOGIN_PROTOCOL, DEEZER_LOGIN_URL } from './main/utils/login';
import {
  initializeBetterDeezer,
  injectBetterDeezer,
} from './main/better_deezer';

const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const gotTheLock = app.requestSingleInstanceLock();

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(DEEZER_LOGIN_PROTOCOL, process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient(DEEZER_LOGIN_PROTOCOL);
}

if (!gotTheLock) {
  app.quit();
} else {
  // AudioServiceOutOfProcess is a workaround for github.com/electron/electron/issues/27581 and can be removed once upstream merges a fix
  app.commandLine.appendSwitch(
    'disable-features',
    'AudioServiceOutOfProcess,MediaSessionService'
  );

  const createWindow = () => {
    session.defaultSession.setUserAgent(USER_AGENT);

    // Only the Deezer API needs the CORS header; other origins keep their own policy.
    session.defaultSession.webRequest.onHeadersReceived(
      { urls: ['https://api.deezer.com/*'] },
      (details, callback) => {
        if (
          details.responseHeaders === undefined ||
          (details.responseHeaders['Access-Control-Allow-Origin'] ===
            undefined &&
            details.responseHeaders['access-control-allow-origin'] ===
              undefined)
        ) {
          callback({
            responseHeaders: {
              ...details.responseHeaders,
              'Access-Control-Allow-Origin': ['*'],
            },
          });
        } else {
          callback(details);
        }
      }
    );

    // Better Deezer's see-through mode: the window has to be created transparent.
    const transparent = wantsTransparentWindow();

    const mainWindow = new BaseWindow({
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      autoHideMenuBar: true,
      show: false,
      ...(transparent
        ? { transparent: true, backgroundColor: '#00000000' }
        : {}),
      icon: path.join(
        app.isPackaged ? process.resourcesPath : '.',
        'assets',
        'icon.png'
      ),
    });

    mainWindow.removeMenu();

    const mainView = new WebContentsView({
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      mainView.webContents.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
      mainView.webContents.loadFile(
        path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
      );
    }

    mainView.setBounds({
      x: 0,
      y: 0,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
    });

    const view = new WebContentsView({
      webPreferences: {
        preload: path.join(__dirname, 'preload_view.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    view.webContents.setWindowOpenHandler(() => {
      return { action: 'deny' };
    });

    if (transparent) {
      view.setBackgroundColor('#00000000');
      mainView.setBackgroundColor('#00000000');
    }

    const onLayout = () => onDimensionsChange(mainWindow, mainView, view);

    initializeSettings(mainWindow, mainView, view, onLayout).then(() =>
      loadBounds(mainWindow, mainView, view)
    );
    initializeApp({ transparent });
    initializePlayer(mainView, view);
    initializeThemeSwitcher(mainView, view);
    initializeZoom(mainWindow, mainView, view);
    initializeBetterDeezer(mainWindow, view);
    createHistoryHandles(view);
    createKeyboardHandles(view);
    createLoginHandles(view);

    mainView.webContents.on('context-menu', (_, properties) => {
      generateMenu(mainWindow, mainView, mainView, view, properties).popup({
        x: properties.x,
        y: properties.y,
      });
    });

    view.webContents.once('did-finish-load', () => {
      view.webContents.on('context-menu', (_, properties) => {
        generateMenu(mainWindow, view, mainView, view, properties).popup({
          x: properties.x,
          y: properties.y,
        });
      });
    });

    view.webContents.on('did-finish-load', async () => {
      fs.readFile(path.join(__dirname, '../build/view.js'), (err, data) => {
        if (err === null) {
          view.webContents.executeJavaScript(data.toString());
        }
      });

      injectBetterDeezer(view);

      if (await isLoggedIn(view)) {
        setLayoutState({ loggedIn: true, overlayOpen: false });
        mainView.webContents.send(LOGIN_ON_LOGIN);
        mainWindow.contentView.addChildView(view);
      } else {
        setLayoutState({ loggedIn: false });
        mainWindow.contentView.removeChildView(view);
        mainView.webContents.send(LOGIN_ON_LOGOUT);
      }
      onLayout();
    });

    // We listen to cookie addition and filter for the addition of session specific
    // cookie, so we can redirect, after redirect this is handled through did-finish-load
    view.webContents.session.cookies.on(
      'changed',
      (event, cookie, cause, removed) => {
        if (!isValidArlCookie(cookie)) return;

        if (!removed) {
          view.webContents.loadURL(DEEZER_LOGIN_URL);
        }
      }
    );

    mainWindow.contentView.addChildView(mainView);

    mainWindow.on('resize', () =>
      onDimensionsChange(mainWindow, mainView, view)
    );

    mainWindow.on('close', (e) => {
      if (getSettings().closeToTray && getSettings().enableTray) {
        e.preventDefault();
        mainWindow.hide();
        return false;
      }

      saveBounds(mainWindow, view);
      return true;
    });

    app.on('second-instance', (event, argv) => {
      handleLoginProtocol(view, argv);
    });

    view.webContents.loadURL(DEEZER_URL);
  };

  app.on('ready', createWindow);

  app.on('second-instance', () => {
    if (BaseWindow.getAllWindows().length > 0) {
      const window = BaseWindow.getAllWindows()[0];
      if (window.isMinimized() || !window.isVisible()) {
        window.show();
        return;
      }

      window.focus();
    }
  });

  app.on('browser-window-created', (_, window) => {
    window.setMenuBarVisibility(false);
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
