// 음성 입력 실패 세기 (기획서 U-10, 계약 v1 5절)
// - 음성 도구 실패는 대화 인식 실패(에이전트가 말을 못 알아들은 횟수)와 따로 센다.
// - 두 번 연속 실패하면 음성을 쉬고 글로 쓰기를 권한다.
// - 받아쓰기가 한 번 성공하면 다시 0부터 센다.
// DOM이 없는 순수 함수라 Node에서 시험할 수 있다.

export const VOICE_FAIL_LIMIT = 2;

// 'aborted'는 농민이 직접 멈춘 것이라 실패로 세지 않는다.
const NOT_A_FAILURE = new Set(['aborted']);

export function newVoiceState() {
  return { fails: 0, off: false };
}

// outcome: { type: 'result', text } | { type: 'error', error } | { type: 'empty' }
// 반환: { state, notice, fallback }
export function voiceStep(state, outcome) {
  const s = { ...(state || newVoiceState()) };
  if (outcome.type === 'result' && String(outcome.text || '').trim()) {
    s.fails = 0;
    s.off = false;
    return { state: s, notice: '받아쓴 내용을 확인하고 [보내기]를 눌러 주세요', fallback: false };
  }
  if (outcome.type === 'error' && NOT_A_FAILURE.has(outcome.error)) {
    return { state: s, notice: '', fallback: false };
  }
  if (outcome.type === 'error' && (outcome.error === 'not-allowed' || outcome.error === 'service-not-allowed')) {
    // 권한이 없으면 다시 눌러도 안 되므로 바로 글쓰기로 넘긴다.
    s.fails = VOICE_FAIL_LIMIT;
    s.off = true;
    return { state: s, notice: '마이크를 쓸 수 없어요. 아래 칸에 글로 써 주세요', fallback: true };
  }
  s.fails += 1;
  if (s.fails >= VOICE_FAIL_LIMIT) {
    s.off = true;
    return { state: s, notice: '음성이 두 번 잘 안 들렸어요. 아래 칸에 글로 써 주세요', fallback: true };
  }
  return { state: s, notice: '잘 못 들었어요. 마이크를 한 번 더 눌러 주세요', fallback: false };
}

export function runVoiceTests() {
  const cases = [];
  const check = (name, ok) => cases.push({ name, pass: !!ok });
  let st = newVoiceState();
  let r = voiceStep(st, { type: 'error', error: 'no-speech' });
  check('첫 실패는 다시 시도 안내', !r.fallback && r.state.fails === 1 && !r.state.off);
  r = voiceStep(r.state, { type: 'empty' });
  check('두 번째 실패에서 글쓰기 전환', r.fallback && r.state.off && /글로 써/.test(r.notice));
  r = voiceStep(r.state, { type: 'result', text: '1동 토마토 곁순' });
  check('성공하면 0부터 다시', r.state.fails === 0 && !r.state.off && !r.fallback);
  r = voiceStep(newVoiceState(), { type: 'error', error: 'aborted' });
  check('직접 멈춤은 실패 아님', r.state.fails === 0 && !r.fallback);
  r = voiceStep(newVoiceState(), { type: 'error', error: 'not-allowed' });
  check('권한 없음은 바로 글쓰기', r.fallback && r.state.off);
  r = voiceStep(newVoiceState(), { type: 'result', text: '   ' });
  check('빈 받아쓰기는 실패로 셈', r.state.fails === 1);
  r = voiceStep(voiceStep(newVoiceState(), { type: 'error', error: 'network' }).state, { type: 'result', text: '수확' });
  check('실패 1회 뒤 성공하면 초기화', r.state.fails === 0);
  const pass = cases.filter((c) => c.pass).length;
  return { total: cases.length, pass, cases };
}

// 인식기 이벤트 연결. app.js와 시험이 같은 코드를 쓴다.
// io: { getVoice(), setVoice(state), notify(text), focusInput(), appendText(text), onEnd() }
// - 받아쓴 글은 appendText로 입력칸에만 넣는다. 전송하지 않는다(U-09).
// - 직접 멈춤(r.__manualStop)은 오류가 오든 안 오든 실패로 세지 않는다.
// - 오류와 빈 종료는 한 번만 센다.
export function wireRecognition(r, io) {
  let got = false;
  let failed = false;
  const apply = (outcome) => {
    const step = voiceStep(io.getVoice(), outcome);
    io.setVoice(step.state);
    if (step.notice) io.notify(step.notice);
    if (step.fallback) io.focusInput();
  };
  r.onresult = (e) => {
    const t = (e.results?.[0]?.[0]?.transcript || '').trim();
    if (!t) return; // 빈 결과는 onend에서 실패로 센다
    got = true;
    io.appendText(t);
    apply({ type: 'result', text: t });
  };
  r.onerror = (e) => {
    failed = true;
    if (r.__manualStop) return;
    apply({ type: 'error', error: e.error });
  };
  r.onend = () => {
    if (!got && !failed && !r.__manualStop) apply({ type: 'empty' });
    io.onEnd();
  };
  return r;
}

// 가짜 인식기로 이벤트 순서를 흉내 낸 시험 (Codex 34986ef 재현 포함)
export function runWireTests() {
  const cases = [];
  const check = (name, ok, got) => cases.push({ name, pass: !!ok, got: ok ? '' : JSON.stringify(got) });
  const setup = () => {
    const box = { voice: newVoiceState(), notes: [], text: '기존 내용', focus: 0, ends: 0, sent: 0 };
    const io = { getVoice: () => box.voice, setVoice: (v) => { box.voice = v; }, notify: (n) => box.notes.push(n), focusInput: () => { box.focus++; }, appendText: (t) => { box.text = box.text ? `${box.text} ${t}` : t; }, onEnd: () => { box.ends++; } };
    const make = () => wireRecognition({ stop() { this.__stopped = true; } }, io);
    return { box, make };
  };
  let { box, make } = setup();
  for (let i = 0; i < 2; i++) { const r = make(); r.__manualStop = true; r.stop(); r.onend(); }
  check('직접 멈춤 두 번(오류 없는 종료)은 실패 0회', box.voice.fails === 0 && !box.voice.off && box.notes.length === 0, box);
  ({ box, make } = setup());
  { const r = make(); r.__manualStop = true; r.onerror({ error: 'aborted' }); r.onend(); }
  { const r = make(); r.__manualStop = true; r.onerror({ error: 'no-speech' }); r.onend(); }
  check('직접 멈춤 뒤 오류도 실패 아님', box.voice.fails === 0, box.voice);
  ({ box, make } = setup());
  { const r = make(); r.onerror({ error: 'no-speech' }); r.onend(); }
  check('오류 뒤 종료는 한 번만 셈', box.voice.fails === 1 && box.notes.length === 1, box);
  { const r = make(); r.onend(); }
  check('두 번째 실패에서 글쓰기 안내와 입력칸 포커스', box.voice.off && box.focus === 1 && /글로 써/.test(box.notes.at(-1)), box);
  ({ box, make } = setup());
  { const r = make(); r.onresult({ results: [[{ transcript: '1동 토마토 곁순 제거했어요' }]] }); r.onend(); }
  check('받아쓴 글은 기존 글 뒤에 붙고 전송 0회', box.text === '기존 내용 1동 토마토 곁순 제거했어요' && box.sent === 0 && box.voice.fails === 0, box);
  ({ box, make } = setup());
  { const r = make(); r.onresult({ results: [[{ transcript: '  ' }]] }); r.onend(); }
  check('빈 받아쓰기는 실패 1회', box.voice.fails === 1, box.voice);
  ({ box, make } = setup());
  { const r = make(); r.onerror({ error: 'not-allowed' }); r.onend(); }
  check('권한 없음은 바로 글쓰기', box.voice.off && box.focus === 1, box);
  const pass = cases.filter((c) => c.pass).length;
  return { total: cases.length, pass, cases };
}
