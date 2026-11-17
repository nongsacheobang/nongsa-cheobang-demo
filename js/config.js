// 앱 설정. 비밀키는 여기에 넣지 않는다.
// (Firebase 웹 설정값 apiKey 등은 공개되어도 되는 식별자지만, 기상청 서비스키 같은 비밀값은 반드시 서버(Cloud Functions)에만 둔다.)

export const CONFIG = {
  // 데이터 저장소: 'local' (localStorage, 지금 동작) | 'firebase' (Firestore, GCP 권한 받은 뒤)
  storage: 'local',

  // 로그인: 'demo' (이메일 입력 -> 데모 세션) | 'firebase' (Firebase 이메일 링크 로그인)
  // 게이트1에서 "6자리 일회용 코드"로 정하면 auth.js에 'otp' 어댑터를 추가 (Cloud Functions + 외부 메일 필요)
  auth: 'demo',

  // 날씨: 'mock' (고정 가상 응답) | 'proxy' (Cloud Functions 날씨 프록시)
  weather: 'mock',
  weatherProxyUrl: '', // 예: 'https://asia-northeast3-nongsacheobang.cloudfunctions.net/weather'

  // 첫 화면: v0.2 부터 1안 하이브리드(날씨, 할 일 한 줄 + 최근 기록 + 대화 입력창) 고정. 다른 안은 게이트1 결정 후
  homeVariant: 1,
  // 홈 상단 할 일 카드 (이번 달 기록 N일, 빠진 항목 M건)
  showProgressLine: true,

  // 대화 입력(에이전트): 'rules' (규칙 기반 추출, 지금 동작, AI 호출 0원) | 'llm' (Cloud Functions -> Vertex AI Gemini, 연결 자리)
  // llm 실패, 지연(agentTimeoutMs 초과), 하루 한도 초과 시 자동으로 rules 로 폴백. 모델 ID 는 은퇴, 가격 변경에 대비해 설정값으로 둔다.
  inputMode: 'rules',
  agentMode: 'rules',
  agentEndpoint: '', // 예: 'https://asia-northeast3-nongsacheobang.cloudfunctions.net/agent' (서버 배포 후)
  agentModel: 'gemini-3.1-flash-lite',
  agentTimeoutMs: 5000,
  agentDailyLimit: 30, // 1인 하루 AI 대화 (기획서 6-3, 결정 필요)
  agentMaxInput: 500, // 1회 입력 길이

  // P0 범위 스위치 (게이트2에서 최종 확정). 시간 부족 시 끄는 순서: editDelete -> (날씨 고정) -> pwa
  features: {
    editDelete: true,
    pwa: true,
    demoData: true,
    premiumCalc: false,
  },

  // Firebase 웹 설정 (프로젝트 nongsacheobang 권한 받은 뒤 콘솔 > 프로젝트 설정 > 웹 앱에서 복사)
  firebaseVersion: '11.0.2', // 연결할 때 최신 버전 확인 후 교체
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: 'nongsacheobang',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
  },
  // 이메일 링크 로그인 후 돌아올 주소 (Firebase 콘솔 > Authentication > 승인된 도메인에 등록 필요)
  emailLinkContinueUrl: location.origin + location.pathname,
};
