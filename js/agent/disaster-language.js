// 재해 원인 원문 보존을 위한 임시 에이전트 경계 보정. 보험 사고 확정이 아니다.
const CAUSES = /강풍|태풍|돌풍|회오리|우박|저온|냉해|동상해|한파|서리|폭염|고온|폭우|호우|침수|폭설|대설|화재|조수해|멧돼지|고라니|노루|까치|까마귀|짐승|새(?=가|가\s|\s*(?:피해|떼|때문))/g;
const DAMAGE = /피해|찢|뜯|파손|부서|무너|휘|꺾|쓰러|상처|상했|시들|죽|고사|입었|침수|잠겼|날아|쪼아|먹었|전소/;
const EXCLUDE = /대비|예방|막으려|방지|오기\s*전|예보|날씨\s*어때/;
// 부정된 원인은 제외한다. 긴 문맥과 복합 부정은 별도 검증이 필요하다.
export function disasterCauseWords(text) {
  const raw = String(text || '');
  return [...raw.matchAll(CAUSES)].filter(m => !/^\s*(?:은|는|이|가)?\s*(?:아니|없|안\s*왔|오지\s*않)/.test(raw.slice(m.index + m[0].length))).map(m=>m[0]);
}
export function preserveDisasterWords(text, ext) {
  if (!ext || ext.intent === 'offtopic' || EXCLUDE.test(text)) return ext;
  const all = [...String(text).matchAll(CAUSES)];
  const matches = disasterCauseWords(text);
  if (!matches.length || !DAMAGE.test(text)) {
    if (all.length && !matches.length && ext.intent === 'disaster') return {...ext,intent:'unknown',disaster:{...(ext.disaster || {}),hit:false,peril:''}};
    return ext;
  }
  // 원인 단어는 입력 순서대로 보존하며 재해 범주를 임의 확정하지 않는다.
  const peril = [...new Set(matches)].join(', ');
  const d = {...(ext.disaster || {}),hit:true,peril};
  if (/시들/.test(text) && !/얼어|얼었/.test(text) && d.crop_symptom === '얼어서 시듦') d.crop_symptom='시듦';
  return {...ext,intent:'disaster',disaster:d};
}