import { Platform } from 'react-native';
import { palette } from './palette';

// One warm shadow used across cards, sheets and floating actions.
export const shadow = Platform.select({
  ios: {
    shadowColor: palette.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  android: { elevation: 2 },
  default: {},
});
