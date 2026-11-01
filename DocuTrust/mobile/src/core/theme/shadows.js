import { Platform } from 'react-native';

// One warm shadow used across cards, sheets and floating actions.
export const shadow = Platform.select({
  ios: {
    shadowColor: '#3A2E1E',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  android: { elevation: 2 },
  default: {},
});
