import { Platform } from 'react-native';
import { palette } from './palette';

// Serif display faces for headings and stamps; system default for body copy.
export const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });
export const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

export const type = {
  display: { fontSize: 28, lineHeight: 35, fontFamily: SERIF, fontWeight: '700', color: palette.ink },
  title: { fontSize: 20, lineHeight: 26, fontFamily: SERIF, fontWeight: '700', color: palette.ink },
  body: { fontSize: 15, lineHeight: 22, color: palette.ink },
  caption: { fontSize: 12.5, lineHeight: 18, color: palette.slate },
  micro: { fontSize: 11, lineHeight: 14, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '600', color: palette.slate },
};

export const mono = { fontFamily: MONO, fontSize: 12.5, color: palette.ink };
