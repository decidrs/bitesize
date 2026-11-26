import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.strateriq.morsel',
  appName: 'Morsel',
  webDir: 'dist',
  backgroundColor: '#111318',
  ios: {
    // The app scrolls inside its own feed; the page itself never rubber-bands.
    scrollEnabled: false,
    contentInset: 'never',
    backgroundColor: '#111318',
  },
  plugins: {
    SplashScreen: { launchShowDuration: 0, launchAutoHide: false, backgroundColor: '#111318', showSpinner: false },
    StatusBar: { style: 'DARK', overlaysWebView: true },
  },
};

export default config;
