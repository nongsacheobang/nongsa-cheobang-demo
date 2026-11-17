// 저장소 선택. config.js 의 storage 값으로 어댑터를 고른다.
import { CONFIG } from '../config.js';
import { withContract } from './contract-store.js';

let store = null;
let demoStore = null;

export async function getDemoStore() {
  if (!demoStore) demoStore = withContract((await import('./local.js')).localStore);
  return demoStore;
}

export function validateStorageConfig(config) {
  if (config.storage === 'firebase' && config.auth !== 'firebase') throw new Error('Firebase 저장소에는 Firebase 로그인이 필요해요');
}

export async function getStore() {
  validateStorageConfig(CONFIG);
  if (store) return store;
  if (CONFIG.storage === 'firebase') {
    store = withContract((await import('./firebase.js')).firebaseStore);
  } else {
    // 기기 저장소는 계약 모양(snake_case)으로 쓴다. 옛 기록도 그대로 읽힌다.
    store = await getDemoStore();
  }
  return store;
}
