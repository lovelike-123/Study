import type { CapacitorConfig } from '@capacitor/cli'

// 默认走包内 dist（可直接出 APK 上真机）。
// 仅当 CAP_LIVE_RELOAD=1 时才连宿主机 dev server（模拟器经 10.0.2.2:5173 实时迭代）。
const devServer = (process.env?.CAP_LIVE_RELOAD ?? '') === '1'

const config: CapacitorConfig = {
  appId: 'com.fitlog.app',
  appName: 'FitLog',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: {
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
    ...(devServer ? { url: 'http://10.0.2.2:5173', cleartext: true } : {}),
  },
}

export default config