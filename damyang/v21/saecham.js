/* 261127 허간 결정: 개인화 AI 비서 '구르미'(체험본 ?trial=1 전용, 기획안 v02).
   1R은 실제 AI가 아니라 규칙 + 미리 준비한 문장이다. 화면에는 'AI 비서 예시'로 표시한다.
   근거는 이 기기 안의 자료만 쓴다: 선택한 동의 기록, 24절기표(jeolgi-data.js), 시연 소식(news-data.js).
   저장: 체험 회차 구역(FarmTrial.ns)의 saecham- 키만. 일지 건수·준비도·F03 일정(plans-)에는 넣지 않는다. 외부 전송 없음. */
(() => {
  'use strict';
  if (!window.FarmTrial?.on) return;
  const NS = window.FarmTrial.ns + 'saecham-';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const kst = d => new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'}).format(d);
  const addDays = (day, n) => new Date(Date.parse(day + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
  const gap = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
  const md = day => Number(day.slice(5, 7)) + '월 ' + Number(day.slice(8, 10)) + '일';

  /* ---------- 생김새: 눈 구름(허간 261127 확정). 연한 눈빛 몸통 + 진한 눈동자. 표정은 모양으로: n 기본(뭉게), h 다 했어요(부풀어 둥실), w 특보=화남(납작 + 눈썹) ---------- */
  // saecham.js 의 기존 face() 함수를 통째로 이 내용으로 바꾼다. 호출부·표정 코드(n/h/w)는 그대로.
  let faceSeq = 0;
  const SC_BODY = '#e6f1fb', SC_LINE = '#adc8e2', SC_TOP = '#f6faff', SC_INK = '#2b3440';
  const SC_SHAPE = {
    n: { s: '<circle cx="20" cy="37" r="12"/><circle cx="34" cy="28" r="15"/><circle cx="46" cy="38" r="11"/><rect x="8" y="35" width="49" height="18" rx="9"/>', ey: 41, hl: [27, 20, -25], gnd: 17, tf: '' },
    h: { s: '<circle cx="19" cy="33" r="13"/><circle cx="34" cy="22" r="17"/><circle cx="47" cy="33" r="12"/><rect x="6" y="31" width="53" height="18" rx="9"/>', ey: 36, hl: [26, 13, -25], gnd: 12, tf: ' transform="translate(0 -3)"' },
    w: { s: '<circle cx="18" cy="41" r="10"/><circle cx="32" cy="35" r="12"/><circle cx="46" cy="41" r="10"/><rect x="5" y="40" width="54" height="13" rx="5"/>', ey: 46, hl: [25, 29, -15], gnd: 19, tf: '' },
  };
  // 261127 허간: 표정 40개. 누를 때마다 다른 표정. 눈(점·감은 눈·윙크·별·하트·소용돌이·동그란 눈·시선)에 눈썹·볼·땀·눈물·반짝이를 더한다
  const INK = SC_INK, st = (w = 3) => `fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
  const E = {
    dot: (x, y, r = 3.5) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${INK}"/><circle cx="${x + r * .32}" cy="${y - r * .35}" r="${Math.max(.8, r * .3)}" fill="#fff"/>`,
    up: (x, y) => `<path d="M${x - 3.8} ${y + 1.6}q3.8-5.4 7.6 0" ${st(3.2)}/>`,
    down: (x, y) => `<path d="M${x - 3.8} ${y - 1.2}q3.8 4.6 7.6 0" ${st(3)}/>`,
    line: (x, y) => `<path d="M${x - 3.6} ${y}h7.2" ${st(3)}/>`,
    xx: (x, y, l) => l ? `<path d="M${x - 3.4} ${y - 3}l5.4 3-5.4 3" ${st(2.8)}/>` : `<path d="M${x + 3.4} ${y - 3}l-5.4 3 5.4 3" ${st(2.8)}/>`,
    star: (x, y) => `<path d="M${x} ${y - 4.6}l1.4 3 3.2.4-2.4 2.2.7 3.2-2.9-1.6-2.9 1.6.7-3.2-2.4-2.2 3.2-.4z" fill="${INK}"/>`,
    heart: (x, y) => `<path d="M${x} ${y + 3.6}c-4.6-3-5.4-5.4-4-7 1.2-1.3 3.1-1 4 .5.9-1.5 2.8-1.8 4-.5 1.4 1.6.6 4-4 7z" fill="#e0607a"/>`,
    swirl: (x, y) => `<path d="M${x + .6} ${y}a.8.8 0 1 1-1.6-.4 2 2 0 1 1 3.4 1.2 3.4 3.4 0 1 1-5.6-2.6" ${st(1.8)}/>`,
    ring: (x, y) => `<circle cx="${x}" cy="${y}" r="4.2" fill="#fff" stroke="${INK}" stroke-width="2.2"/><circle cx="${x}" cy="${y}" r="1.8" fill="${INK}"/>`,
    look: (x, y, dx, dy) => `<circle cx="${x}" cy="${y}" r="4.4" fill="#fff" stroke="${INK}" stroke-width="1.6"/><circle cx="${x + dx}" cy="${y + dy}" r="2.3" fill="${INK}"/>`,
    half: (x, y) => `<circle cx="${x}" cy="${y + .6}" r="3.2" fill="${INK}"/><path d="M${x - 4.4} ${y - .6}h8.8" stroke="${SC_BODY}" stroke-width="3.6"/><path d="M${x - 4} ${y + .3}h8" ${st(2.2)}/>`,
  };
  const X = {
    blush: y => `<ellipse cx="17.5" cy="${y + 5}" rx="3.4" ry="2" fill="#f4a7b5" opacity=".75"/><ellipse cx="46.5" cy="${y + 5}" rx="3.4" ry="2" fill="#f4a7b5" opacity=".75"/>`,
    angry: y => `<path d="M20.2 ${y - 5.2}l7.4 2.6M43.8 ${y - 5.2}l-7.4 2.6" ${st(2.7)}/>`,
    worry: y => `<path d="M20.8 ${y - 3.4}l6-2.8M43.2 ${y - 3.4}l-6-2.8" ${st(2.4)}/>`,
    raise: y => `<path d="M21 ${y - 6.6}q4-2.6 8 0M35 ${y - 6.6}q4-2.6 8 0" ${st(2.2)}/>`,
    flat: y => `<path d="M21 ${y - 5.6}h8M35 ${y - 5.6}h8" ${st(2.4)}/>`,
    brow1: y => `<path d="M35 ${y - 7}q4-2.6 8 0" ${st(2.2)}/>`,
    sweat: () => `<path d="M50 22c2.4 3 3 4.6 1.6 6-1.2 1.2-3.2.6-3.4-1-.2-1.2.6-2.6 1.8-5z" fill="#8cc2ec"/>`,
    tear: y => `<path d="M24 ${y + 4}c1.6 2.6 2 3.8 1 4.8-.9.9-2.4.4-2.6-.8-.1-1 .5-2.2 1.6-4z" fill="#8cc2ec"/>`,
    tears: y => `<path d="M24 ${y + 4}c1.6 2.6 2 3.8 1 4.8-.9.9-2.4.4-2.6-.8-.1-1 .5-2.2 1.6-4zM40 ${y + 4}c1.6 2.6 2 3.8 1 4.8-.9.9-2.4.4-2.6-.8-.1-1 .5-2.2 1.6-4z" fill="#8cc2ec"/>`,
    spark: () => `<path d="M54 14l1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1zM9 20l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" fill="#f2c14e"/>`,
    note: () => `<path d="M53 12v7.4a2 2 0 1 1-1.4-1.9V13.2l4.4-1.2v1.6z" fill="${INK}" opacity=".7"/>`,
    snow: () => `<path d="M53 13v8M49.5 15l7 4M49.5 19l7-4" stroke="#8cc2ec" stroke-width="1.6" stroke-linecap="round"/>`,
  };
  // [구름 모양, (왼눈x, 오른눈x, 눈높이) => 그림]
  const EXPRS = [
    ['n', (a, b, y) => E.dot(a, y) + E.dot(b, y)],
    ['n', (a, b, y) => E.dot(a, y, 4.4) + E.dot(b, y, 4.4)],
    ['n', (a, b, y) => E.dot(a, y, 2.4) + E.dot(b, y, 2.4)],
    ['n', (a, b, y) => E.look(a, y, -1.8, 0) + E.look(b, y, -1.8, 0)],
    ['n', (a, b, y) => E.look(a, y, 1.8, 0) + E.look(b, y, 1.8, 0)],
    ['h', (a, b, y) => E.look(a, y, 0, -1.8) + E.look(b, y, 0, -1.8)],
    ['w', (a, b, y) => E.look(a, y, 0, 1.6) + E.look(b, y, 0, 1.6)],
    ['h', (a, b, y) => E.up(a, y) + E.up(b, y)],
    ['h', (a, b, y) => E.up(a, y) + E.up(b, y) + X.blush(y)],
    ['n', (a, b, y) => E.down(a, y) + E.down(b, y)],
    ['n', (a, b, y) => E.up(a, y) + E.dot(b, y)],
    ['n', (a, b, y) => E.dot(a, y) + E.up(b, y) + X.blush(y)],
    ['w', (a, b, y) => E.line(a, y) + E.line(b, y)],
    ['w', (a, b, y) => E.half(a, y) + E.half(b, y)],
    ['h', (a, b, y) => E.ring(a, y) + E.ring(b, y)],
    ['h', (a, b, y) => E.ring(a, y) + E.ring(b, y) + X.raise(y)],
    ['w', (a, b, y) => E.xx(a, y, 1) + E.xx(b, y, 0)],
    ['w', (a, b, y) => E.xx(a, y, 1) + E.xx(b, y, 0) + X.sweat()],
    ['h', (a, b, y) => E.star(a, y) + E.star(b, y)],
    ['h', (a, b, y) => E.heart(a, y) + E.heart(b, y)],
    ['n', (a, b, y) => E.swirl(a, y) + E.swirl(b, y)],
    ['w', (a, b, y) => E.dot(a, y + 1, 3) + E.dot(b, y + 1, 3) + X.angry(y)],
    ['n', (a, b, y) => E.dot(a, y, 3) + E.dot(b, y, 3) + X.worry(y)],
    ['w', (a, b, y) => E.dot(a, y, 3) + E.dot(b, y, 3) + X.worry(y) + X.tear(y)],
    ['w', (a, b, y) => E.down(a, y) + E.down(b, y) + X.tears(y)],
    ['n', (a, b, y) => E.half(a, y) + E.half(b, y) + X.brow1(y)],
    ['n', (a, b, y) => E.dot(a, y) + E.dot(b, y) + X.flat(y)],
    ['n', (a, b, y) => E.line(a, y) + E.dot(b, y, 3)],
    ['h', (a, b, y) => E.dot(a, y, 4) + E.dot(b, y, 4) + X.spark()],
    ['h', (a, b, y) => E.up(a, y) + E.up(b, y) + X.blush(y) + E.heart(48, 16)],
    ['n', (a, b, y) => E.down(a, y) + E.down(b, y) + X.blush(y)],
    ['w', (a, b, y) => E.dot(a, y, 2.2) + E.dot(b, y, 2.2) + X.raise(y)],
    ['h', (a, b, y) => E.up(a, y) + E.up(b, y) + X.spark()],
    ['n', (a, b, y) => E.look(a, y, 1.4, -1.4) + E.look(b, y, 1.4, -1.4) + X.brow1(y)],
    ['w', (a, b, y) => E.line(a, y) + E.line(b, y) + X.sweat()],
    ['h', (a, b, y) => E.up(a, y) + E.up(b, y) + X.flat(y)],
    ['n', (a, b, y) => E.look(a, y, 0, 1.8) + E.look(b, y, 0, 1.8) + X.blush(y)],
    ['h', (a, b, y) => E.star(a, y) + E.star(b, y) + X.spark()],
    ['n', (a, b, y) => E.down(a, y) + E.down(b, y) + X.note()],
    ['w', (a, b, y) => E.dot(a, y, 3) + E.dot(b, y, 3) + X.snow() + X.sweat()],
  ];
  const EXPR_COUNT = EXPRS.length;
  function face(e = 'n', cls = '') {
    const ex = /^x\d+$/.test(e) ? EXPRS[+e.slice(1) % EXPR_COUNT] : null;
    const k = SC_SHAPE[ex ? ex[0] : e] || SC_SHAPE.n, id = 'sc-g' + (++faceSeq), y = k.ey, a = 25, b = 39;
    const small = /mark/.test(cls); // 18~24px 표식은 그림자·하이라이트 빼고 눈을 조금 키움
    const dot = (x, yy, r) => `<circle cx="${x}" cy="${yy}" r="${r}" fill="${SC_INK}"/>` + (small ? '' : `<circle cx="${x + 1.1}" cy="${yy - 1.2}" r="1.05" fill="#fff"/>`);
    const eyes = ex ? ex[1](a, b, y) : e === 'h'
      ? `<path d="M${a - 3.8} ${y + 1.6}q3.8-5.4 7.6 0M${b - 3.8} ${y + 1.6}q3.8-5.4 7.6 0" fill="none" stroke="${SC_INK}" stroke-width="${small ? 4 : 3.2}" stroke-linecap="round"/>`
      : e === 'w'
        ? dot(a, y + 1, 3) + dot(b, y + 1, 3) + `<path d="M${a - 4.8} ${y - 5.2}L${a + 2.6} ${y - 2.6}M${b + 4.8} ${y - 5.2}L${b - 2.6} ${y - 2.6}" stroke="${SC_INK}" stroke-width="2.7" stroke-linecap="round"/>`
        : small ? dot(a, y, 4.4) + dot(b, y, 4.4) : E.look(a, y, 0, .4) + E.look(b, y, 0, .4); // 261127 허간: 흰자+눈동자 얼굴을 기본으로
    return `<svg class="sc-face ${cls}" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="8" x2="0" y2="56"><stop offset="0" stop-color="${SC_TOP}"/><stop offset="1" stop-color="${SC_BODY}"/></linearGradient></defs>`
      + (small ? '' : `<ellipse cx="32" cy="58" rx="${k.gnd}" ry="2.2" fill="${SC_LINE}" opacity=".3"/>`)
      + `<g${k.tf}><g fill="${SC_LINE}" stroke="${SC_LINE}" stroke-width="${small ? 4 : 3}" stroke-linejoin="round">${k.s}</g><g fill="url(#${id})">${k.s}</g>`
      + (small ? '' : `<ellipse cx="${k.hl[0]}" cy="${k.hl[1]}" rx="5" ry="2.4" transform="rotate(${k.hl[2]} ${k.hl[0]} ${k.hl[1]})" fill="#fff" opacity=".75"/>`)
      + `${eyes}</g></svg>`;
  }
  // 표식: AI가 만든 것에 늘 같은 모양으로 붙는다
  const mark = (text = '구르미 제안') => `<span class="sc-mark">${face('n', 'sc-mark-face')}${esc(text)}</span>`;

  /* ---------- 저장 ---------- */
  function read(key) { try { return JSON.parse(localStorage.getItem(NS + key) || 'null'); } catch { return null; } }
  function write(key, value) { localStorage.setItem(NS + key, JSON.stringify(value)); } // 실패는 부른 쪽에서 알린다

  /* ---------- 규칙: 근거가 분명한 것만 ---------- */
  const FOLLOW = /물|고였|고인|찢|구멍|처짐|처졌|시들|반점|마름|누렇|곰팡/;
  const TERM_TASK = {
    입동: '보온 커튼과 난방기 작동 미리 보기', 소설: '보온 커튼과 난방기 작동 확인', 대설: '지붕 눈 대비: 처진 비닐·지지대 보기',
    동지: '밤 최저기온 대비 보온·난방 점검', 소한: '한파 대비 보온·난방 점검', 대한: '한파 대비 보온·난방 점검',
    입춘: '낮 환기 시작 시간 살펴보기', 우수: '하우스 안 습도·결로 보기', 경칩: '해충 첫 발생 살펴보기'
  };
  const termTask = name => TERM_TASK[name] || '하우스 온도와 환기 둘러보기';   // 일지 초안 메모에 쓰는 긴 문장(그대로 둠)
  // 261127 허간 '텍스트 더 줄이자': 말풍선·달력에 보이는 할 일 제목은 짧게
  const TERM_SHORT = {
    입동: '보온·난방 미리 점검', 소설: '보온·난방 점검', 대설: '지붕 눈 대비 점검', 동지: '밤 보온·난방 점검',
    소한: '한파 대비 점검', 대한: '한파 대비 점검', 입춘: '낮 환기 시작', 우수: '습도·결로 보기', 경칩: '해충 첫 발생 보기'
  };
  const termShort = name => TERM_SHORT[name] || '온도·환기 둘러보기';
  function latestFollow(rows, today) {
    const pick = rows.filter(r => r.date && r.date <= today && gap(r.date, today) <= 7 && FOLLOW.test(r.memo || ''))
      .sort((a, b) => (b.sample ? 0 : 1) - (a.sample ? 0 : 1) || (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))[0];
    return pick || null;
  }
  const short = (t, n = 18) => { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n) + '…' : t; };

  // 오늘 할 일 후보(우선순위 순). 각 항목: id, kind, title, why[], expr, memo(일지 초안), link
  function candidates(ctx, rows, today) {
    const out = [];
    const alert = window.FarmNews?.alert?.();
    if (alert && alert.date <= today && gap(alert.date, today) <= 7) out.push({
      kind: 'alert', title: /대설|눈/.test(alert.title) ? '눈 특보 · 지붕 점검' : '특보 대비 하우스 점검', expr: 'w',
      why: [{k: '시연 특보', v: alert.title + ' (' + md(alert.date) + ')'}], memo: '특보 대비로 하우스 지붕 비닐과 지지대를 둘러봤어요.', link: '#news/' + alert.id
    });
    const pest = window.FarmNews?.pest?.();
    if (pest && pest.date <= today && gap(pest.date, today) <= 7 && (!ctx.crop || ctx.crop === '딸기')) out.push({
      kind: 'pest', title: '잿빛곰팡이 살피기', expr: 'w',
      why: [{k: '병해충 예시', v: pest.title + ' (' + md(pest.date) + ')'}, {k: '작물', v: (ctx.crop || '딸기') + ' · ' + ctx.house}, {k: '주의', v: '병명과 약량은 정하지 않아요. 의심되면 지역 농업기술센터와 상의하세요'}],
      memo: '잿빛곰팡이 대비로 환기하고 잎 뒷면을 살폈어요.', link: '#news/' + pest.id
    });
    const rec = latestFollow(rows, today);
    if (rec) out.push({
      kind: 'follow', title: md(rec.date) + ' 기록 다시 보기', sub: '“' + short(rec.memo) + '”', expr: 'n',
      why: [{k: '내 기록', v: md(rec.date) + ' · ' + short(rec.memo, 40)}, {k: '기준', v: '물·찢김·잎 변화 같은 기록은 며칠 뒤 다시 보면 좋아요'}],
      memo: md(rec.date) + ' 기록 이어서 다시 확인했어요. ', record: rec.id
    });
    const J = window.FarmJeolgi;
    if (J) {
      const cur = J.current(today), nx = J.next(today);
      const term = nx && gap(today, nx.date) <= 3 ? nx : cur && gap(cur.date, today) <= 7 ? cur : null;
      if (term) out.push({
        kind: 'term-' + term.name, title: termShort(term.name), expr: 'n',
        why: [{k: '절기', v: term.name + ' ' + md(term.date) + ' · ' + term.meaning}, {k: '작기', v: (ctx.crop || '작물 미확인') + ' · ' + ctx.house}],
        memo: '절기 ' + term.name + '에 맞춰 ' + termTask(term.name).replace(/:.*/, '') + '을 했어요.'
      });
    }
    const due = window.FarmNews?.get?.('n-deadline');
    if (due && today >= '2026-11-20' && today <= '2026-11-27') out.push({
      kind: 'deadline', title: '재해보험 마감 확인', sub: '시연 예시 마감 11월 27일', expr: 'n',
      why: [{k: '소식', v: due.title + ' (' + md(due.date) + ')'}, {k: '주의', v: '실제 마감은 가입할 농축협에서 확인하세요'}], link: '#news/' + due.id
    });
    return out;
  }

  function stateKey(ctx, today) { return 'day-' + ctx.id + '-' + today; }
  function mutedKinds(ctx, today) {
    const m = read('mute-' + ctx.id) || {};
    return new Set(Object.entries(m).filter(([, until]) => typeof until === 'string' && until >= today).map(([k]) => k));
  }
  // 오늘 목록: 어제 '내일로' 넘긴 것 + 규칙 후보. 빼기한 종류는 7일 쉬고, 최대 3개
  function briefing(ctx, rows, today = kst(new Date())) {
    const st = read(stateKey(ctx, today)) || {};
    const carried = (read('carry-' + ctx.id + '-' + today) || []).filter(t => t && typeof t.kind === 'string');
    const muted = mutedKinds(ctx, today);
    const seen = new Set(), list = [];
    for (const t of [...carried.map(t => ({...t, carried: true})), ...candidates(ctx, rows, today)]) {
      if (seen.has(t.kind) || muted.has(t.kind)) continue;
      seen.add(t.kind);
      const id = t.kind;
      const s = st[id];
      if (s === 'off' || s === 'later') continue;
      list.push({...t, id, done: s === 'done'});
      if (list.length === 3) break;
    }
    return list;
  }
  function act(ctx, rows, id, action, today = kst(new Date())) {
    const key = stateKey(ctx, today), st = read(key) || {};
    const task = briefing(ctx, rows, today).find(t => t.id === id) || candidates(ctx, rows, today).find(t => t.kind === id);
    if (action === 'undo') { delete st[id]; write(key, st); return; }
    if (action === 'later' && task) {
      const ck = 'carry-' + ctx.id + '-' + addDays(today, 1), carry = read(ck) || [];
      if (!carry.some(t => t.kind === task.kind)) carry.push({kind: task.kind, title: task.title, sub: task.sub || '', why: task.why, memo: task.memo || '', expr: task.expr, record: task.record || '', link: task.link || ''});
      write(ck, carry);
    }
    if (action === 'off') { const m = read('mute-' + ctx.id) || {}; m[id] = addDays(today, 6); write('mute-' + ctx.id, m); }
    st[id] = action; write(key, st);
  }

  /* ---------- 쇼핑 목록: 남은 할 일에 맞춰 최대 3개. 장바구니에 이미 있으면 뺀다 ---------- */
  const NEED = {alert: ['h-clip', 'h-clear-tape'], pest: ['h-thermo'], follow: ['w-drain-net']};
  const needFor = kind => NEED[kind] || (kind.startsWith('term-') ? ['h-hook'] : []);
  function shopList(ctx, rows) {
    const S = window.FarmShop; if (!S) return {items: [], inCart: []};
    let cart = []; try { cart = S.read('farm').cart.map(r => r.product); } catch {}
    const want = [];
    for (const t of briefing(ctx, rows).filter(t => !t.done)) for (const id of needFor(t.kind)) if (S.products[id] && !want.includes(id)) want.push(id);
    const top = want.slice(0, 3);
    return {items: top.filter(id => !cart.includes(id)), inCart: top.filter(id => cart.includes(id))};
  }
  async function fillCart(ids) { for (const id of ids) await window.FarmShop.add(id, 1, 'farm'); }

  /* ---------- 달력 미리 정리: 앞으로 4주 제안 ---------- */
  function proposals(ctx, rows, today = kst(new Date())) {
    const list = [], end = addDays(today, 28), J = window.FarmJeolgi;
    if (J) {
      let d = today;
      for (let i = 0; i < 4; i++) { const n = J.next(addDays(d, -1)); if (!n || n.date > end) break; if (n.date >= today) list.push({id: 'term-' + n.date, date: n.date, title: termShort(n.name), why: '절기 ' + n.name + ' · ' + n.meaning}); d = addDays(n.date, 1); }
    }
    const rec = latestFollow(rows, today);
    if (rec) { const d = addDays(rec.date, 3) < today ? addDays(today, 1) : addDays(rec.date, 3); list.push({id: 'follow-' + rec.id + '-' + d, date: d, title: md(rec.date) + ' 기록 다시 보기', why: '내 기록 · ' + short(rec.memo, 30)}); }
    const due = window.FarmNews?.get?.('n-deadline');
    if (due && today <= '2026-11-27') list.push({id: 'deadline-2026-11-27', date: '2026-11-27', title: '재해보험 가입 마감(시연)', why: '소식 · ' + due.title});
    const st = read('cal-' + ctx.id) || {};
    return list.filter(p => st[p.id] !== 'off').map(p => ({...p, accepted: st[p.id] === 'accepted'})).sort((a, b) => a.date < b.date ? -1 : 1);
  }
  function decide(ctx, id, action) {
    const st = read('cal-' + ctx.id) || {};
    if (action === 'undo') delete st[id]; else st[id] = action;
    write('cal-' + ctx.id, st);
  }

  /* ---------- 그리기 ---------- */
  const houseTag = ctx => ctx?.house ? ` <span class="sc-h-house">· ${esc(String(ctx.house).replace(/^하우스\s*/, ''))}</span>` : '';   // 제목 뒤 '· 2동'처럼 작게
  const why = t => `<button type="button" class="sc-why" data-sc-why="${esc(t.id)}" aria-label="${esc(t.title)}: 왜 추천했나요?"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1.1.9-1.1 1.6v.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="17" r="1.1" fill="currentColor"/></svg></button>`;
  function card(ctx, rows) {
    const today = kst(new Date()), list = briefing(ctx, rows, today), props = proposals(ctx, rows, today).filter(p => !p.accepted);
    const left = list.filter(t => !t.done).length, allDone = list.length && !left;
    const expr = allDone ? 'h' : list.some(t => t.expr === 'w' && !t.done) ? 'w' : 'n';
    // 261127 허간 '텍스트 더 줄이자, 더 직관적으로': 제목은 개수 중심, 동은 작게 뒤에
    const head = allDone ? '오늘 할 일 다 했어요' : list.length ? `${left === list.length ? '오늘' : '남은'} 할 일 ${left}개` : '오늘은 할 일 없어요';
    // 261127 허간 '더 간결하게': 머리줄 + 할 일(체크 | 할 일 | 왜?) + 달력 한 줄. 근거 칩·요약 칸·부제는 뺐고, 내일로·빼기는 '왜?' 시트 안으로.
    const rowsHtml = list.map(t => `<li class="sc-task${t.done ? ' is-done' : ''}" data-sc-task="${esc(t.id)}">
        <button type="button" class="sc-tick" data-sc-act="${t.done ? 'undo' : 'done'}" data-sc-id="${esc(t.id)}" aria-pressed="${t.done}" aria-label="${esc(t.title)}: ${t.done ? '했어요 표시됨, 누르면 되돌리기' : '했어요'}"><span aria-hidden="true">✓</span></button>
        <strong>${esc(t.title)}${t.carried ? '<span class="sc-carry">어제 넘김</span>' : ''}</strong>
        ${t.done && t.memo ? `<button type="button" class="sc-link sc-strong" data-sc-act="note" data-sc-id="${esc(t.id)}">일지로</button>` : why(t)}</li>`).join('');
    return `<section class="sc-brief" aria-labelledby="sc-brief-title">
      <header class="sc-head">${face(expr, 'sc-head-face')}<div class="sc-head-text"><p class="sc-kicker"><span class="sc-name">구르미</span><span class="sc-demo">AI 비서</span></p><h2 id="sc-brief-title" tabindex="-1">${esc(head)}${houseTag(ctx)}</h2></div>
        <button type="button" class="sc-close" data-sc-sheet-close aria-label="구르미 닫기">✕</button></header>
      ${alertsRow()}
      ${list.length ? `<ul class="sc-tasks">${rowsHtml}</ul>` : ''}
      ${doneRow()}
      ${nextStep(ctx, rows, props)}
      <p class="sc-status" role="status" aria-live="polite"></p>
    </section>`;
  }
  // 알림 줄: 특보·병해충·예보를 한 줄 칩으로(누르면 소식 글). 실제 API는 2R
  function alertsRow() {
    const N = window.FarmNews; if (!N) return '';
    const items = [['특보', N.alert?.()], ['병해충', N.pest?.()], ['예보', (N.weather?.() || []).find(p => !p.alert)]].filter(([, p]) => p).slice(0, 1);   // 261127 허간: 한 번에 하나
    if (!items.length) return '';
    const short2 = t => t.replace(/ 예시.*$|:.*$/, '');
    return `<div class="sc-alerts" aria-label="구르미 알림">${items.map(([k, p]) => `<a class="sc-alert${k === '예보' ? '' : ' is-warn'}" href="#news/${esc(p.id)}" data-sc-sheet-close><b>${k}</b>${esc(short2(p.title))}</a>`).join('')}</div>`;
  }
  // 261127 허간: 구르미가 하자는 대로 한 뒤에는 그 결과로 가는 바로가기가 따라 나온다(이 탭에서만 기억)
  let lastDone = null;
  function doneRow() {
    if (!lastDone) return '';
    const go = lastDone.type === 'cart' ? ['#cart', '장바구니 보기'] : ['#calendar', '달력 보기'];
    return `<div class="sc-done" role="status"><span><i aria-hidden="true">✓</i>${esc(lastDone.text)}</span><a href="${go[0]}" data-sc-sheet-close>${go[1]} ›</a></div>`;
  }
  // 261127 허간 '선택지를 줄여, 하나에 집중': 맨 아래에는 지금 할 행동 하나만. 장바구니 → 달력 순서로 하나씩 나온다
  function nextStep(ctx, rows, props) {
    const {items} = shopList(ctx, rows), S = window.FarmShop;
    if (items.length) return `<button type="button" class="sc-next" data-sc-shop="${esc(items.join(','))}"><span><b>자재 ${items.length}개 장바구니에 담기</b><small>${esc(S.products[items[0]].name)}${items.length > 1 ? ` 외 ${items.length - 1}개` : ''} · 결제는 직접</small></span><i aria-hidden="true">›</i></button>`;
    if (props.length) return `<button type="button" class="sc-next" data-sc-cal="all"><span><b>4주 할 일 ${props.length}건 달력에 추가</b><small>절기·지난 기록 기준</small></span><i aria-hidden="true">›</i></button>`;
    return '';
  }
  function shopRow(ctx, rows) {
    const {items, inCart} = shopList(ctx, rows), S = window.FarmShop;
    if (!items.length && !inCart.length) return '';
    const name = id => S.products[id].name;
    if (!items.length) return `<div class="sc-shop"><p><b>쇼핑 목록</b>${esc(name(inCart[0]))}${inCart.length > 1 ? ` 외 ${inCart.length - 1}개` : ''} · 장바구니에 있어요</p><a class="sc-link sc-strong" href="#cart" data-sc-sheet-close>장바구니 ›</a></div>`;
    return `<div class="sc-shop"><p><b>쇼핑 목록</b>${esc(name(items[0]))}${items.length > 1 ? ` 외 ${items.length - 1}개` : ''}</p><button type="button" class="sc-link sc-strong" data-sc-shop="${esc(items.join(','))}">장바구니에 담기</button></div>`;
  }
  function whySheet(ctx, rows, id) {
    const t = briefing(ctx, rows).find(x => x.id === id) || candidates(ctx, rows, kst(new Date())).find(x => x.kind === id);
    if (!t) return;
    let d = document.getElementById('sc-why');
    if (!d) { d = document.createElement('dialog'); d.id = 'sc-why'; d.className = 'sc-sheet'; d.setAttribute('aria-labelledby', 'sc-why-title'); document.body.append(d); }
    d.className = 'sc-sheet sc-why-sheet';
    d.innerHTML = `<span class="sc-grab" aria-hidden="true"></span>
      <div class="sc-sheet-head">${face(t.expr || 'n', 'sc-sheet-face')}<div><p class="sc-kicker"><span class="sc-name">구르미가 본 자료</span></p><h2 id="sc-why-title" tabindex="-1">${esc(t.title)}</h2></div>
        <button type="button" class="sc-close" data-sc-close aria-label="닫기">✕</button></div>
      <dl class="sc-why-list">${t.why.map(w => `<div><dt>${esc(w.k)}</dt><dd>${esc(w.v)}</dd></div>`).join('')}<div><dt>내 농장</dt><dd>${esc(ctx.house)} · ${esc(ctx.crop || '작물 미확인')}의 기록과 오늘 날짜로 골랐어요</dd></div></dl>
      <p class="sc-note">지금은 미리 정한 규칙과 문장으로 보여 줘요. 참고용이며, 병해충·약량·보험금은 확정하지 않아요.</p>
      ${t.link ? `<a class="sc-btn sc-primary sc-wide" href="${esc(t.link)}">관련 소식 보기</a>` : ''}
      ${t.done ? '' : `<div class="sc-why-links"><button type="button" class="sc-link" data-sc-act="later" data-sc-id="${esc(t.id)}">내일로 미루기</button><span aria-hidden="true">·</span><button type="button" class="sc-link" data-sc-act="off" data-sc-id="${esc(t.id)}">이 추천 빼기</button></div>`}`;
    d.querySelector('[data-sc-close]').onclick = () => d.close();
    d.querySelector('a')?.addEventListener('click', () => d.close());
    if (!d.dataset.bound) { d.dataset.bound = '1'; d.addEventListener('click', e => { if (e.target === d) d.close(); }); }
    d.showModal();
    d.querySelector('h2')?.focus({preventScroll: true});
  }

  // 달력: 칸 표시, 선택한 날 목록, 맨 위 안내
  function calendarBits(ctx, rows) {
    const list = proposals(ctx, rows), byDay = new Map();
    for (const p of list) { if (!byDay.has(p.date)) byDay.set(p.date, []); byDay.get(p.date).push(p); }
    return {list, byDay};
  }
  function calendarBanner(ctx, rows) {   // 261127 허간: 화면이 복잡해 쓰지 않음(시트로 옮김)
    return '';
    const open = proposals(ctx, rows).filter(p => !p.accepted);
    if (!open.length) return '';
    return `<section class="sc-calbar" aria-label="구르미 달력 정리">${face('n', 'sc-calbar-face')}<p><strong>다음 4주를 미리 정리했어요</strong><span>제안 ${open.length}건 · 받으면 달력에 할 일로 남아요</span></p><button type="button" class="sc-btn sc-primary" data-sc-cal="all">모두 받기</button></section>`;
  }
  function dayList(ctx, rows, date) {
    const items = proposals(ctx, rows).filter(p => p.date === date);
    if (!items.length) return '';
    return `<h3 class="ff-plan-head sc-day-head">${mark('구르미 제안')}</h3><ul class="sc-day">${items.map(p => `<li class="${p.accepted ? 'is-accepted' : 'is-proposed'}"><div><strong>${esc(p.title)}</strong><span>${esc(p.why)}</span></div>
      <div class="sc-acts">${p.accepted ? `<span class="sc-ok">달력에 추가됨</span><button type="button" class="sc-btn" data-sc-cal="undo" data-sc-id="${esc(p.id)}">추가 취소</button>` : `<button type="button" class="sc-btn sc-primary" data-sc-cal="accept" data-sc-id="${esc(p.id)}">달력에 추가</button><button type="button" class="sc-btn sc-quiet" data-sc-cal="off" data-sc-id="${esc(p.id)}">빼기</button>`}</div></li>`).join('')}</ul>`;
  }

  /* ---------- 화면을 같이 보는 구르미(261127 허간): 하단 5개 메뉴 어디서나. 이번 데모는 이 기기 자료로 미리 정한 내용 ---------- */
  const inInsurance = () => /\/estimate\//.test(location.pathname);
  const routeBase = () => (location.hash.replace(/^#/, '') || 'home').split(/[/?]/)[0];
  const SHOP_ROUTES = /^(shop|product|cart|checkout|order-complete|orders|receipt|store|mall)/;
  function screen() {
    if (inInsurance()) return 'insurance';
    const r = routeBase();
    if (r === 'home') return 'home';
    if (r === 'calendar') return 'calendar';
    if (/^(journal|detail|saved|readiness|next-check)/.test(r)) return 'journal';
    if (SHOP_ROUTES.test(r)) return 'shop';
    if (r === 'news') return location.hash.split('/')[1] ? 'article' : 'news';
    return '';   // 기록 쓰기·피해 기록·설정·안내 화면에는 나오지 않는다(저장 버튼과 겹침)
  }
  const SCREEN_NAME = {home: '홈', journal: '농장 일지', calendar: '달력', shop: '쇼핑', news: '소식', article: '소식', insurance: '보험'};
  const app = h => inInsurance() ? '../index.html?trial=1' + h : h;
  const line = (text, href, tone) => `<li class="sc-line${tone ? ' is-' + tone : ''}">${href ? `<a href="${esc(href)}" data-sc-sheet-close>${text}<span aria-hidden="true">›</span></a>` : `<span>${text}</span>`}</li>`;
  const go = (label, href, small) => `<a class="sc-next" href="${esc(href)}" data-sc-sheet-close><span><b>${esc(label)}</b>${small ? `<small>${esc(small)}</small>` : ''}</span><i aria-hidden="true">›</i></a>`;
  // 261127 허간 '텍스트 더 줄이자': 머리줄은 '구르미 · AI 비서' 한 줄. 어느 화면인지는 제목에 넣는다(보는 중 칩은 뺌)
  function head(expr, title, ctx) {
    return `<header class="sc-head">${face(expr, 'sc-head-face')}<div class="sc-head-text"><p class="sc-kicker"><span class="sc-name">구르미</span><span class="sc-demo">AI 비서</span></p><h2 id="sc-brief-title" tabindex="-1">${esc(title)}${houseTag(ctx)}</h2></div>
        <button type="button" class="sc-close" data-sc-sheet-close aria-label="구르미 닫기">✕</button></header>`;
  }
  function screenCard() {
    const sc = screen(), today = kst(new Date()), F = window.FarmFlow, ctx = F?.context(), rows = F?.records() || [];
    const wrap = (h, body, next) => `<section class="sc-brief" aria-labelledby="sc-brief-title">${h}${body ? `<ul class="sc-lines">${body}</ul>` : ''}${doneRow()}${next || ''}<p class="sc-status" role="status" aria-live="polite"></p></section>`;
    const N = window.FarmNews;
    if (sc === 'insurance') {
      const done = !!window.FacilityCheck?.done?.();
      return wrap(head('n', '보험 볼 때 알아 둘 것'),
        line('보험금 범위는 참고용 · 지급은 보험사가 정함') +
        line('피해 나면 농축협에 먼저 알리기', null, 'warn') +
        line(done ? '지난 조회 · 첫 화면 <b>지난 조회 보기</b>' : '보험금 확인 4단계 · 1분쯤'),
        go('피해 기록하기', app('#damage'), '사진·날짜 먼저 남기기'));
    }
    if (!F || !ctx) return '';
    if (sc === 'journal' || sc === 'calendar') {
      const rec = rows.filter(r => r.date <= today).sort((x, y) => (y.date > x.date ? 1 : -1))[0], follow = latestFollow(rows, today);
      const J = window.FarmJeolgi, nx = J?.next(today), props = proposals(ctx, rows).filter(p => !p.accepted);
      // 261127 허간: 한 줄 20자 안팎, 핵심 단어 먼저. 날짜는 앱 공통 'N월 N일'
      const again = follow ? `${md(addDays(follow.date, 3))}쯤 다시 보기` : '';
      const body = (rec ? line(`${md(rec.date)} 기록 · ${esc(short(rec.memo, 12))}`) : '') +
        (follow ? line(follow === rec ? again : `${md(follow.date)} 기록 · ${again}`) : '') +
        (!ctx.plant ? line('정식일 비어 있음 · 보험 계산 기준', null, 'warn') : '') +
        (nx ? line(`${esc(nx.name)}(${md(nx.date)}) 전 ${esc(termShort(nx.name))}`) : '');
      const next = props.length ? `<button type="button" class="sc-next" data-sc-cal="all"><span><b>4주 할 일 ${props.length}건 달력에 추가</b><small>절기·지난 기록 기준</small></span><i aria-hidden="true">›</i></button>` : go('오늘 한 일 기록하기', '#record');
      return wrap(head('n', sc === 'calendar' ? '달력에서 볼 것' : '일지에서 볼 것', ctx), body, next);
    }
    if (sc === 'shop') {
      const {items, inCart} = shopList(ctx, rows), S = window.FarmShop;
      let cartN = 0; try { cartN = S.read('farm').cart.reduce((n, r) => n + r.qty, 0); } catch {}
      let card = null; try { card = JSON.parse(localStorage.getItem(window.FarmTrial.ns + 'mall-card') || 'null'); } catch {}
      const body = [...items, ...inCart].slice(0, 3).map(id => line(`${esc(S.products[id].name)} <small>${inCart.includes(id) ? '장바구니에 있음' : '할 일에 필요'}</small>`)).join('') +
        line(`장바구니 ${cartN}개 · 카드 ${card ? '등록됨' : '주문서에서 등록'}`);
      const next = items.length ? `<button type="button" class="sc-next" data-sc-shop="${esc(items.join(','))}"><span><b>자재 ${items.length}개 장바구니에 담기</b><small>결제는 직접</small></span><i aria-hidden="true">›</i></button>` : go('장바구니 보기', '#cart');
      return wrap(head('n', '쇼핑에 필요한 것'), body, next);
    }
    if (sc === 'news') {
      const a = N?.alert?.(), pe = N?.pest?.(), du = N?.get?.('n-deadline');
      const body = (a ? line(`<b>특보</b> ${esc(a.title)}`, '#news/' + a.id, 'warn') : '') + (pe ? line(`<b>병해충</b> ${esc(pe.title)}`, '#news/' + pe.id, 'warn') : '') + (du ? line(`<b>보험</b> ${esc(du.title)}`, '#news/' + du.id) : '');
      return wrap(head('n', '소식에서 먼저 볼 글'), body, '');
    }
    if (sc === 'article') {
      const post = N?.get?.(location.hash.split('/')[1]);
      if (!post) return wrap(head('n', '이 글'), line('글을 찾지 못했어요'), '');
      const todo = {weather: '지붕 비닐·지지대 먼저 보기', pest: '환기 · 잎 뒷면 사진 남기기', insurance: '가입 마감은 농축협에 확인', support: '신청은 기관 공고 보고 직접', farming: '점검한 곳은 일지에 남기기', notice: '피해 나면 농축협에 먼저 알리기'}[post.cat] || '필요한 내용은 일지에 남기기';
      const body = line(`<span><b>요약</b>${esc(short(post.summary, 30))}</span>`) + line(`<span><b>할 일</b>${esc(todo)}</span>`, null, /weather|pest/.test(post.cat) ? 'warn' : '');
      const memo = {weather: '특보 대비로 하우스 지붕과 지지대를 살폈어요.', pest: '잿빛곰팡이 대비로 환기하고 잎 뒷면을 살폈어요.', farming: '비닐 찢김 점검 순서대로 둘러봤어요.'}[post.cat];
      const next = memo ? `<button type="button" class="sc-next" data-sc-note="${esc(memo)}"><span><b>이 내용으로 일지 쓰기</b><small>메모 채워 둠 · 저장은 직접</small></span><i aria-hidden="true">›</i></button>`
        : post.cat === 'insurance' ? go('보험 탭에서 보기', 'estimate/index.html?trial=1&house=' + ctx.id + '&from=tab') : '';
      return wrap(head('n', '이 글에서 할 일'), body, next);
    }
    return card(ctx, rows);
  }

  /* ---------- 누르기 ---------- */
  function rerender(focusSel, msg) {
    try { window.render?.(); } catch {}
    if (bubbleOpen()) fillBubble();
    sync();
    const el = focusSel && document.querySelector(focusSel);
    (el || document.querySelector('#sc-bubble.is-open .sc-brief h2, .ff-calendar [aria-pressed="true"], #main-area'))?.focus?.({preventScroll: true});
    const box = document.querySelector('.sc-status') || document.getElementById('farm-status');
    if (msg) { if (box) box.textContent = msg; window.announceFarmStatus?.(msg); }
  }
  const failMsg = '이 기기에 저장하지 못했어요. 다시 눌러 주세요.';
  document.addEventListener('click', e => {
    const b = e.target.closest?.('[data-sc-act],[data-sc-why],[data-sc-cal],[data-sc-shop],[data-sc-note]');
    if (!b || !window.FarmFlow) return;
    if (b.dataset.scNote) { if (window.FarmFlow.prefillMemo?.(b.dataset.scNote)) { closeBubble(false); location.hash = '#record'; } return; }
    const ctx = FarmFlow.context(), rows = FarmFlow.records();
    if (b.dataset.scWhy) { whySheet(ctx, rows, b.dataset.scWhy); return; }
    if (b.dataset.scShop) {
      if (b.disabled) return; b.disabled = true;
      const ids = b.dataset.scShop.split(',').filter(id => window.FarmShop?.products[id]);
      fillCart(ids).then(() => { lastDone = {type: 'cart', text: `장바구니에 ${ids.length}개 담았어요`}; }).then(() => rerender('#sc-bubble .sc-done a', `구르미가 장바구니에 ${ids.length}개 담았어요.`))
        .catch(() => { b.disabled = false; const st = document.querySelector('#sc-bubble .sc-status'); if (st) st.textContent = failMsg; });
      return;
    }
    if (b.dataset.scAct) {
      const id = b.dataset.scId, a = b.dataset.scAct;
      const sheet = b.closest('#sc-why'); if (sheet) sheet.close();
      if (a === 'note') {
        const t = briefing(ctx, rows).find(x => x.id === id);
        if (t?.memo && FarmFlow.prefillMemo?.(t.memo)) location.hash = '#record';
        return;
      }
      if (b.disabled) return; b.disabled = true;
      try { act(ctx, rows, id, a); } catch { b.disabled = false; const s = document.querySelector('.sc-status'); if (s) s.textContent = failMsg; return; }
      const msg = {done: '했어요로 표시했어요. 일지로 남길 수도 있어요.', later: '내일 아침 목록으로 넘겼어요.', off: '이 추천은 일주일 동안 쉬게 할게요.', undo: '했어요 표시를 되돌렸어요.'}[a];
      rerender(a === 'done' || a === 'undo' ? `[data-sc-task="${CSS.escape(id)}"] .sc-tick` : '.sc-brief h2', msg);
      return;
    }
    if (b.dataset.scCal) {
      const a = b.dataset.scCal;
      if (b.disabled) return; b.disabled = true;
      try {
        if (a === 'all') { const open = proposals(ctx, rows).filter(p => !p.accepted); for (const p of open) decide(ctx, p.id, 'accepted'); lastDone = {type: 'cal', text: `달력에 할 일 ${open.length}건 추가했어요`}; }
        else decide(ctx, b.dataset.scId, a === 'accept' ? 'accepted' : a === 'undo' ? 'undo' : 'off');
      } catch { b.disabled = false; window.announceFarmStatus?.(failMsg); const s = document.querySelector('.sc-calbar span, .sc-day'); if (s) s.insertAdjacentHTML('afterend', `<p class="sc-fail" role="alert">${failMsg}</p>`); return; }
      const msg = {all: '제안을 모두 달력에 추가했어요.', accept: '달력에 추가했어요.', off: '이 제안을 뺐어요.', undo: '추가를 취소했어요. 제안으로 남아요.'}[a];
      window.FarmFlow.refreshCalendar?.(); rerender('.ff-calendar [aria-pressed="true"]', msg);
    }
  });

  /* ---------- 위젯(261127 허간): 끌어서 옮기는 구르미. 놓으면 네 모서리 중 가까운 곳에 자석처럼 붙는다.
     위 머리 막대(#bar)와 아래 메뉴(#mobile-nav) 위로는 못 올라가고 같은 극 자석처럼 밀려난다. 누르면 말풍선. ---------- */
  const SIZE = 64, GAP = 10;
  const reduce = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  // 261127 허간: 네 모서리가 아니라 왼쪽·오른쪽 옆면에만 붙고, 높이는 놓은 자리(위아래 막대 사이 비율)를 기억한다
  let side = 'r', yr = 1, corner = 'br';
  try { const v = read('pos2'); if (v && /^(l|r)$/.test(v.side) && Number.isFinite(v.yr)) { side = v.side; yr = Math.min(1, Math.max(0, v.yr)); } } catch {}
  const setCorner = () => { corner = (yr < .5 ? 't' : 'b') + side; };
  setCorner();
  const savePos = () => { setCorner(); try { write('pos2', {side, yr}); } catch {} };
  // 기준 틀: 넓은 창에서는 body가 휴대폰 틀(transform)이라 고정 위치가 틀 안쪽 기준이 된다. 그 밖에는 화면 전체.
  function frame() {
    const bd = document.body, cs = bd && getComputedStyle(bd);
    if (!bd || cs.transform === 'none') return {l: 0, t: 0, w: window.innerWidth, h: window.innerHeight};
    const r = bd.getBoundingClientRect();
    return {l: r.left + (parseFloat(cs.borderLeftWidth) || 0), t: r.top + (parseFloat(cs.borderTopWidth) || 0), w: bd.clientWidth, h: bd.clientHeight};
  }
  // 붙을 수 있는 영역(틀 안 좌표): 머리 막대 아래 ~ 아래 메뉴 위
  function safe() {
    const f = frame(), vw = f.w, vh = f.h, r = {top: GAP, bottom: vh - GAP, left: GAP + 4, right: vw - GAP - 4};
    const rel = el => { const x = el?.getBoundingClientRect(); return x && {top: x.top - f.t, bottom: x.bottom - f.t, left: x.left - f.l, right: x.right - f.l, width: x.width, height: x.height}; };
    const bar = rel(document.getElementById('bar') || document.querySelector('.example-nav')) // 보험 화면은 .example-nav가 상단 바;
    if (bar && bar.height && bar.bottom > 0 && bar.bottom < vh / 2) r.top = Math.max(r.top, bar.bottom + GAP);
    const nav = document.getElementById('mobile-nav'), n = nav && !nav.hidden ? rel(nav) : null;
    if (n && n.height && n.width) {
      if (n.top > vh / 2) {
        r.bottom = Math.min(r.bottom, n.top - GAP);
        if (n.width < vw - 40) { r.left = Math.max(r.left, n.left + 4); r.right = Math.min(r.right, n.right - 4); }
      }
      else if (n.right < vw / 2 && n.height > vh / 2) r.left = Math.max(r.left, n.right + GAP);
    }
    return r;
  }
  const spot = () => { const r = safe(), range = Math.max(0, r.bottom - SIZE - r.top); return {x: side === 'l' ? r.left : r.right - SIZE, y: r.top + yr * range}; };
  function place(fab, x, y, animate) {
    fab.classList.toggle('is-drifting', animate === 'drift' && !reduce());
    fab.classList.toggle('is-snapping', animate === true && !reduce());
    fab.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    fab.dataset.x = x; fab.dataset.y = y;
  }
  // 금지 영역 쪽으로 끌면 고무줄처럼 버티며 밀어낸다(같은 극 자석)
  function repel(x, y) {
    const r = safe(); let pushed = false;
    const band = (v, min, max) => { if (v < min) { pushed = true; return min - (min - v) * .22; } if (v > max) { pushed = true; return max + (v - max) * .22; } return v; };
    return {x: band(x, r.left, r.right - SIZE), y: band(y, r.top, r.bottom - SIZE), pushed};
  }
  function buildFab() {
    const fab = document.createElement('button');
    fab.type = 'button'; fab.id = 'sc-fab'; fab.className = 'sc-fab'; fab.setAttribute('aria-haspopup', 'dialog'); fab.setAttribute('aria-expanded', 'false');
    let start = null, moved = false;
    fab.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault();   // 브라우저 기본 끌기(아래 링크 잡아채기)와 글자 선택이 시작되지 않게
      start = {px: e.clientX, py: e.clientY, x: +fab.dataset.x, y: +fab.dataset.y}; moved = false;
      try { fab.setPointerCapture(e.pointerId); } catch {}
      fab.classList.add('is-dragging'); fab.classList.remove('is-snapping');
    });
    fab.addEventListener('pointermove', e => {
      if (!start) return;
      const dx = e.clientX - start.px, dy = e.clientY - start.py;
      if (!moved && Math.hypot(dx, dy) < 6) return;
      if (!moved) closeBubble(false);
      moved = true;
      const p = repel(start.x + dx, start.y + dy);
      if (p.pushed !== fab.classList.contains('is-repel')) { fab.dataset.expr = p.pushed ? 'x16' : 'x18'; paintFab(fab); }   // 밀려나면 찡그림, 끄는 중엔 신남(끄는 중엔 포인터를 잡고 있어 다시 그려도 안전)
      fab.classList.toggle('is-repel', p.pushed);
      place(fab, p.x, p.y, false);
    });
    const end = () => {
      if (!start) return;
      fab.classList.remove('is-dragging', 'is-repel');
      if (moved) poke(fab);
      if (moved) {
        const cx = +fab.dataset.x + SIZE / 2, f = frame(), r = safe(), range = Math.max(1, r.bottom - SIZE - r.top);
        side = cx < f.w / 2 ? 'l' : 'r'; yr = Math.min(1, Math.max(0, (+fab.dataset.y - r.top) / range)); savePos();
        const t = spot(); place(fab, t.x, t.y, true);
        fab.dataset.dragged = '1'; setTimeout(() => { delete fab.dataset.dragged; }, 0);
      }
      start = null;
    };
    fab.addEventListener('pointerup', end); fab.addEventListener('pointercancel', end);
    // 누를 때 그림을 새로 그리면 브라우저가 클릭을 놓치므로, 표정은 클릭이 끝난 뒤 바꾼다
    fab.addEventListener('click', () => { if (fab.dataset.dragged) return; toggleBubble(); requestAnimationFrame(() => poke(fab)); });
    // 키보드: 화살표로 모서리 옮기기
    fab.addEventListener('keydown', e => {
      if (!/^Arrow(Left|Right|Up|Down)$/.test(e.key)) return; e.preventDefault();
      if (e.key === 'ArrowLeft') side = 'l'; else if (e.key === 'ArrowRight') side = 'r'; else yr = Math.min(1, Math.max(0, yr + (e.key === 'ArrowUp' ? -.25 : .25)));
      savePos(); const t = spot(); place(fab, t.x, t.y, true); if (bubbleOpen()) positionBubble();
      window.announceFarmStatus?.('구르미를 ' + (side === 'l' ? '왼쪽' : '오른쪽') + ' 옆, ' + (yr < .34 ? '위쪽' : yr > .66 ? '아래쪽' : '가운데') + '으로 옮겼어요');
    });
    fab.addEventListener('dragstart', e => e.preventDefault());
    document.body.append(fab);
    return fab;
  }
  /* 말풍선 */
  const bubbleOpen = () => !!document.getElementById('sc-bubble')?.classList.contains('is-open');
  function positionBubble() {
    const b = document.getElementById('sc-bubble'), fab = document.getElementById('sc-fab');
    if (!b || !fab) return;
    const r = safe(), fx = +fab.dataset.x, fy = +fab.dataset.y, F = frame(), vw = F.w;
    const w = Math.min(360, vw - 24); b.style.width = w + 'px';
    const right = corner[1] === 'r', top = corner[0] === 't';
    const left = right ? Math.max(12, fx + SIZE - w) : Math.min(fx, vw - w - 12);
    b.style.left = left + 'px';
    if (top) { b.style.top = (fy + SIZE + 12) + 'px'; b.style.bottom = 'auto'; b.style.maxHeight = Math.max(200, r.bottom - (fy + SIZE + 12)) + 'px'; }
    else { b.style.top = 'auto'; b.style.bottom = (F.h - fy + 12) + 'px'; b.style.maxHeight = Math.max(200, fy - 12 - r.top) + 'px'; }
    b.dataset.tail = (top ? 't' : 'b') + (right ? 'r' : 'l');
    b.style.setProperty('--tail', (fx + SIZE / 2 - left) + 'px');
  }
  function fillBubble() {
    const b = document.getElementById('sc-bubble'); if (!b) return;
    const html = screenCard(); if (!html) return;
    b.innerHTML = html;
    positionBubble();
  }
  let thinkTimer = 0;
  function openBubble() {
    if (!window.FarmFlow && !inInsurance()) return;
    let b = document.getElementById('sc-bubble');
    if (!b) {
      b = document.createElement('div'); b.id = 'sc-bubble'; b.className = 'sc-bubble-pop'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-labelledby', 'sc-brief-title'); document.body.append(b);
      b.addEventListener('click', e => { if (e.target.closest('[data-sc-sheet-close]')) closeBubble(!e.target.closest('a')); });
      b.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); closeBubble(true); } });
    }
    // 에이전트처럼: 잠깐 '화면을 살펴보는 중' 뒤에 지금 화면에 맞춘 내용
    b.innerHTML = `<section class="sc-brief sc-thinking" aria-labelledby="sc-brief-title"><header class="sc-head">${face('x5', 'sc-head-face')}<div class="sc-head-text"><p class="sc-kicker"><span class="sc-name">구르미</span><span class="sc-demo">AI 비서</span></p><h2 id="sc-brief-title" tabindex="-1">${esc(SCREEN_NAME[screen()] || '')} 보는 중<span class="sc-dots" aria-hidden="true"><i></i><i></i><i></i></span></h2></div></header></section>`;
    positionBubble();
    b.classList.add('is-open'); document.getElementById('sc-fab')?.setAttribute('aria-expanded', 'true');
    b.querySelector('h2')?.focus({preventScroll: true});
    try { write('seen-' + kst(new Date()), 1); } catch {}
    const fabNow = document.getElementById('sc-fab'); if (fabNow) paintFab(fabNow);
    clearTimeout(thinkTimer);
    thinkTimer = setTimeout(() => { if (!bubbleOpen()) return; fillBubble(); b.querySelector('h2')?.focus({preventScroll: true}); }, reduce() ? 120 : 650);
  }
  function closeBubble(focusFab) {
    const b = document.getElementById('sc-bubble'); if (!b?.classList.contains('is-open')) return;
    b.classList.remove('is-open'); document.getElementById('sc-fab')?.setAttribute('aria-expanded', 'false');
    if (focusFab) document.getElementById('sc-fab')?.focus({preventScroll: true});
  }
  const toggleBubble = () => bubbleOpen() ? closeBubble(true) : openBubble();
  const openSheet = openBubble;   // 이전 이름 호환
  // 바깥을 누르면 닫는다(근거 시트를 띄운 동안은 유지)
  document.addEventListener('pointerdown', e => {
    if (!bubbleOpen() || document.getElementById('sc-why')?.open) return;
    if (!e.target.closest?.('#sc-bubble, #sc-fab')) closeBubble(false);
  });
  // 기본 표정(할 일 상태)과 남은 할 일 수
  function baseState() {
    const F = window.FarmFlow; if (!F) return {expr: 'n', left: 0};
    const list = briefing(F.context(), F.records()), left = list.filter(t => !t.done).length;
    return {expr: list.length && !left ? 'h' : 'n', left}; // 261127 허간: 평소엔 기본 얼굴(특보가 있어도 찡그리지 않음)
  }
  function paintFab(fab, expr) {
    const s = baseState();
    // 261127 허간: 숫자는 '새로 온 추천'일 때만. 오늘 말풍선을 한 번 열면 사라지고, 다음 날 새 추천이 생기면 다시 뜬다
    let seen = false; try { seen = !!read('seen-' + kst(new Date())); } catch {}
    fab.innerHTML = face(expr || fab.dataset.expr || s.expr, 'sc-fab-face') + (s.left && !seen ? `<span class="sc-badge" aria-hidden="true">${s.left}</span>` : '');
    return s;
  }
  let pokeTimer = 0;
  function poke(fab) {   // 누를 때마다 40개 중 지금과 다른 표정, 3초 뒤 기본 표정으로
    let n; do { n = Math.floor(Math.random() * EXPR_COUNT); } while ('x' + n === fab.dataset.expr && EXPR_COUNT > 1);
    fab.dataset.expr = 'x' + n; paintFab(fab);
    clearTimeout(pokeTimer); pokeTimer = setTimeout(() => { delete fab.dataset.expr; if (!fab.classList.contains('is-dragging')) paintFab(fab); }, 3000);
  }
  function sync() {
    if (!document.body) return;
    let fab = document.getElementById('sc-fab');
    if (!screen() || window.FarmField?.enabled || (!window.FarmFlow && !inInsurance())) { closeBubble(false); fab?.remove(); return; }
    if (!fab) { fab = buildFab(); const t = spot(); place(fab, t.x, t.y, false); }
    const s = paintFab(fab);
    fab.setAttribute('aria-label', `구르미, AI 비서. ${SCREEN_NAME[screen()]} 화면을 같이 보고 있어요.${s.left ? ` 오늘 챙길 일 ${s.left}개 남음.` : ''} 누르면 말풍선이 열려요. 끌거나 화살표 키로 모서리를 옮길 수 있어요.`);
  }
  const heroButton = () => '';
  let homeReturn = false;
  const reseat = () => { const f = document.getElementById('sc-fab'); if (f && !f.classList.contains('is-dragging')) { const t = spot(); place(f, t.x, t.y, homeReturn ? 'drift' : false); homeReturn = false; } if (bubbleOpen()) positionBubble(); };
  window.addEventListener('resize', reseat);
  // 화면이 바뀌면(일지로 남기기·달력 보기·뒤로 가기) 말풍선과 근거 시트를 닫는다
  window.addEventListener('hashchange', () => { if (screen() === 'home' && yr !== 1) { yr = 1; savePos(); homeReturn = true; }   // 허간: 홈으로 오면 지금 옆면의 아래쪽 기본 자리로 복귀
    closeBubble(false); const d = document.getElementById('sc-why'); if (d?.open) d.close(); setTimeout(() => { sync(); reseat(); }, 0); });
  window.addEventListener('farm-field-change', () => setTimeout(() => { sync(); reseat(); }, 0));
  document.addEventListener('DOMContentLoaded', () => setTimeout(() => { sync(); reseat(); }, 0));

  window.FarmSaecham = Object.freeze({EXPR_COUNT, screen, openSheet, openBubble, closeBubble, sync, heroButton,face, mark, briefing, proposals, card, calendarBits, calendarBanner, dayList, act, decide});
})();
