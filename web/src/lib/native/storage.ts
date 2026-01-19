import { Preferences } from '@capacitor/preferences';
import { isNativePlatform } from './platform';

/**
 * 跨平台存储工具
 * 原生平台使用 Capacitor Preferences
 * Web 平台使用 localStorage
 */
export const storage = {
  /**
   * 获取存储的值
   */
  async get(key: string): Promise<string | null> {
    if (isNativePlatform()) {
      const { value } = await Preferences.get({ key });
      return value;
    }
    return localStorage.getItem(key);
  },

  /**
   * 设置存储的值
   */
  async set(key: string, value: string): Promise<void> {
    if (isNativePlatform()) {
      await Preferences.set({ key, value });
    } else {
      localStorage.setItem(key, value);
    }
  },

  /**
   * 删除存储的值
   */
  async remove(key: string): Promise<void> {
    if (isNativePlatform()) {
      await Preferences.remove({ key });
    } else {
      localStorage.removeItem(key);
    }
  },

  /**
   * 清空所有存储
   */
  async clear(): Promise<void> {
    if (isNativePlatform()) {
      await Preferences.clear();
    } else {
      localStorage.clear();
    }
  },

  /**
   * 获取所有键
   */
  async keys(): Promise<string[]> {
    if (isNativePlatform()) {
      const { keys } = await Preferences.keys();
      return keys;
    }
    return Object.keys(localStorage);
  }
};

// Token 存储的便捷方法
const TOKEN_KEY = 'token';

export async function getToken(): Promise<string | null> {
  return storage.get(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  return storage.set(TOKEN_KEY, token);
}

export async function removeToken(): Promise<void> {
  return storage.remove(TOKEN_KEY);
}
