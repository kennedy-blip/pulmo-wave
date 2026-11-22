import type { CapacitorConfig } from '@capacitor/cli'
const config: CapacitorConfig = {
  appId: 'com.pulmowave.bio',
  appName: 'PulmoWave',
  webDir: 'dist',
  server: { androidScheme: 'https' },
  plugins: {
    AudioSpirometryPlugin: { sampleRate: 48000, encoding: 'ENCODING_PCM_FLOAT', agcEnabled: false }
  }
}
export default config
