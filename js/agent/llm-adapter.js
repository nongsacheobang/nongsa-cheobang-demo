// 이해(추출) 어댑터: config.agentMode 로 고른다.
//  - 'rules': 규칙 기반 추출 (extract-rules.js). 지금 동작. AI 호출 0원
//  - 'llm'  : Cloud Functions agent 엔드포인트 -> Vertex AI Gemini (gemini-3.1-flash-lite, 함수 호출 save_farm_log)
//             아직 서버가 없어서 연결 자리만 있다. 실패·지연(5초)·한도 초과면 규칙 추출로 자동 폴백.
//
// 서버 쪽 TODO (README "LLM 연결 TODO" 참고):
//   Cloud Functions 2세대 asia-northeast3 `agent` (HTTPS, Firebase Auth ID 토큰 확인)
//   -> 1인 하루 한도 확인 -> 입력 500자 자르기 -> Vertex AI generateContent
//      (model = CONFIG.agentModel, tools = [{ functionDeclarations: [SAVE_FARM_LOG_DECL] }], maxOutputTokens 512)
//   -> functionCall(save_farm_log) 인자를 서버에서 검증(동·작목이 내 농장에 있는지, 단위, 숫자 범위) 후 응답
//   응답 모양: { intent: 'record'|'offtopic'|'weather'|'export'|'list'|'greet'|'unknown', args?: save_farm_log 인자, reply?: string }
//   API 키·서비스 계정 키는 절대 이 저장소에 넣지 않는다 (서버 런타임 서비스 계정 + Secret Manager).

import { CONFIG } from '../config.js';
import { extractRules, classifyIntent, parseCrop, stageOfTask, normUnit } from './extract-rules.js';

// Gemini 함수 선언 (서버에서 그대로 사용). 필드는 영농일지 입력 항목표 v0.1 3장 + v0.2 추가 필드(source_text, 추출 방식)
export const SAVE_FARM_LOG_DECL = {
  name: 'save_farm_log',
  description: '농민이 말한 작업 한 건을 표준 영농기록장 항목으로 정리한 초안. 농민이 확인 카드에서 [저장]을 눌러야 실제로 저장된다. 말하지 않은 값은 비워 둔다.',
  parameters: {
    type: 'OBJECT',
    properties: {
      work_date: { type: 'STRING', description: '작업일 YYYY-MM-DD. 말하지 않았으면 비움(앱이 오늘로 채움)' },
      house_names: { type: 'ARRAY', items: { type: 'STRING' }, description: '하우스 동 이름. 농장 프로필의 동 이름 중에서만' },
      crop: { type: 'STRING', enum: ['토마토', '방울토마토', '딸기'] },
      stage: { type: 'STRING', enum: ['사전준비', '경운·토양관리', '육묘·정식', '작물관리', '수확·출하', '정리'] },
      task: { type: 'STRING', description: '세부 작업명. 작목별 목록(constants.js TASKS_*) 중에서만' },
      materials: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            kind: { type: 'STRING', enum: ['농약', '비료', '종묘(모종)'] },
            action: { type: 'STRING', enum: ['구입', '사용'] },
            type: { type: 'STRING', description: '농약: 살충제/살균제/살균살충제/제초제/생장조정제/기타, 비료: 유기질(퇴비·유박)/화학(복합·단비)/양액 비료/엽면시비·미량요소/토양개량제/기타' },
            name: { type: 'STRING', description: '제품명. 농민이 말한 그대로' },
            qty: { type: 'NUMBER' },
            unit: { type: 'STRING', enum: ['mL', 'L', 'g', 'kg', '병', '봉지', '포대', '톤', '주', '포기', '판'] },
            dilution: { type: 'NUMBER', description: '희석배수 (예: 1000)' },
            pest: { type: 'STRING', description: '대상 병해충' },
          },
          required: ['kind'],
        },
      },
      memo: { type: 'STRING' },
      guessed_fields: { type: 'ARRAY', items: { type: 'STRING' }, description: '말하지 않았는데 추측으로 채운 필드 이름' },
    },
  },
};

const USAGE_KEY = 'nc:agentUsage'; // { date, count } (llm 모드에서만 씀)

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function usageOk() {
  try {
    const u = JSON.parse(localStorage.getItem(USAGE_KEY) || 'null');
    return !u || u.date !== todayKey() || u.count < (CONFIG.agentDailyLimit || 30);
  } catch (e) {
    return true;
  }
}
function countUsage() {
  try {
    const u = JSON.parse(localStorage.getItem(USAGE_KEY) || 'null');
    const n = u && u.date === todayKey() ? u.count + 1 : 1;
    localStorage.setItem(USAGE_KEY, JSON.stringify({ date: todayKey(), count: n }));
  } catch (e) { /* 무시 */ }
}

// save_farm_log 인자 -> 규칙 추출과 같은 모양
export function fromFunctionArgs(args, ctx, text) {
  const hs = ctx.profile?.houses || [];
  const houseIds = (args.house_names || []).map((n) => hs.find((h) => h.name === n)?.id).filter(Boolean);
  const crop = parseCrop(args.crop || '') || (houseIds.length ? hs.find((h) => h.id === houseIds[0])?.crop : '') || '';
  const task = args.task || '';
  const materials = (args.materials || []).map((m) => ({
    kind: ['농약', '비료', '종묘(모종)'].includes(m.kind) ? m.kind : '',
    action: m.action === '구입' ? '구입' : '사용',
    type: m.type || '',
    name: m.name || '',
    qty: m.qty != null ? String(m.qty) : '',
    unit: normUnit(m.unit) || m.unit || '',
    dilution: m.dilution ? String(m.dilution) : '',
    pest: m.pest || '',
  }));
  const ext = {
    workDate: /^\d{4}-\d{2}-\d{2}$/.test(args.work_date || '') ? args.work_date : ctx.today,
    dateSaid: !!args.work_date,
    houseIds, crop,
    stage: args.stage || stageOfTask(task, crop),
    task, materials,
    area: { value: '', unit: '㎡' },
    pest: materials[0]?.pest || '',
    memo: args.memo || '',
    guessed: (args.guessed_fields || []).map((f) => (f === 'house_names' ? 'houseIds' : f)),
    warnings: [], text,
  };
  ext.intent = 'record';
  return ext;
}

async function callLlm(text, ctx) {
  if (!CONFIG.agentEndpoint) throw new Error('agentEndpoint 미설정');
  if (!usageOk()) throw Object.assign(new Error('하루 대화 한도 초과'), { code: 'limit' });
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), CONFIG.agentTimeoutMs || 5000);
  try {
    const res = await fetch(CONFIG.agentEndpoint, {
      method: 'POST',
      signal: ac.signal,
      headers: { 'Content-Type': 'application/json' /* TODO: Authorization: Bearer {Firebase ID 토큰} */ },
      body: JSON.stringify({
        text: text.slice(0, CONFIG.agentMaxInput || 500),
        today: ctx.today,
        model: CONFIG.agentModel,
        farm: { houses: (ctx.profile?.houses || []).map((h) => ({ name: h.name, crop: h.crop })) },
        history: (ctx.history || []).slice(-6),
      }),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    countUsage();
    if (j.intent === 'record' && j.args) return { intent: 'record', ext: fromFunctionArgs(j.args, ctx, text), reply: j.reply || '' };
    return { intent: j.intent || 'unknown', ext: extractRules(text, ctx), reply: j.reply || '' };
  } finally {
    clearTimeout(timer);
  }
}

// 대화 한 턴 이해. 반환: { intent, ext, method: 'AI' | '규칙', fallback?: string }
export async function understand(text, ctx) {
  if (CONFIG.agentMode === 'llm') {
    try {
      const r = await callLlm(text, ctx);
      // 목적 외 판정은 서버 결과와 상관없이 규칙으로 한 번 더 막는다
      if (classifyIntent(text, null) === 'offtopic') return { ...r, intent: 'offtopic', method: 'AI' };
      return { ...r, method: 'AI' };
    } catch (e) {
      console.warn('LLM 호출 실패, 규칙 추출로 폴백:', e.message);
      const ext = extractRules(text, ctx);
      return { intent: ext.intent, ext, method: '규칙', fallback: e.code === 'limit' ? 'limit' : 'error' };
    }
  }
  const ext = extractRules(text, ctx);
  return { intent: ext.intent, ext, method: '규칙' };
}
