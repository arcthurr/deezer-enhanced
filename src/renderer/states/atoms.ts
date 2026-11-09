import { atom } from 'jotai';
import { DEFAULT_SETTINGS, Settings } from '../../common/types/settings';

export const currentSettingsAtom = atom<Settings>(DEFAULT_SETTINGS);

export const viewExpandedAtom = atom<boolean>(false);
