import {
  historyAPI,
  keyboardAPI,
  notificationsAPI,
  settingsAPI,
  themesAPI,
  loginAPI,
  betterDeezerAPI,
} from '../preload';

declare global {
  interface Window {
    renderer: {
      historyAPI: typeof historyAPI;
      settingsAPI: typeof settingsAPI;
      keyboardAPI: typeof keyboardAPI;
      notificationsAPI: typeof notificationsAPI;
      themesAPI: typeof themesAPI;
      loginAPI: typeof loginAPI;
      betterDeezerAPI: typeof betterDeezerAPI;
    };
  }

  declare module '*.css';
}
