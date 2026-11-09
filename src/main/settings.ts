import { BaseWindow, WebContentsView, app, ipcMain } from 'electron';
import fs from 'fs/promises';
import { readFileSync } from 'fs';
import path from 'path';
import {
  SETTINGS_GET,
  SETTINGS_HIDE,
  SETTINGS_RESET,
  SETTINGS_SET_PROPERTY,
  SETTINGS_SHOW,
} from '../common/channels/settings';
import { DEFAULT_SETTINGS, Settings, Setters } from '../common/types/settings';
import { connectDiscord, disconnectDiscord } from './discord';
import { destroyTray, initializeTray } from './tray';
import { setLayoutState } from './layout';

const SETTINGS_FILE = path.join(app.getPath('userData'), 'preferences.json');

let OnSet: Setters;

let currentSettings: Settings = { ...DEFAULT_SETTINGS };

const loadFromFile = async (file: string) => {
  try {
    const data = await fs.readFile(file, { encoding: 'utf-8' });

    currentSettings = {
      ...DEFAULT_SETTINGS,
      ...JSON.parse(data),
    };

    OnSet.enableTray(currentSettings.enableTray);
    OnSet.closeToTray(currentSettings.closeToTray);
    OnSet.startInTray(currentSettings.startInTray);
    OnSet.enableNotifications(currentSettings.enableNotifications);
    OnSet.volumePower(currentSettings.volumePower);
    OnSet.discordRPC(currentSettings.discordRPC);
    setLayoutState({ betterDeezer: currentSettings.betterDeezer });
  } catch {
    // eslint-disable-next-line no-console
    console.warn(`Error trying to read settings from file: ${file}`);
  }
};

/**
 * Window transparency can only be chosen when the window is created, before the
 * async settings load: read just that flag, synchronously.
 */
export const wantsTransparentWindow = (): boolean => {
  try {
    const stored = JSON.parse(
      readFileSync(SETTINGS_FILE, { encoding: 'utf-8' })
    );
    return stored.transparentWindow === true && stored.betterDeezer !== false;
  } catch {
    return false;
  }
};

const saveToFile = async (file: string) => {
  await fs.writeFile(file, JSON.stringify(currentSettings, null, 4), {
    encoding: 'utf-8',
  });
};

/** Only known keys with a value of the right type come in (the Deezer page can send too). */
const isValidSetting = (key: unknown, value: unknown): key is keyof Settings =>
  typeof key === 'string' &&
  Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key) &&
  typeof value === typeof DEFAULT_SETTINGS[key as keyof Settings] &&
  (typeof value !== 'number' ||
    (Number.isFinite(value) && value >= 0 && value <= 100));

const createSettingsHandles = (
  window: BaseWindow,
  mainView: WebContentsView,
  view: WebContentsView,
  onLayout: () => void
) => {
  const apply = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    currentSettings[key] = value;
    OnSet[key](value);
    // Both UIs stay in sync, whichever one changed the setting.
    view.webContents.send(SETTINGS_SET_PROPERTY, key, value);
    mainView.webContents.send(SETTINGS_SET_PROPERTY, key, value);
  };

  ipcMain.handle(SETTINGS_GET, () => {
    return currentSettings;
  });

  ipcMain.on(
    SETTINGS_SET_PROPERTY,
    (_: Electron.IpcMainEvent, key: unknown, value: unknown) => {
      if (!isValidSetting(key, value)) return;

      apply(key, value as never);
      saveToFile(SETTINGS_FILE);
    }
  );

  ipcMain.on(SETTINGS_RESET, () => {
    const previous = currentSettings;
    currentSettings = { ...DEFAULT_SETTINGS };

    (Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[])
      .filter((key) => previous[key] !== DEFAULT_SETTINGS[key])
      .forEach((key) => apply(key, DEFAULT_SETTINGS[key] as never));

    saveToFile(SETTINGS_FILE);
  });

  // The app's own pages (login, legacy settings, download log) live in mainView.
  ipcMain.on(SETTINGS_SHOW, () => {
    setLayoutState({ overlayOpen: true });
    window.contentView.removeChildView(view);
    onLayout();
  });

  ipcMain.on(SETTINGS_HIDE, () => {
    setLayoutState({ overlayOpen: false });
    window.contentView.addChildView(view);
    onLayout();
  });
};

export const initializeSettings = async (
  window: BaseWindow,
  mainView: WebContentsView,
  view: WebContentsView,
  onLayout: () => void
) => {
  OnSet = {
    enableTray: (enabled) => {
      if (enabled) {
        initializeTray(window, view);
      } else {
        destroyTray();
      }
    },
    closeToTray: () => {},
    startInTray: () => {},
    enableNotifications: () => {},
    volumePower: () => {},
    discordRPC: (enabled) => {
      if (enabled) {
        connectDiscord();
      } else {
        disconnectDiscord();
      }
    },
    // Better Deezer is injected on page load, so a change needs a reload.
    betterDeezer: (enabled) => {
      setLayoutState({ betterDeezer: enabled });
      onLayout();
      view.webContents.reload();
    },
    // Chosen when the window is created: takes effect at the next start.
    transparentWindow: () => {},
  };

  await loadFromFile(SETTINGS_FILE);
  createSettingsHandles(window, mainView, view, onLayout);
};

export const getSettings = () => currentSettings;
