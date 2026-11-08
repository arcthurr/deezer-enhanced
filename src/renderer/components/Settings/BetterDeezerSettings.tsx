import { useCallback, useEffect, useState } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { useNavigate } from 'react-router';
import { currentSettingsAtom, viewExpandedAtom } from '../../states/atoms';
import { BetterDeezerState } from '../../../common/types/better_deezer';
import Switch from './Switch';

// Better Deezer modules and features that are safe to flip live. The ids are the
// ones reported by window.__betterDeezer.features() in Gabizoc/Better-Deezer.
const FEATURES: ReadonlyArray<{ id: string; text: string }> = [
  { id: 'nowplaying', text: 'Now playing view with synced lyrics' },
  { id: 'player', text: 'Floating player bar' },
  { id: 'volume', text: 'Unfolding volume slider' },
  { id: 'topbar', text: 'Centered search and Home button' },
  { id: 'ambient', text: 'Album and artist headers tinted by the cover' },
  { id: 'transitions', text: 'Smooth transitions' },
  { id: 'hide-promos', text: 'Hide promotional banners' },
  { id: 'sleep-timer', text: 'Sleep timer' },
  { id: 'accent-cover', text: 'Accent color follows the cover' },
  { id: 'compact', text: 'Compact mode' },
];

const POLL_MS = 1000;
const POLL_TRIES = 20;

function BetterDeezerSettings(): React.JSX.Element {
  const [currentSettings, setCurrentSettings] = useAtom(currentSettingsAtom);
  const setViewExpanded = useSetAtom(viewExpandedAtom);
  const navigate = useNavigate();
  const [state, setState] = useState<BetterDeezerState | null>(null);

  const enabled = currentSettings.betterDeezer;

  const refresh = useCallback(async () => {
    setState(await window.renderer.betterDeezerAPI.getState());
  }, []);

  // After switching Better Deezer on, the page reloads and the payload needs a
  // moment to report in, so keep asking for a while.
  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      const next = await window.renderer.betterDeezerAPI.getState();
      if (cancelled) return;
      setState(next);

      tries += 1;
      if (
        enabled &&
        next.available &&
        next.features === null &&
        tries < POLL_TRIES
      ) {
        timer = setTimeout(tick, POLL_MS);
      }
    };

    tick();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled]);

  const featureOn = (id: string) =>
    state?.features?.find((f) => f.id === id)?.on ?? false;

  const features = state?.features ?? null;
  const known = FEATURES.filter((f) => features?.some((x) => x.id === f.id));

  return (
    <>
      <Switch
        id="better-deezer"
        state={enabled}
        text="Better Deezer (reloads Deezer)"
        onChange={(newValue) => {
          window.renderer.settingsAPI.setSettingProperty(
            'betterDeezer',
            newValue
          );
          setCurrentSettings({ ...currentSettings, betterDeezer: newValue });
        }}
      />

      {enabled && state !== null && !state.available && (
        <p className="text-sm text-error">
          The Better Deezer payload is missing from this build. Run{' '}
          <code>git submodule update --init</code> and{' '}
          <code>npm run bd:build</code>, then rebuild.
        </p>
      )}

      {enabled && state?.available && features === null && (
        <p className="text-sm opacity-70">
          Waiting for Better Deezer to start…
        </p>
      )}

      {enabled &&
        known.map(({ id, text }) => (
          <Switch
            key={id}
            id={`bd-${id}`}
            state={featureOn(id)}
            text={text}
            onChange={(newValue) => {
              window.renderer.betterDeezerAPI.setFeature(id, newValue);
              setState((prev) =>
                prev && prev.features
                  ? {
                      ...prev,
                      features: prev.features.map((f) =>
                        f.id === id ? { ...f, on: newValue } : f
                      ),
                    }
                  : prev
              );
            }}
          />
        ))}

      {enabled && features !== null && (
        <button
          type="button"
          className="cursor-pointer font-bold text-primary text-left"
          onClick={() => {
            // The panel is drawn inside the Deezer page: bring the page back first.
            window.renderer.settingsAPI.hideSettings();
            setViewExpanded(false);
            navigate('/idle');
            window.renderer.betterDeezerAPI.openPanel();
          }}
        >
          Open Better Deezer settings (themes, Marketplace, sidebar, home…)
        </button>
      )}

      {enabled && (
        <button
          type="button"
          className="cursor-pointer text-sm opacity-70 text-left"
          onClick={refresh}
        >
          Refresh Better Deezer status
        </button>
      )}
    </>
  );
}

export default BetterDeezerSettings;
