export interface BetterDeezerFeature {
  id: string;
  on: boolean;
  failed: boolean;
}

export interface BetterDeezerState {
  /** assets/better-deezer.user.js exists (the submodule was built). */
  available: boolean;
  /** Reported by the running payload, null when it is not (yet) running. */
  features: BetterDeezerFeature[] | null;
}
