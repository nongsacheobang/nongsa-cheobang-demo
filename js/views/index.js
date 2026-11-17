// 화면 모듈 목록 (Aside 담당). 새 화면 파일을 만들면 여기에 한 줄 추가한다.
// Codex가 새 화면을 더할 때는 handoff로 요청하거나, 이 파일의 자기 줄만 고친다.
import { registerView } from './registry.js';
import report from './report.js';
import premium from './premium.js';
import field from './field.js';
import coverage from './coverage.js';
import info from './info.js';
import home from './home.js'; // M-04 Aside
import factors from './factors.js'; // M-05 Aside
import farm from './farm.js'; // M-02 Aside
import insurance from './insurance.js'; // M-03 Aside
import record from './record.js'; // M-06 Codex
import accident from './accident.js'; // M-07 Codex

export function registerAllViews(reservedActions = []) {
  for (const v of [home, factors, farm, insurance, record, accident, coverage, info, field, report, premium]) registerView(v, { reservedActions });
}
