import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.5ece6ac1a29e48e58b0e6b9cb11d1253',
  appName: 'EODrive',
  webDir: 'dist',
  server: {
    url: 'https://5ece6ac1-a29e-48e5-8b0e-6b9cb11d1253.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    Geolocation: {
      permissions: {
        always: "This app needs location access to track your delivery routes for safety and payroll accuracy."
      }
    }
  }
};

export default config;