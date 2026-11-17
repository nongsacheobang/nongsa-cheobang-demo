// 표준 영농기록장 .xlsx 만들기 (SheetJS, CDN ESM)
// 시트1 "영농기록장": 표준 영농기록장 순서 A~M열, 1행은 머리글만, 셀 병합 없음,
//   날짜는 날짜 셀(yyyy-mm-dd), 빈 값은 0 이 아닌 빈칸, 농약, 비료는 자재마다 1행(A~D, L, M 반복)
// 시트2 "증빙정보": 기록ID, 작성, 수정 시각, 사후입력 여부, 작성자, 위치, 기온, 강수량 등 (증빙 신뢰도용)
// 시트3 "피해 기록" (v0.3): 사고일, 재해 종류, 피해 동, 시설 피해, 작물 피해, 원문. 작업 일지(시트1, 2)와 분리
//   종묘(모종)은 표준 양식에 열이 없어 E열(구입/사용)과 M열(세부작업내용)에만 남는다

import { EXCEL_HEADERS, DISASTER_HEADERS } from './constants.js';
import { plotsText, qtyText, detailOf, missingFields, isBackfill, isDisaster, todayStr } from './records.js';
import { weatherCell } from './weather.js';
import { buildReportData } from './report.js';

const XLSX_URL = '../vendor/sheetjs/xlsx-0.20.3.mjs';

function stageText(r) {
  if (!r.stage) return '';
  return r.task ? `${r.stage}(${r.task})` : r.stage;
}

function fullDetail(profile, r) {
  const d = detailOf(profile, r);
  return r.memo ? `${d} / 메모: ${r.memo}` : d;
}

// 오래된 날짜부터 (기록장 순서)
function sortAsc(records) {
  return [...records].sort((a, b) => String(a.workDate || '').localeCompare(String(b.workDate || '')) || (a.createdAt || '').localeCompare(b.createdAt || ''));
}

// 시트1 행 (A열은 'YYYY-MM-DD' 문자열, 파일 만들 때 날짜 셀로 바꿈)
export function buildSheet1Rows(profile, records) {
  const rows = [];
  for (const r of sortAsc(records.filter((x) => !isDisaster(x)))) {
    const base = [r.workDate, plotsText(profile, r.houseIds), r.crop || '', weatherCell(r.weather)];
    const tail = [stageText(r), fullDetail(profile, r)];
    const mats = r.materials || [];
    if (!mats.length) {
      rows.push({ rec: r, cells: [...base, '', '', '', '', '', '', '', ...tail] });
    } else {
      for (const m of mats) {
        const P = m.kind === '농약';
        const F = m.kind === '비료';
        const q = qtyText(m);
        rows.push({
          rec: r,
          cells: [...base, m.action || '', P ? m.type : '', P ? m.name : '', P ? q : '', F ? m.type : '', F ? m.name : '', F ? q : '', ...tail],
        });
      }
    }
  }
  return rows;
}

const SHEET2_HEADERS = [
  '기록ID', '작업일', '시트1 행 번호', '작성시각', '수정시각', '사후입력 여부', '작성자', '작성자 이메일',
  '농장 위치', '하늘상태', '최저기온(℃)', '최고기온(℃)', '강수량(mm)', '날씨 출처', '미완성 항목', '영수증 사진 링크', '가상(데모) 데이터',
  '입력 방식', '원문 발화',
];

// 입력 방식: 직접 / 대화(규칙|AI) / 대화 후 직접 입력(규칙|AI)  (입력 항목표 v0.2 "추출 방식")
function inputModeText(r) {
  if (r.input_mode === 'text') return '짧은 글';
  if (r.input_mode === 'field') return '현장 모드';
  if (r.input_mode === 'select') return '화면 선택';
  if (r.input_mode === 'chat') return `대화(${r.extract_method || '규칙'})`;
  if (r.input_mode === 'chat-handoff') return `대화 후 직접 입력(${r.extract_method || '규칙'})`;
  return '직접';
}

function excelSerialDate(ymd) {
  if (typeof ymd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split('-').map(Number), date = new Date(Date.UTC(y, m - 1, d));
  if (date.toISOString().slice(0, 10) !== ymd) return null;
  return (date.getTime() - Date.UTC(1899, 11, 30)) / 86400000;
}
function excelSerialDateTime(iso) {
  if (!iso) return null;
  const t = new Date(iso);
  if (!Number.isFinite(t.getTime())) return null;
  const utcLike = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate(), t.getHours(), t.getMinutes(), t.getSeconds());
  return (utcLike - Date.UTC(1899, 11, 30)) / 86400000;
}

function sourceText(w) {
  if (!w || w.status !== 'ok') return '미수집';
  return { mock: '가상 고정값(시연)', kma: '기상청 단기예보', manual: '직접 수정' }[w.source] || '출처 미확인';
}

export function fileName(profile, from, to) {
  const farm = (profile?.farmName || '농장').replace(/[\\/:*?"<>|\s()]+/g, '');
  return `영농기록장_${farm}_${from.replace(/-/g, '')}_${to.replace(/-/g, '')}.xlsx`;
}

// 시트3 행 (피해 기록 1건당 1행). 사고일과 작성일을 따로 남긴다
export function buildDisasterRows(profile, records) {
  return sortAsc(records.filter(isDisaster)).map((r) => ({
    rec: r,
    cells: [
      r.id, r.accident_date || '', r.createdAt || '', isBackfill(r) ? 'Y' : 'N', r.cause_text || (Array.isArray(r.peril) ? r.peril.join(', ') : r.peril) || '', plotsText(profile, r.houseIds), r.crop || '',
      (Array.isArray(r.facility_damage) ? r.facility_damage.join(', ') : r.facility_damage) || '', r.crop_symptom || '', r.continuing ? 'Y' : 'N', r.memo || '', r.source_text || '',
      inputModeText(r), r.author || '', r.demo ? 'Y' : 'N', Array.isArray(r.peril) ? r.peril.join(', ') : '',
    ],
  }));
}

// 시트4 준비도 요약 (M-08, 기획안 v02). 보험금 액수와 지급 여부는 쓰지 않는다(U-11). 고지 문구를 함께 넣는다(U-12)
export const READINESS_HEADERS = ['요인 ID', '묶음', '요인', '상태', '가중치', '이유', '근거', '할 일'];
const STATE_TEXT = { met: '충족', unmet: '부족', unknown: '모름', na: '해당 없음' };
export function buildReadinessRows(readiness, today) {
  if (!readiness) return { summary: [['준비도', '계산하지 못했어요']], factors: [] };
  const summary = [
    ['고지', readiness.notice],
    ['기준일', today || ''],
    ['보험금 받을 준비도', readiness.score == null ? '' : readiness.score],
    ['신호등', readiness.signal?.label || ''],
    ['농사 단계', readiness.stage?.label || ''],
    ['경고', readiness.warnings.map((w) => w.title).join(', ')],
  ];
  const factors = readiness.factors.map((f) => [
    f.id, f.group, f.title, STATE_TEXT[f.state] || f.state,
    f.weight === 'gate' ? '관문' : f.weight === 'warn' ? '경고' : f.weight,
    f.reason, f.basis, f.todo && f.state !== 'met' ? f.todo.label : '',
  ]);
  return { summary, factors };
}

export function buildReportSheetRows(profile, records, readiness, today) {
  const rr = buildReadinessRows(readiness, today);
  const report = buildReportData(profile, records, readiness, { period: 'season', today });
  return [...rr.summary, ['동별 작기 기간'], ['동', '시작일', '종료일', '기준'], ...report.periods.map(p => [p.name, p.start, p.end, p.basis === 'recent' ? '정식 기록 없음, 최근 180일' : '정식 30일 전부터']), [], READINESS_HEADERS, ...rr.factors, [], ['작기 요약'], ['동', '작물', '면적', '주수', '정식일', '수확 개시', '수확 종료'], ...report.houses.map(h => [h.name,h.crop,h.area,h.plants,h.planted,h.harvest,h.ended]), [], ['2026 약관 작물 참고값', 'NH농협손해보험 원예시설 약관, 점수 계산에 사용하지 않음'], ['작물', '표준생장일수', '표준수확일수', '준비기생산비계수'], ...report.cropReferences.map(c => [c.crop,c.grow,c.harvest,c.prep]), [], ['빠진 기록'], ...report.missing.map(f => [f.id,f.title,f.todo.label]), [], ['피해 기록'], ['사고일', '원인', '시설 피해', '작물 피해', '직접 선택한 재해 종류'], ...report.damage.map(d => [d.accident_date||'',d.cause_text||(Array.isArray(d.peril)?d.peril.join(', '):d.peril)||'',(Array.isArray(d.facility_damage)?d.facility_damage.join(', '):d.facility_damage)||'',d.crop_symptom||'',Array.isArray(d.peril)?d.peril.join(', '):'']), [], ['작업 기록 수'], ...Object.entries(report.counts)];
}

export async function buildWorkbook(profile, session, records, readiness = null, selectedSheets = [true, true, true, !!readiness]) {
  if (!Array.isArray(selectedSheets) || selectedSheets.length !== 4 || !selectedSheets.some(Boolean)) throw new Error('시트를 하나 이상 골라 주세요');
  if (selectedSheets[3] && !readiness) throw new Error('준비도 보고서를 만들 수 없어요');
  const XLSX = await import(XLSX_URL);
  const rows = buildSheet1Rows(profile, records);

  // 시트1
  const aoa1 = [EXCEL_HEADERS, ...rows.map((r) => r.cells.map((c, i) => (i === 0 ? null : c === '' ? null : c)))];
  const ws1 = XLSX.utils.aoa_to_sheet(aoa1);
  rows.forEach((r, i) => {
    const addr = XLSX.utils.encode_cell({ r: i + 1, c: 0 });
    const date = excelSerialDate(r.rec.workDate);
    if (date != null) ws1[addr] = { t: 'n', v: date, z: 'yyyy-mm-dd' };
  });
  ws1['!cols'] = [12, 28, 10, 16, 9, 12, 20, 16, 16, 22, 16, 22, 60].map((w) => ({ wch: w }));

  // 시트2 (기록 1건당 1행)
  const firstRow = new Map();
  rows.forEach((r, i) => {
    if (!firstRow.has(r.rec.id)) firstRow.set(r.rec.id, i + 2);
  });
  const recs = sortAsc(records.filter((x) => !isDisaster(x)));
  const aoa2 = [SHEET2_HEADERS];
  recs.forEach((r) => {
    const w = r.weather || {};
    const ok = w.status === 'ok';
    aoa2.push([
      r.id, null, firstRow.get(r.id) || null, null, null,
      isBackfill(r) ? 'Y' : 'N',
      // 계약 v1 2-3: 이메일은 일지에 넣지 않는다. 옛 기록에 있으면 쓰고, 없으면 로그인 이메일
      r.author || '', r.authorEmail || session?.email || '',
      profile?.location || '',
      ok && w.sky ? w.sky : null,
      ok && w.tmin != null ? w.tmin : null,
      ok && w.tmax != null ? w.tmax : null,
      ok && w.rain != null ? w.rain : null,
      sourceText(w),
      missingFields(r).join(', ') || null,
      null, // 영수증 사진 (P1)
      r.demo ? 'Y' : 'N',
      inputModeText(r),
      r.source_text || null,
    ]);
  });
  const ws2 = XLSX.utils.aoa_to_sheet(aoa2);
  recs.forEach((r, i) => {
    const R = i + 1;
    const workDate = excelSerialDate(r.workDate);
    if (workDate != null) ws2[XLSX.utils.encode_cell({ r: R, c: 1 })] = { t: 'n', v: workDate, z: 'yyyy-mm-dd' };
    const c = excelSerialDateTime(r.createdAt);
    if (c != null) ws2[XLSX.utils.encode_cell({ r: R, c: 3 })] = { t: 'n', v: c, z: 'yyyy-mm-dd hh:mm:ss' };
    const u = excelSerialDateTime(r.updatedAt);
    if (u != null) ws2[XLSX.utils.encode_cell({ r: R, c: 4 })] = { t: 'n', v: u, z: 'yyyy-mm-dd hh:mm:ss' };
  });
  ws2['!cols'] = [18, 12, 10, 19, 19, 10, 10, 22, 22, 10, 10, 10, 10, 16, 24, 18, 12, 18, 50].map((w) => ({ wch: w }));

  // 시트3 피해 기록 (기록이 없어도 머리글은 둔다)
  const drows = buildDisasterRows(profile, records);
  const aoa3 = [DISASTER_HEADERS, ...drows.map((r) => r.cells.map((c) => (c === '' ? null : c)))];
  const ws3 = XLSX.utils.aoa_to_sheet(aoa3);
  drows.forEach((r, i) => {
    const R = i + 1;
    const accidentDate = excelSerialDate(r.rec.accident_date);
    if (accidentDate != null) ws3[XLSX.utils.encode_cell({ r: R, c: 1 })] = { t: 'n', v: accidentDate, z: 'yyyy-mm-dd' };
    const c = excelSerialDateTime(r.rec.createdAt);
    if (c != null) ws3[XLSX.utils.encode_cell({ r: R, c: 2 })] = { t: 'n', v: c, z: 'yyyy-mm-dd hh:mm:ss' };
  });
  ws3['!cols'] = [18, 12, 19, 10, 20, 24, 10, 26, 22, 10, 30, 50, 18, 10, 12, 24].map((w) => ({ wch: w }));

  const wb = XLSX.utils.book_new();
  if (selectedSheets[0]) XLSX.utils.book_append_sheet(wb, ws1, '영농기록장');
  if (selectedSheets[1]) XLSX.utils.book_append_sheet(wb, ws2, '증빙정보');
  if (selectedSheets[2]) XLSX.utils.book_append_sheet(wb, ws3, '피해 기록');
  if (readiness && selectedSheets[3]) {
    const ws4 = XLSX.utils.aoa_to_sheet(buildReportSheetRows(profile, records, readiness, todayStr()));
    ws4['!cols'] = [10, 12, 30, 10, 8, 50, 60, 20].map((w) => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws4, '준비도 보고서');
  }
  wb.Props = { Title: '표준 영농기록장', Author: session?.email || '', CreatedDate: new Date() };
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array', compression: true });
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// 모바일 공유 시트 (안드로이드 크롬 등). 지원 안 하면 false
export function canShareFile() {
  try {
    const f = new File([new Blob(['x'])], 'a.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    return !!(navigator.canShare && navigator.canShare({ files: [f] }));
  } catch (e) {
    return false;
  }
}

export async function shareBlob(blob, name) {
  const f = new File([blob], name, { type: blob.type });
  await navigator.share({ files: [f], title: name });
}

export { todayStr };
