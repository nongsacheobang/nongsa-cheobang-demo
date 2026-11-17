// M-05 요인 상세 [Aside 담당]
// 낮추는 요인(부족, 모름, 경고)을 위에, 올리는 요인(충족)을 아래에. 요인마다 근거 한 줄과 할 일 버튼.
// "농사를 잘 짓는 것 = 점수가 오르는 것"이 보이도록 묶음(가입, 재배 기록, 관리, 시설, 사고 대응) 표시.

import { signalCard, STATE_LABEL } from './home.js';

const WEIGHT_TEXT = (w) => (w === 'gate' ? '꼭 필요' : w === 'warn' ? '경고' : `${w}점`);

function row(f, esc) {
  const cls = f.state === 'met' ? 'ok' : f.weight === 'warn' && f.state === 'unmet' ? 'bad' : f.state === 'na' ? 'na' : 'low';
  return `<details class="rd-fac ${cls}">
    <summary class="row"><b>${esc(f.title)}</b><span class="sp"></span><span class="tag">${esc(STATE_LABEL[f.state] || f.state)}</span><span class="tag">${esc(f.pending ? '점수 반영 전' : WEIGHT_TEXT(f.weight))}</span></summary>
    <p>${esc(f.reason)}</p>${f.pending ? '<p>곧 확인할 항목이에요. 아직 점수에 반영하지 않아요.</p>' : typeof f.progress === 'number' && f.progress > 0 && typeof f.weight === 'number' ? `<p>${f.id === 'R-08' ? '이전 대응 기록' : '동별 기록 ' + esc(Math.round(f.progress * 100)) + '%'}을 점수에 반영했어요.</p>` : ''}
    <p class="mut">${esc(f.group)}: ${esc(f.basis)}</p>
    ${f.todo && f.state !== 'met' ? `<button class="ghost sm" data-act="go" data-v="${esc(f.todo.go)}">${esc(f.todo.label)}</button>` : ''}
  </details>`;
}

export default {
  route: 'factors',
  tab: 'coverage',
  title: '준비도 요인',
  render(ctx) {
    const { esc, readiness: r } = ctx;
    if (!r) return '<section class="scr"><div class="bd"><p class="empty">불러오는 중</p></div></section>';
    const na = r.factors.filter((f) => f.state === 'na');
    const order = list => r.stage?.key === 'accident' ? [...list].sort((a,b) => (a.group === '사고 대응' ? 0 : 1) - (b.group === '사고 대응' ? 0 : 1)) : list;
    return `<section class="scr">
      <div class="hd"><button class="bk" data-act="back" aria-label="뒤로">&lt;</button><h1>왜 이 점수인가요?</h1></div>
      <div class="bd">
        ${signalCard(r, esc)}
        <p class="rd-notice">${esc(r.notice)}</p>
        <div class="card"><h3>확인하거나 보완할 것 ${r.lowering.length}개</h3>${order(r.lowering).map((f) => row(f, esc)).join('') || '<p class="mut">없어요</p>'}</div>
        <div class="card"><h3>점수를 올린 것 ${r.raising.length}개</h3>${order(r.raising).map((f) => row(f, esc)).join('') || '<p class="mut">아직 없어요</p>'}</div>
        ${na.length ? `<div class="card"><h3>지금은 해당 없음 ${na.length}개</h3><p class="mut">${na.map((f) => esc(f.title)).join(', ')}</p></div>` : ''}
        <button class="ghost" data-act="go" data-v="report">준비도 보고서 보기</button><p class="mut ctr">점수 기준은 시험용 임시값이에요. 손해평가사 검토 뒤 바뀔 수 있어요.</p>
      </div></section>`;
  },
  actions: {},
};
