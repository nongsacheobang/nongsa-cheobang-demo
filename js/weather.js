// 날씨 어댑터
//  - 'mock' : 고정 가상 응답 (기상청 API 키 없음, 지금 동작)
//  - 'proxy': Cloud Functions 날씨 프록시 호출 (연결 자리)
//
// 원칙 (기능 목록 v0.1, 엑셀 오류 재현): 못 받으면 0 이 아니라 "미수집" 으로 둔다.
//   값이 없으면 tmin/tmax/rain 은 null, status = 'missing'. 엑셀에서도 빈칸.
//
// 반환 모양:
//   { status: 'ok' | 'missing', sky, tmin, tmax, rain, source: 'mock' | 'kma' | 'manual', reason, fetchedAt, grid }
//
// 나중에 서버 프록시로 바꿀 때 (README 참고):
//   Cloud Functions(asia-northeast3) 가 기상청 단기예보(15084084) getVilageFcst / getUltraSrtNcst 를 호출하고,
//   격자(nx, ny)별로 Firestore weatherCache/{nx_ny_YYYYMMDD} 에 캐시한다. 서비스키는 Secret Manager 에만 둔다.
//   앱은 GET {weatherProxyUrl}?nx=..&ny=..&date=YYYY-MM-DD 로 위 모양 JSON 을 받는다.

import { CONFIG } from './config.js';

export function missingWeather(reason) {
  return { status: 'missing', sky: '', tmin: null, tmax: null, rain: null, source: '', reason: reason || '미수집', fetchedAt: new Date().toISOString() };
}

// 고정 가상 응답 (시연용). 단기예보는 오늘~모레까지만 있으므로 그 범위만 값을 준다.
const MOCK_TABLE = [
  { sky: '맑음', tmin: 4, tmax: 15, rain: 0 },
  { sky: '구름많음', tmin: 6, tmax: 14, rain: 0 },
  { sky: '흐림', tmin: 7, tmax: 12, rain: 0.5 },
];

function dayDiff(dateStr, base = new Date()) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const a = Date.UTC(y, m - 1, d);
  const b = Date.UTC(base.getFullYear(), base.getMonth(), base.getDate());
  return Math.round((a - b) / 86400000);
}

async function mockWeather(date) {
  const diff = dayDiff(date);
  if (diff < 0) return missingWeather('지난 날짜는 단기예보로 조회 안 됨 (미수집)');
  if (diff > 2) return missingWeather('예보 범위(모레까지) 밖 (미수집)');
  return { status: 'ok', ...MOCK_TABLE[diff], source: 'mock', reason: '', fetchedAt: new Date().toISOString(), grid: null };
}

async function proxyWeather(date, location) {
  if (!CONFIG.weatherProxyUrl) return missingWeather('날씨 서버 미설정 (미수집)');
  try {
    // TODO: 농장 등록 시 카카오 로컬 API 로 주소 -> 좌표 -> latLonToGrid 결과(nx, ny)를 프로필에 저장해 두고 사용
    const g = location?.grid || {};
    const url = `${CONFIG.weatherProxyUrl}?nx=${g.nx || ''}&ny=${g.ny || ''}&date=${date}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    if (j.status !== 'ok') return missingWeather(j.reason || '미수집');
    return {
      status: 'ok',
      sky: j.sky || '',
      tmin: typeof j.tmin === 'number' ? j.tmin : null,
      tmax: typeof j.tmax === 'number' ? j.tmax : null,
      rain: typeof j.rain === 'number' ? j.rain : null,
      source: 'kma',
      reason: '',
      fetchedAt: new Date().toISOString(),
      grid: g,
    };
  } catch (e) {
    // TODO: 마지막 성공값 캐시 표시 (기능 목록 축소 순서 2번)
    return missingWeather('날씨 조회 실패 (미수집)');
  }
}

export async function getWeather(date, location) {
  if (CONFIG.weather === 'proxy') return proxyWeather(date, location);
  return mockWeather(date);
}

// 화면 표시용 한 줄: "맑음 4~15℃"
export function weatherText(w) {
  if (!w || w.status !== 'ok' || (!w.sky && w.tmin == null && w.tmax == null)) return '미수집';
  let s = w.sky || '';
  if (w.tmin != null || w.tmax != null) s += (s ? ' ' : '') + `${w.tmin ?? '?'}~${w.tmax ?? '?'}℃`;
  return s;
}

// 엑셀 D열용: "맑음, 4~15℃". 미수집은 빈칸
export function weatherCell(w) {
  if (!w || w.status !== 'ok') return '';
  const parts = [];
  if (w.sky) parts.push(w.sky);
  if (w.tmin != null || w.tmax != null) parts.push(`${w.tmin ?? ''}~${w.tmax ?? ''}℃`);
  return parts.join(', ');
}

export function weatherSourceLabel(w) {
  if (!w || w.status !== 'ok') return w?.reason || '미수집';
  if (w.source === 'manual') return '직접 수정';
  if (w.source === 'kma') return '기상청 자동';
  if (w.source === 'mock') return '가상 고정값';
  return '출처 미확인';
}

// 기상청 격자 변환 (위경도 -> nx, ny). 기상청 단기예보 활용가이드 LCC DFS 공식
export function latLonToGrid(lat, lon) {
  const RE = 6371.00877, GRID = 5.0, SLAT1 = 30.0, SLAT2 = 60.0, OLON = 126.0, OLAT = 38.0, XO = 43, YO = 136;
  const DEGRAD = Math.PI / 180.0;
  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD, slat2 = SLAT2 * DEGRAD, olon = OLON * DEGRAD, olat = OLAT * DEGRAD;
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);
  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);
  let theta = lon * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;
  return { nx: Math.floor(ra * Math.sin(theta) + XO + 0.5), ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5) };
}
