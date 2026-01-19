import { Capacitor } from '@capacitor/core';

/**
 * 检测是否在原生平台（iOS/Android）
 */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * 获取当前平台
 */
export function getPlatform(): 'ios' | 'android' | 'web' {
  return Capacitor.getPlatform() as 'ios' | 'android' | 'web';
}

/**
 * 检测是否为 iOS
 */
export function isIOS(): boolean {
  return Capacitor.getPlatform() === 'ios';
}

/**
 * 检测是否为 Android
 */
export function isAndroid(): boolean {
  return Capacitor.getPlatform() === 'android';
}

/**
 * 检测是否为 Web（包括 PWA）
 */
export function isWeb(): boolean {
  return Capacitor.getPlatform() === 'web';
}
