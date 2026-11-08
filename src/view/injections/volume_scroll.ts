import { ViewWindow } from '../types';
import { callWithRetries } from './poller';

const SELECTOR = '[aria-label="volume button"]';

// Better Deezer has its own wheel handling (5% steps, 1% with Shift) on the same
// button. When it is running, ours stays out so one wheel tick is not applied twice.
const betterDeezerOwnsVolume = (viewWindow: ViewWindow) => {
  try {
    return (
      // eslint-disable-next-line no-underscore-dangle
      viewWindow.__betterDeezer
        ?.features()
        .some((f) => f.id === 'volume' && f.on && !f.failed) ?? false
    );
  } catch {
    return false;
  }
};

export const initializeVolumeScroll = () => {
  callWithRetries(SELECTOR, (element) => {
    const viewWindow: ViewWindow = window as ViewWindow;
    (element as HTMLElement).addEventListener('wheel', (e) => {
      if (betterDeezerOwnsVolume(viewWindow)) return;

      viewWindow.dzPlayer.control.setVolume(
        Math.min(
          Math.max(
            viewWindow.dzPlayer.getVolume() + e.deltaY * -0.0005660377358,
            0.0
          ),
          1.0
        )
      );
      e.preventDefault();
    });
  });
};
