import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.japantpp.app',
  appName: 'Japan TPP',
  webDir: 'dist',
  server: {
    // 生产环境使用打包的资源
    // 开发时可取消注释下一行指向本地服务器
    // url: 'http://localhost:5173',
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#2563eb',
      showSpinner: false
    },
    StatusBar: {
      style: 'light',
      backgroundColor: '#2563eb'
    }
  },
  ios: {
    contentInset: 'automatic'
  },
  android: {
    allowMixedContent: false
  }
};

export default config;
