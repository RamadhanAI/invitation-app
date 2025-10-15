// capacitor.config.ts  (create this at the project root)
// capacitor.config.ts  (create this at the project root)
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.triggerdxb.invite',
  appName: 'Invitation App',
  webDir: 'public',          // unused in remote-url mode
  server: {
    url: 'https://app.triggerdxb.com', // ← your subdomain (see #2 below)
    cleartext: false                   // HTTPS required for camera
  }
};
export default config;
