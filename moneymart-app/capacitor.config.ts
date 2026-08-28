import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'jp.co.moneymart',
  appName: 'MoneyMart',
  webDir: 'www',
  server: {
    url: 'https://money-mart2-0.vercel.app',
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: '#0f172a',
    },
  },
};

export default config;
