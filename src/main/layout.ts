import { BaseWindow, WebContentsView } from 'electron';
import { NAVBAR_HEIGHT } from './utils/size';

/**
 * Window layout. The window holds two views: `mainView` (the app's own React UI:
 * login, legacy settings, download log) and `view` (the Deezer page).
 *
 * With Better Deezer on, the back / forward / download / settings buttons live in
 * Better Deezer's top bar inside the Deezer page, so the page fills the whole window
 * and `mainView` is hidden until a page of its own (login, log) is needed. With it
 * off, the old layout stays: a 48px strip of the app's UI above the Deezer page.
 */
const state = { betterDeezer: true, loggedIn: false, overlayOpen: false };

export const setLayoutState = (patch: Partial<typeof state>) => {
  Object.assign(state, patch);
};

export const navbarHeight = () => (state.betterDeezer ? 0 : NAVBAR_HEIGHT);

export const applyLayout = (
  window: BaseWindow,
  mainView: WebContentsView,
  view: WebContentsView
) => {
  const zoom = mainView.webContents.getZoomFactor();
  const { width, height } = window.getBounds();
  const top = Math.round(navbarHeight() * zoom);

  mainView.setBounds({ x: 0, y: 0, width, height });
  view.setBounds({ x: 0, y: top, width, height: height - top });
  mainView.setVisible(
    !(state.betterDeezer && state.loggedIn && !state.overlayOpen)
  );
};
