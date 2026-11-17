// 로그인 어댑터
//  - 'demo'    : 이메일 입력 -> "메일 확인" 화면 -> [링크 누르기 (시연)] -> 데모 세션 (지금 동작)
//  - 'firebase': Firebase 이메일 링크 로그인 (sendSignInLinkToEmail / signInWithEmailLink). 연결 자리, 아직 테스트 안 함
// 게이트1에서 로그인 방식이 바뀌면 (예: 6자리 코드) 이 파일에 어댑터를 추가하고 config.auth 로 고른다.

import { CONFIG } from './config.js';

const SESSION_KEY = 'nc:session';
const PENDING_KEY = 'nc:pendingEmail';
export const DEMO_EMAIL = 'demo@nongsa.example';

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function saveSession(s) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  return s;
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '');
}

export const auth = {
  mode: CONFIG.auth,

  // 앱 시작 시 호출. firebase 모드면 메일 링크로 들어온 경우 로그인 완료 처리
  async init() {
    if (CONFIG.auth === 'firebase') {
      const session = this.getSession();
      if (session?.provider === 'demo-account' && session.uid === 'demo' && session.demo === true && !new URL(location.href).searchParams.has('oobCode')) return session;
      const { getFirebase } = await import('./firebase-init.js');
      const fb = await getFirebase();
      const { auth: A, authInst } = fb;
      if (A.isSignInWithEmailLink(authInst, location.href)) {
        let email = localStorage.getItem(PENDING_KEY);
        if (!email) email = prompt('로그인한 이메일 주소를 다시 입력해 주세요');
        const cred = await A.signInWithEmailLink(authInst, email, location.href);
        localStorage.removeItem(PENDING_KEY);
        history.replaceState(null, '', location.pathname + '#/home');
        return saveSession({ uid: cred.user.uid, email: cred.user.email, demo: false, provider: 'firebase' });
      }
      // 로컬에 남은 세션이 아니라 Firebase가 복원한 인증 상태를 확인한다.
      const user = await new Promise((resolve, reject) => {
        let unsubscribe = () => {};
        unsubscribe = A.onAuthStateChanged(authInst, value => { unsubscribe(); resolve(value); }, error => { unsubscribe(); reject(error); });
      });
      if (!user) { localStorage.removeItem(SESSION_KEY); return null; }
      return saveSession({ uid: user.uid, email: user.email || '', demo: false, provider: 'firebase' });
    }
    return this.getSession();
  },

  getSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    } catch (e) {
      return null;
    }
  },

  async sendLink(email) {
    localStorage.setItem(PENDING_KEY, email);
    if (CONFIG.auth === 'firebase') {
      const { getFirebase } = await import('./firebase-init.js');
      const { auth: A, authInst } = await getFirebase();
      await A.sendSignInLinkToEmail(authInst, email, {
        url: CONFIG.emailLinkContinueUrl,
        handleCodeInApp: true,
      });
      return { mode: 'firebase' };
    }
    // 데모: 실제 메일은 보내지 않는다
    return { mode: 'demo' };
  },

  getPendingEmail() {
    return localStorage.getItem(PENDING_KEY) || '';
  },

  // 데모 모드에서 "링크 누르기 (시연)" 버튼
  async completeDemoLink() {
    const email = this.getPendingEmail() || DEMO_EMAIL;
    localStorage.removeItem(PENDING_KEY);
    return saveSession({ uid: 'u_' + hash(email.toLowerCase()), email, demo: false, provider: 'demo-link' });
  },

  // "데모 계정으로 둘러보기" (심사, 시연용, 가상 데이터 자동 채움)
  async demoAccount() {
    return saveSession({ uid: 'demo', email: DEMO_EMAIL, demo: true, provider: 'demo-account' });
  },

  async signOut() {
    if (CONFIG.auth === 'firebase' && this.getSession()?.provider !== 'demo-account') {
      const { getFirebase } = await import('./firebase-init.js');
      const { auth: A, authInst } = await getFirebase();
      await A.signOut(authInst);
    }
    localStorage.removeItem(SESSION_KEY);
  },
};
