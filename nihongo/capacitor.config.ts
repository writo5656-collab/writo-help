import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.nihongo.academy',
  appName: 'Nihongo',
  webDir: 'dist',
  android: { backgroundColor: '#F6F1E4' },
  plugins: {
    // Notification icons: a white torii in the status bar, tinted forest green.
    LocalNotifications: { smallIcon: 'ic_stat_nihongo', iconColor: '#1F4D3A' },
  },
};
export default config;
