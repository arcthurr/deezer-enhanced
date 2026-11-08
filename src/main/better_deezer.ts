import { app, BaseWindow, ipcMain, WebContentsView } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import {
  BD_GET_STATE,
  BD_OPEN_PANEL,
  BD_SET_FEATURE,
} from '../common/channels/better_deezer';
import {
  BetterDeezerFeature,
  BetterDeezerState,
} from '../common/types/better_deezer';
import { getSettings } from './settings';

const PAYLOAD = 'better-deezer.user.js';

// Same place as the icon: assets/ is an extraResource (forge.config.ts).
const payloadPath = () =>
  path.join(
    app.isPackaged ? process.resourcesPath : app.getAppPath(),
    'assets',
    PAYLOAD
  );

const evaluate = async <T>(
  view: WebContentsView,
  code: string
): Promise<T | null> => {
  try {
    return (await view.webContents.executeJavaScript(code)) as T;
  } catch {
    return null;
  }
};

/** Runs Better Deezer inside the Deezer page. Safe to call on every page load. */
export const injectBetterDeezer = async (view: WebContentsView) => {
  if (!getSettings().betterDeezer) return;

  try {
    const code = await fs.readFile(payloadPath(), { encoding: 'utf-8' });
    // The payload ignores a second injection (window.__betterDeezer guard).
    await view.webContents.executeJavaScript(code);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`Better Deezer could not be injected from ${payloadPath()}`);
    // eslint-disable-next-line no-console
    console.warn(err);
  }
};

export const initializeBetterDeezer = (
  window: BaseWindow,
  view: WebContentsView
) => {
  ipcMain.handle(BD_GET_STATE, async (): Promise<BetterDeezerState> => {
    const available = await fs.access(payloadPath()).then(
      () => true,
      () => false
    );

    const features = getSettings().betterDeezer
      ? await evaluate<BetterDeezerFeature[] | null>(
          view,
          'window.__betterDeezer ? window.__betterDeezer.features() : null'
        )
      : null;

    return { available, features };
  });

  ipcMain.on(BD_SET_FEATURE, (_, id: string, on: boolean) => {
    // The id ends up in evaluated code: only plain feature ids.
    if (typeof id !== 'string' || !/^[a-z0-9-]+$/i.test(id)) return;

    evaluate(
      view,
      `window.__betterDeezer && window.__betterDeezer.${
        on ? 'enable' : 'disable'
      }(${JSON.stringify(id)})`
    );
  });

  // Better Deezer's own panel (themes, marketplace, sidebar, home...) lives inside
  // the Deezer page, so the page has to be on screen for it to be seen.
  ipcMain.on(BD_OPEN_PANEL, () => {
    window.contentView.addChildView(view);
    view.webContents.focus();
    evaluate(view, 'window.__betterDeezer && window.__betterDeezer.settings()');
  });
};
