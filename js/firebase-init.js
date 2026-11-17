// Firebase SDK 를 CDN(ESM)에서 필요할 때만 불러온다. (빌드 도구 없이 동작)
// storage: 'local', auth: 'demo' 일 때는 이 파일이 아예 로드되지 않는다.

import { CONFIG } from './config.js';

let cached = null;

export async function getFirebase() {
  if (cached) return cached;
  if (!CONFIG.firebase.apiKey) {
    throw new Error('Firebase 설정이 비어 있습니다. js/config.js 의 firebase 값을 채우세요.');
  }
  const v = CONFIG.firebaseVersion;
  const base = `https://www.gstatic.com/firebasejs/${v}`;
  const [appMod, firestore, auth] = await Promise.all([
    import(`${base}/firebase-app.js`),
    import(`${base}/firebase-firestore.js`),
    import(`${base}/firebase-auth.js`),
  ]);
  const app = appMod.initializeApp(CONFIG.firebase);
  const db = firestore.getFirestore(app);
  const authInst = auth.getAuth(app);
  auth.useDeviceLanguage(authInst);
  // TODO: App Check (reCAPTCHA Enterprise) 적용 - 봇 가입, 메일 남용 방지 (운영비 견적 v1 7장)
  cached = { app, db, firestore, auth, authInst };
  return cached;
}
