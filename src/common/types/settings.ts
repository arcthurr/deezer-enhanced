export interface Settings {
  enableTray: boolean;
  closeToTray: boolean;
  startInTray: boolean;
  enableNotifications: boolean;
  volumePower: number;
  discordRPC: boolean;
  betterDeezer: boolean;
  /** See-through window (Better Deezer's translucent mode). Applied at the next start. */
  transparentWindow: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  enableTray: false,
  closeToTray: false,
  startInTray: false,
  enableNotifications: false,
  volumePower: 4,
  discordRPC: false,
  betterDeezer: true,
  transparentWindow: false,
};

type Setter<T extends keyof Settings> = (newValue: Settings[T]) => void;

export type Setters = {
  [K in keyof Settings]: Setter<K>;
};
