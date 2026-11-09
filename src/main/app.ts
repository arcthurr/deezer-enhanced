import { app, ipcMain } from 'electron';
import { APP_RELAUNCH, APP_WINDOW_STATE } from '../common/channels/app';
import { WindowState } from '../common/types/app';

/** Window-level actions the Better Deezer settings panel (in the Deezer page) asks for. */
export const initializeApp = (state: WindowState) => {
  ipcMain.handle(APP_WINDOW_STATE, (): WindowState => state);

  ipcMain.on(APP_RELAUNCH, () => {
    app.relaunch();
    app.exit(0);
  });
};
