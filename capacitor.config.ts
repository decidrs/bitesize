import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.strateriq.morsel',
  appName: 'Morsel',
  webDir: 'dist',
  backgroundColor: '#0d0f14',
  ios: {
    // The app scrolls inside its own feed; the page itself never rubber-bands.
    scrollEnabled: false,
    contentInset: 'never',
    backgroundColor: '#0d0f14',
  },
  plugins: {
    SplashScreen: { launchShowDuration: 0, launchAutoHide: false, backgroundColor: '#0d0f14', showSpinner: false },
    StatusBar: { style: 'DARK', overlaysWebView: true },
  },
};

export default config;
