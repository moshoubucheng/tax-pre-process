import { Network, ConnectionStatus } from '@capacitor/network';
import { isNativePlatform } from './platform';

type NetworkStatusCallback = (status: ConnectionStatus) => void;

/**
 * 获取当前网络状态
 */
export async function getNetworkStatus(): Promise<ConnectionStatus> {
  if (isNativePlatform()) {
    return Network.getStatus();
  }
  // Web 平台使用 navigator.onLine
  return {
    connected: navigator.onLine,
    connectionType: navigator.onLine ? 'wifi' : 'none'
  };
}

/**
 * 检查是否有网络连接
 */
export async function isConnected(): Promise<boolean> {
  const status = await getNetworkStatus();
  return status.connected;
}

/**
 * 监听网络状态变化
 */
export function onNetworkStatusChange(callback: NetworkStatusCallback): () => void {
  if (isNativePlatform()) {
    let handler: Awaited<ReturnType<typeof Network.addListener>> | null = null;
    Network.addListener('networkStatusChange', callback).then(h => handler = h);
    return () => {
      if (handler) handler.remove();
    };
  }

  // Web 平台使用 online/offline 事件
  const onlineHandler = () => callback({ connected: true, connectionType: 'wifi' });
  const offlineHandler = () => callback({ connected: false, connectionType: 'none' });

  window.addEventListener('online', onlineHandler);
  window.addEventListener('offline', offlineHandler);

  return () => {
    window.removeEventListener('online', onlineHandler);
    window.removeEventListener('offline', offlineHandler);
  };
}
