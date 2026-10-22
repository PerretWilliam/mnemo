import type { ExpoConfig } from 'expo/config';

import pkg from './package.json';

// Single source of truth for the version: package.json (bumped by release-please).
// Android needs a monotonically increasing integer: 1.2.3 -> 10203.
const [major, minor, patch] = pkg.version.split('.').map(Number);
const versionCode = major * 10000 + minor * 100 + patch;

const config: ExpoConfig = {
  name: 'Flashcards',
  slug: 'flashcards',
  version: pkg.version,
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'flashcards',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: 'com.perretwilliam.flashcards',
  },
  android: {
    package: 'com.perretwilliam.flashcards',
    versionCode,
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#4F46E5',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
    'expo-sqlite',
    'expo-sharing',
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
