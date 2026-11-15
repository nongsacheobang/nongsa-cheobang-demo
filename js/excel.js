// 표준 영농기록장 .xlsx 만들기 (SheetJS, CDN ESM)
// 시트1 "영농기록장": 표준 영농기록장 순서 A~M열, 1행은 머리글만, 셀 병합 없음,
//   날짜는 날짜 셀(yyyy-mm-dd), 빈 값은 0 이 아닌 빈칸, 농약·비료는 자재마다 1행(A~D, L, M 반복)
// 시트2 "증빙정보": 기록ID, 작성·수정 시각, 사후입력 여부, 작성자, 위치, 기온·강수량 등 (증빙 신뢰도용)
// 시트3 "재해 기록" (v0.3): 사고일, 재해 종류, 피해 동, 시설 피해, 작물 피해, 원문. 작업 일지(시트1·2)와 분리
//   종묘(모종)은 표준 양식에 열이 없어 E열(구입/사용)과 M열(세부작업내용)에만 남는다

import { EXCEL_HEADERS, DISASTER_HEADERS } from './constants.js';
import { plotsText, qtyText, detailOf, missingFields, isBackfill, isDisaster, todayStr } from './records.js';
import { weatherCell } from './weather.js';

const XLSX_URL = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs';

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
  return [...records].sort((a, b) => a.workDate.localeCompare(b.workDate) || (a.createdAt || '').localeCompare(b.createdAt || ''));
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
  if (r.input_mode === 'chat') return `대화(${r.extract_method || '규칙'})`;
  if (r.input_mode === 'chat-handoff') return `대화 후 직접 입력(${r.extract_method || '규칙'})`;
  return '직접';
}

function excelSerialDate(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000;
}
function excelSerialDateTime(iso) {
  if (!iso) return null;
  const t = new Date(iso);
  const utcLike = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate(), t.getHours(), t.getMinutes(), t.getSeconds());
  return (utcLike - Date.UTC(1899, 11, 30)) / 86400000;
}

function sourceText(w) {
  if (!w || w.status === 'missing') return '미수집';
  return { mock: '가상 고정값(시연)', kma: '기상청 단기예보', manual: '직접 수정' }[w.source] || '';
}

export function fileName(profile, from, to) {
  const farm = (profile?.farmName || '농장').replace(/[\\/:*?"<>|\s()]+/g, '');
  return `영농기록장_${farm}_${from.replace(/-/g, '')}_${to.replace(/-/g, '')}.xlsx`;
}

// 시트3 행 (재해 기록 1건당 1행). 사고일과 작성일을 따로 남긴다
export function buildDisasterRows(profile, records) {
  return sortAsc(records.filter(isDisaster)).map((r) => ({
    rec: r,
    cells: [
      r.id, r.accident_date || '', r.createdAt || '', isBackfill(r) ? 'Y' : 'N', r.peril || '', plotsText(profile, r.houseIds), r.crop || '',
      r.facility_damage || '', r.crop_symptom || '', r.continuing ? 'Y' : 'N', r.memo || '', r.source_text || '',
      inputModeText(r), r.author || '', r.demo ? 'Y' : 'N',
    ],
  }));
}

export async function buildWorkbook(profile, session, records) {
  const XLSX = await import(XLSX_URL);
  const rows = buildSheet1Rows(profile, records);

  // 시트1
  const aoa1 = [EXCEL_HEADERS, ...rows.map((r) => r.cells.map((c, i) => (i === 0 ? null : c === '' ? null : c)))];
  const ws1 = XLSX.utils.aoa_to_sheet(aoa1);
  rows.forEach((r, i) => {
    const addr = XLSX.utils.encode_cell({ r: i + 1, c: 0 });
    ws1[addr] = { t: 'n', v: excelSerialDate(r.rec.workDate), z: 'yyyy-mm-dd' };
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
    const ok = w.status !== 'missing';
    aoa2.push([
      r.id, null, firstRow.get(r.id) || null, null, null,
      isBackfill(r) ? 'Y' : 'N',
      r.author || '', r.authorEmail || '',
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
    ws2[XLSX.utils.encode_cell({ r: R, c: 1 })] = { t: 'n', v: excelSerialDate(r.workDate), z: 'yyyy-mm-dd' };
    const c = excelSerialDateTime(r.createdAt);
    if (c != null) ws2[XLSX.utils.encode_cell({ r: R, c: 3 })] = { t: 'n', v: c, z: 'yyyy-mm-dd hh:mm:ss' };
    const u = excelSerialDateTime(r.updatedAt);
    if (u != null) ws2[XLSX.utils.encode_cell({ r: R, c: 4 })] = { t: 'n', v: u, z: 'yyyy-mm-dd hh:mm:ss' };
  });
  ws2['!cols'] = [18, 12, 10, 19, 19, 10, 10, 22, 22, 10, 10, 10, 10, 16, 24, 18, 12, 18, 50].map((w) => ({ wch: w }));

  // 시트3 재해 기록 (기록이 없어도 머리글은 둔다)
  const drows = buildDisasterRows(profile, records);
  const aoa3 = [DISASTER_HEADERS, ...drows.map((r) => r.cells.map((c) => (c === '' ? null : c)))];
  const ws3 = XLSX.utils.aoa_to_sheet(aoa3);
  drows.forEach((r, i) => {
    const R = i + 1;
    if (r.rec.accident_date) ws3[XLSX.utils.encode_cell({ r: R, c: 1 })] = { t: 'n', v: excelSerialDate(r.rec.accident_date), z: 'yyyy-mm-dd' };
    const c = excelSerialDateTime(r.rec.createdAt);
    if (c != null) ws3[XLSX.utils.encode_cell({ r: R, c: 2 })] = { t: 'n', v: c, z: 'yyyy-mm-dd hh:mm:ss' };
  });
  ws3['!cols'] = [18, 12, 19, 10, 20, 24, 10, 26, 22, 10, 30, 50, 18, 10, 12].map((w) => ({ wch: w }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, '영농기록장');
  XLSX.utils.book_append_sheet(wb, ws2, '증빙정보');
  XLSX.utils.book_append_sheet(wb, ws3, '재해 기록');
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
