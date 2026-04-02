import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Tavi',
  slug: 'tavi',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',

  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#1B2B4B',
  },

  android: {
    adaptiveIcon: {
      foregroundImage: './assets/icon.png',
      backgroundColor: '#1B2B4B',
    },
    package: 'com.tavi.budgettracker',
    versionCode: 1,
  },

  ios: {
    bundleIdentifier: 'com.tavi.budgettracker',
    buildNumber: '1',
  },

  plugins: [
    'expo-font',
    'expo-sqlite',
    'expo-secure-store',
    [
      'expo-notifications',
      {
        icon: './assets/icon.png',
        color: '#1B2B4B',
        sounds: [],
      },
    ],
  ],

  extra: {
    eas: {
      projectId: 'd4fbefe9-6349-47ba-8497-3acbad4b643c',
    },
  },
});

