# 농사 처방 시연 웹앱 (PWA) P0 골격 v0.3 (재해 기록·수확 개시/종료·종묘 추가)

이 저장소는 공개 시연용(가상 데이터만)입니다. 개발 원본은 팀 비공개 저장소에 있습니다.

작성: 2026-11-15 허간(개발 총괄) / 상태: 골격 (개발 착수 11/20 전 선작업, 게이트1 결정 전이라 허간 추천안 기준)

## 저장소 (2026-11-15 회사 계정으로 이전)

| 용도 | 주소 |
|-|-|
| 개발 원본 (비공개) | https://github.com/nongsacheobang/nongsa-cheobang |
| 시연 (공개, 가상 데이터만) | https://github.com/nongsacheobang/nongsa-cheobang-demo |
| 시연 배포 (GitHub Pages) | https://nongsacheobang.github.io/nongsa-cheobang-demo/ |
| 옛 시연 저장소 (개인 계정, 수정·삭제 안 함) | https://github.com/gani-byte/nongsa-cheobang-demo |

- [ ] TODO: 로컬 git remote를 nongsacheobang/nongsa-cheobang 으로 변경 필요 (이 작업 환경은 git.exe가 막혀 있어 못 바꿈. 예: `git remote set-url origin https://github.com/nongsacheobang/nongsa-cheobang.git`, 시연 저장소는 `git remote add demo https://github.com/nongsacheobang/nongsa-cheobang-demo.git`)
- [ ] TODO: v0.3은 GitHub 웹 업로드로 올렸으므로 로컬 git 기록과 원격 기록이 다름. 로컬에서 `git fetch` 후 원격 main 기준으로 맞추기

기준 문서
- 기능 목록·메뉴 트리 v0.1 (P0 7기능, 홈·일지·증빙·지원금 4탭, 첫 화면 1안)
- 영농일지 입력 항목표 v0.1 (P0 필드, 선택지, 표준 영농기록장 A~M열 매핑)
- 운영비 견적 v1 GCP (Firebase 구성, 이메일 링크 로그인)
- P0 와이어프레임 v0.1 (`261115_허간_기획_P0와이어프레임_v01.html`, 화면 구성·문구 기준)

빌드 도구 없음: 순수 HTML + ES 모듈 JS + CSS. 외부 라이브러리는 CDN ESM import
(SheetJS `https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs`, Firebase `https://www.gstatic.com/firebasejs/<버전>/...`).

## 지금 되는 것 (P0)

| 화면 | 상태 |
|-|-|
| 로그인 | 데모 로그인 동작 (이메일 입력 -> 메일 확인 -> [링크 누르기 (시연)]), "데모 계정으로 둘러보기". Firebase 이메일 링크는 연결 자리 |
| 농장·하우스 동 등록 | 이름, 농장 이름, 위치(시군구), 동 이름·지번·작목(토마토/방울토마토/딸기), 동 추가·삭제. "내 농장"에서 다시 수정 |
| 홈 (1안 바로 기록형) | 진행도 한 줄(이번 달 기록 일수, 미완성 건수) + 오늘 일지 쓰기 큰 버튼 + 오늘 날씨 한 줄 + 최근 기록 3건 |
| 일지 쓰기 | 작업일(오늘 기본), 동 복수 선택, 작목 자동(수정 가능), 날씨 자동 표시(눌러서 수정), 작업단계 6개 큰 버튼 + 세부 작업 칩(토마토/딸기 별도), 농약/비료 여러 줄(구분, 구입·사용, 종류, 제품명 최근 목록+직접, 양 숫자패드, 단위, 희석배수·대상 병해충), 처리 면적(선택), 세부작업내용 자동 문장(직접 고치기 가능), 메모 |
| 저장 | 빈칸 있어도 저장, "미완성" + 빠진 항목 표시. 작성 시각·수정 시각·작성자·위치 자동 저장 |
| 일지 목록 | 날짜순, 월별 묶음, 동별/미완성만 필터, 미완성·가상 표시 |
| 일지 상세 | 전체 항목, 메타(작성·수정 시각, 사후입력), 수정·삭제 |
| 엑셀 다운로드 | 기간(이번 달/영농기간 전체/직접 선택), 시트1 표준 영농기록장 A~M열, 시트2 증빙정보. 모바일은 공유 시트 버튼 |
| 증빙·지원금 탭 | "준비 중" 목업 (와이어프레임 그대로) |
| 데모 데이터 | 처음 설정의 "가상 데모 농장으로 채우기", 내 농장의 "가상 데모 일지 넣기/지우기". 모든 데모 기록은 `demo: true`, 화면 상단 "가상 데이터 (데모)" 띠와 "가상" 태그 |
| PWA | manifest, 서비스 워커(정적 파일 캐시, SheetJS CDN 캐시), 아이콘 SVG/PNG(192, 512, maskable) |

### 엑셀 규칙 (입력 항목표 v0.1 4장)
- 시트1 `영농기록장`: A 작업일, B 필지("1동(가상리 123), 2동(...)"), C 작목, D 날씨("맑음, 4~15℃"), E 구입/사용, F~H 농약 종류·제품명·양, I~K 비료 종류·제품명·양, L 작업단계(작업명), M 세부작업내용(+ 메모)
- 1행은 머리글만, 병합 없음, A열은 진짜 날짜 셀(yyyy-mm-dd), 빈 값은 빈칸(0 안 씀), 자재마다 1행(A~D, L, M 반복), 오래된 날짜부터
- 시트2 `증빙정보`: 기록ID, 작업일, 시트1 행 번호, 작성시각, 수정시각, 사후입력 여부, 작성자, 이메일, 농장 위치, 하늘상태, 최저/최고기온, 강수량, 날씨 출처, 미완성 항목, 영수증 사진 링크(P1 자리), 가상 데이터 여부
- 파일명: `영농기록장_{농장명}_{시작일}_{종료일}.xlsx`

### 날씨 규칙
- 지금은 `weather.js` 의 고정 가상 응답(오늘~모레만 값, 지난 날짜는 "미수집"). 못 받으면 0 이 아니라 `status: 'missing'`, 값은 `null`, 엑셀은 빈칸
- 사용자가 눌러서 고치면 `source: 'manual'` 로 저장(시트2 날씨 출처 "직접 수정")

## v0.2 대화로 기록하기 (2026-11-15, 에이전트 전환 기획서 v1.0 기준)

11/15 대표 결정("대화형 에이전트 + 확인 화면")에 맞춰 홈과 입력 동선을 바꿨습니다. 지금은 AI 호출 없이 **규칙 기반 추출**(`config.agentMode: 'rules'`)로 동작합니다.

| 화면 | 내용 |
|-|-|
| 홈 (1안 하이브리드) | 위: 오늘 날씨 카드 + 할 일 카드(이번 달 기록 N일, 빠진 항목 M건) 한 줄 / 가운데: 최근 기록 3건 / 아래: 대화 입력창 + 마이크(주 동선). 기존 "직접 입력으로 일지 쓰기", 전체, 보기, 내 농장 버튼 유지. "30초면 끝나요" 문구 삭제 |
| 대화 (`#/chat`) | 말풍선, 빠른 답 버튼, 확인 카드(칸별 [고치기] -> 기존 선택형 칩·숫자 입력 재사용), [저장] [직접 입력 화면에서 고치기] [취소], 원문 발화 표시 |
| 마이크 | Web Speech API(`webkitSpeechRecognition`, `ko-KR`)가 있으면 버튼 한 번으로 인식 후 바로 전송. 없으면 "키보드 받아쓰기를 써주세요" 안내 후 입력창 포커스 |
| 시연 대화 버튼 3개 | (1) "어제 1동 토마토에 칼슘제 엽면시비 500배로 20리터 뿌렸어" -> 바로 확인 카드(사용량 40mL 계산, 확인 필요) / (2) "3동 딸기 잿빛곰팡이 약 쳤어" -> 제품명·양 되묻기 / (3) "오늘 날씨 어때?" + "파이썬 코딩 알려줘" -> 거절. 가상 농장은 2동이 방울토마토, 3동이 딸기라서 (2)는 3동으로 둠 |
| 저장 | 기존 storage 어댑터 사용. 일지에 `source_text`(원문 발화), `extract_method`('규칙' / 'AI'), `input_mode`('chat' / 'chat-handoff'), `agent_guessed`(추측한 칸) 추가 저장. 목록에 "대화" 태그, 상세에 대화 원문, 엑셀 시트2에 "입력 방식", "원문 발화" 열 |

대화 규칙 (기획서 4장)
- 되묻기: 항목표 필수 항목만, 한 번에 1개 + 선택지 버튼. 순서: 하우스 동 -> 작목 -> 작업단계 -> (자재마다) 농약/비료 -> 종류 -> 제품명 -> 양 -> 단위. 작업일은 오늘, 동이 1개면 자동. 같은 항목은 최대 2번, "모르겠어요"는 건너뛰고 "미완성"으로 저장. 구입만 한 기록은 작업단계를 묻지 않음
- 추측한 값(병해충으로 정한 농약 종류, 물량·희석배수로 계산한 사용량, 작목으로 정한 동 등)은 카드에 "확인 필요"
- 농민이 [저장](또는 "네/저장")을 해야만 저장. 확인 단계에서 새 문장을 말하면 그 값으로 고친 뒤 카드를 다시 보여 줌. 저장 후 "다른 기록 있어요?"
- 목적 외(코딩, 번역, 주식, 게임, 잡담 등 키워드): "저는 영농일지 기록과 농사 정보 안내만 도와드려요..." + 할 수 있는 일 버튼(작업 기록 예시, 일지 목록, 엑셀). 5회 연속이면 그 세션 대화 잠금(직접 입력만). 날씨 질문은 P0 범위 밖이라 "홈 날씨 카드를 봐 달라"고 안내. "엑셀 줘"는 엑셀 화면으로 이동
- 인식 실패 2회 연속이면 직접 입력 화면으로 넘기고, 대화에서 알아낸 값은 미리 채움(`input_mode: 'chat-handoff'`)

### 규칙 추출 (`js/agent/extract-rules.js`)
- 날짜: 오늘/어제/그제/엊그제/N일 전/11월 14일/11/14/14일 (미래면 작년). 동: "1동", "1동이랑 2동", "1,2동", "1~3동", "전체 동", 되묻기 답 "1번". 작목: 방울토마토(방토·대추·체리)/토마토/딸기, 동에 등록된 작목 자동
- 작업: 키워드 사전 22개 규칙(곁순, 적엽, 런너, 방제, 엽면시비·웃거름, 밑거름, 관수·양액, 환기, 보온, 정식, 경운, 멀칭, 수확, 출하, 철거 등) -> 작목별 세부작업명과 작업단계(constants.js)
- 자재: 농약/비료 구분(키워드·제품명 접미사), 구입(샀어/구입)/사용, 종류(살균/살충/칼슘·엽면/퇴비·유박/복합 등, 병해충에서 추측), 제품명(최근 사용 제품 사전 -> "~수화제/유제/액상/복합비료" 접미사 -> 칼슘제 등 일반명 -> "~을/를" 앞 명사), 양·단위(L, mL/미리/cc, kg/키로, g/그램, 포대, 병, 봉지, 톤, "두 병", "오백 배"), 희석배수, 대상 병해충, 처리 면적(평/㎡/동 전체)
- 계산: "물 50리터에 50그램" -> 희석 1000배, "500배로 20리터 뿌렸어" -> 사용량 40mL(둘 다 "확인 필요", 메모에 근거). 수확·출하 양은 자재가 아니라 메모(수확량)
- 단위 테스트: 예시 발화 30개(`TEST_CASES`, v0.3에서 평가 문장 8개 추가). 앱을 연 뒤 브라우저 콘솔에서 `ncAgentTests()` 실행 -> 표와 "규칙 추출 테스트: N/30 통과"

### 규칙 추출 한계
- 한 발화에 작업 1개만 잡음("곁순 따고 약 쳤어"는 앞 작업만). 자재도 발화당 1개(두 번째는 카드의 [+ 농약/비료 추가]로)
- 사전에 없는 말·사투리·줄임말은 못 잡음. "약"이 없는 농약 발화("다코닐 뿌렸어")는 희석배수·살포 동사로 농약을 추측(확인 필요)
- 제품명은 최근 사용 목록·접미사·"~을/를"에 기대므로 조사 없이 말한 고유 제품명은 놓칠 수 있음(되묻기로 보완). 농약 등록정보 검색은 P1
- "20리터"가 제품 양인지 물량인지는 "물", "~에", 희석배수+살포 동사로만 판단
- 부정·계획("내일 칠 거야", "안 쳤어")을 구분하지 못함. 목적 외 판단은 키워드 목록이라 우회 문장을 모두 막지는 못하지만, 에이전트가 할 수 있는 일이 일지 초안 작성뿐이라 위험은 낮음
- 대화 내용은 새로고침하면 사라짐(저장한 일지와 원문 발화만 남음)

### LLM 연결 TODO (`js/agent/llm-adapter.js`, `config.agentMode: 'llm'`)
- [ ] Cloud Functions 2세대(asia-northeast3) `agent` 함수: Firebase Auth ID 토큰 확인, 1인 하루 한도(기본 30, 서버 기준), 입력 500자, 최근 6턴만 전달
- [ ] Vertex AI Gemini 호출: 모델 `gemini-3.1-flash-lite`(설정값 `agentModel`, 은퇴 시 교체), 함수 선언 `SAVE_FARM_LOG_DECL`(save_farm_log) 그대로 사용, maxOutputTokens 512, 시스템 안내문 컨텍스트 캐시
- [ ] 서버 검증: 동·작목이 내 농장에 있는지, 단위·숫자 범위, 목적 외 의도는 정해진 거절 문구로 종료
- [ ] 응답 모양 `{ intent, args, reply }` -> 앱은 `fromFunctionArgs()`로 규칙 추출과 같은 초안 모양으로 바꾸고 같은 확인 카드·되묻기 흐름을 탐
- [ ] 폴백: 엔드포인트 미설정·오류·`agentTimeoutMs`(5초) 초과·하루 한도 초과면 자동으로 규칙 추출 (구현됨). 예산 100% 알림 시 rules 강제 전환은 2R 전 검토
- [ ] 서비스 계정·API 키는 서버 런타임 서비스 계정과 Secret Manager에만. 이 저장소에 비밀값 커밋 금지
- [ ] 대화 시나리오 10개(게이트 2)로 규칙 vs Gemini 정확도·토큰 측정 -> 운영비 v2

## v0.3 손해평가사 관점 평가 반영 (2026-11-15, P0 최소)

근거: 슬랙 #20-앱기획-화면설계 효신 글(시연 앱 손해평가사 관점 평가) + 첫부 `농사처방_시연앱_손해평가사관점_평가_v1.md`. 여전히 규칙 기반(AI 호출 없음).

| 항목 | 내용 |
|-|-|
| 의도 "재해" | 강풍·태풍·우박·냉해·동상해·호우·폭설·폭염·짐승·새·화재 단어 + 피해 표현(찢어짐, 상처, 입었어요 등)이 있으면 재해 기록. "대비/예방/예보"는 제외 |
| 재해 카드 | 사고일 `accident_date`(말한 날짜만, 어제/그제 유지), 재해 종류 `peril`, 피해 동 `houseIds`(plots), 시설 피해 `facility_damage`, 작물 피해 `crop_symptom`, 메모, 원문. 빠진 필수는 평가 문서 3장 문구로 되묻기("피해는 언제 생겼어요?", "어떤 피해예요?", "몇 동이 피해를 입었어요?", "하우스 자체도 부서졌나요?", "작물은 어떻게 됐어요?"). 사진은 "수리·철거 전에 사진 먼저 찍어두세요" 안내 문구만 |
| 저장 | 작업 일지와 별도 기록 `type: 'disaster'`(같은 저장소). 목록에 "재해" 태그, 재해 기록 상세(삭제만, 작업 일지 수정 화면으로 안 보냄), 엑셀 시트3 `재해 기록`(사고일·작성시각 따로). 시트1·2에는 안 들어감 |
| 세부 작업 | 수확·출하에 "수확 개시", "수확 종료" 추가(토마토·딸기). "수확 시작했어요", "수확 끝났어요" 자동 |
| 자재 종류 | "종묘(모종)" 추가(종류: 모종/접목묘/종자/기타, 단위: 주/포기/판/봉지). "모종 3000주 구입했어요. 45만원" -> 종묘 구입 3000주, 메모 "금액 45만원". 엑셀 시트1은 표준 양식에 종묘 열이 없어 E열과 M열(세부작업내용)에만 남음 |
| 정식 카드 | 품종·주수 칸(말에 있으면 자동). 직접 입력 화면도 세부 작업이 정식이면 품종·주수 칸 |
| 동 등록 | 재배면적(㎡, 선택) 칸. 내 농장에 표시 |
| 오류 수정 | "병든 잎 따고"처럼 약 안 친 문장은 농약 자재를 만들지 않고 메모에 "잿빛곰팡이병 발생". "최저 5도" 같은 온도 값, 수확 문장의 출하량(박스 단위 추가)·출하처·마지막 출하는 메모에 보존. 확인 카드가 떠 있을 때 다른 작업·재해 문장을 말하면 새 초안으로(원문 섞임 방지), 되묻기 답은 원문에 붙이지 않고 `chat_answers`로 따로 저장 |
| 확인 카드 | 날짜·동 번호·주수를 크게 강조(눌러서 수정) |
| 시연 대화 버튼 | "강풍·냉해 재해 기록" 추가(4개) |
| 단위 테스트 | 기존 22개 + 평가 문서 테스트 문장 8개 = 30개, 전부 통과 (`ncAgentTests()` -> "규칙 추출 테스트: 30/30 통과") |
| 서비스 워커 | 캐시 `nongsa-cheobang-v0.3.0`, 앱 버전 0.3.0 |

남은 것 (평가 문서 P1): 기상특보 자동 조회, 재배 포기 여부, 피해 규모, 사진 첨부(촬영 시각·위치), 사고 접수 여부, 응급조치 비용, 직전 7일 관리 기록 연결, 작기(정식일·수확 개시·종료) 화면, 보험 계약 정보, 시설면적·규격, 출하 기록 구조화, 연속 재해 종료일. 대화에서 "2동은 방울토마토로 등록돼 있어요" 경고 반복은 미확인.

## 파일 구조

```
index.html                 앱 셸 (js/app.js 모듈 로드)
manifest.webmanifest       PWA 설치 정보
sw.js                      서비스 워커 (정적 파일 캐시, 버전 올리면 갱신)
css/app.css                모바일 우선 스타일 (와이어프레임 색·간격)
icons/                     icon.svg, icon-192.png, icon-512.png, icon-maskable-512.png
js/config.js               설정 스위치: 저장소, 로그인, 날씨, 첫 화면 안, P0 범위, Firebase 웹 설정
js/app.js                  화면 렌더링, 해시 라우팅, 이벤트
js/constants.js            선택지 (작업단계, 세부 작업, 병해충, 농약/비료 종류, 단위, 엑셀 머리글)
js/records.js              빈 레코드, 작목 자동, 세부작업내용 자동 문장, 미완성 판정, 사후입력 판정
js/excel.js                .xlsx 생성 (SheetJS CDN), 다운로드·공유
js/weather.js              날씨 어댑터 (mock / proxy), 기상청 격자 변환 함수
js/auth.js                 로그인 어댑터 (demo / firebase 이메일 링크)
js/demo.js                 가상 데모 농장·일지 20건
js/firebase-init.js        Firebase SDK CDN 로드 (firebase 모드일 때만)
js/storage/index.js        저장소 선택
js/storage/local.js        localStorage 어댑터 (지금 동작)
js/agent/extract-rules.js  규칙 기반 한국어 추출기(재해 포함) + 되묻기 답 해석 + 단위 테스트(runExtractTests, TEST_CASES 30개)
js/agent/agent.js          대화 상태 머신 (이해 -> 되묻기 -> 확인 카드 -> 저장 / 거절 / 실패 시 직접 입력)
js/agent/llm-adapter.js    agentMode rules|llm 선택, Gemini save_farm_log 함수 선언, 실패 시 rules 폴백
js/agent/chat-view.js      대화 화면·확인 카드·입력창(마이크)·시연 대화 버튼 UI
js/storage/firebase.js     Firestore 어댑터 (연결 자리, 미테스트)
firestore.rules            보안 규칙 초안 (본인 uid 만)
firebase.json              Hosting·Firestore 배포 설정 초안
serve.ps1                  python 없을 때 쓰는 PowerShell 정적 서버
```

데이터 모양 (local, firebase 공통)
- 프로필: `{ name, farmName, location, houses: [{ id, name, lot, crop, area(㎡, 선택) }], demo? }`
- 일지 v0.3 추가: 정식일 때 `variety, plant_count`, 대화 되묻기 답 `chat_answers`, 자재 kind 에 `'종묘(모종)'`
- 재해 기록 v0.3: `{ id, type: 'disaster', accident_date, workDate(=사고일, 없으면 작성일), continuing, houseIds[], crop, peril, facility_damage, crop_symptom, weather, memo, source_text, chat_answers, extract_method, input_mode, agent_guessed[], missing[], createdAt, demo }`
- 일지 v0.2 추가 필드(대화 입력일 때): `source_text, extract_method('규칙'|'AI'), input_mode('chat'|'chat-handoff'), agent_guessed[]`
- 일지: `{ id, workDate, houseIds[], crop, weather{status, sky, tmin, tmax, rain, source, reason}, stage, task, materials[{kind, action, type, name, qty, unit, dilution, pest}], area{value, unit}, detail, detailEdited, memo, author, authorEmail, location, missing[], createdAt, updatedAt, demo }`

## 로컬 실행

ES 모듈이라 `file://` 로 열면 안 되고 정적 서버가 필요합니다.

```
# python 있을 때
python -m http.server 8080 --directory C:\Users\Gani\Documents\Codex\nongsa-cheobang-web
# python 없을 때 (PowerShell)
pwsh -File serve.ps1 -Port 8080
```
브라우저에서 `http://localhost:8080/` 접속. 휴대폰 확인은 같은 와이파이에서 PC IP 로 접속하거나, Firebase Hosting 배포 후 확인 (서비스 워커·설치는 https 또는 localhost 에서만 동작).

데이터 초기화: 개발자 도구 > Application > Local Storage 에서 `nc:` 로 시작하는 키 삭제, 또는 내 농장 > 로그아웃.

## Firebase 연결 절차 (프로젝트 nongsacheobang 권한 받은 뒤)

1. 효신에게 GCP 프로젝트 `nongsacheobang` 편집자(또는 Firebase 관리자) 권한 요청
2. Firebase 콘솔에서 프로젝트 추가(기존 GCP 프로젝트 선택) -> 웹 앱 등록 -> 웹 설정값 복사해 `js/config.js` 의 `firebase` 에 붙이기 (apiKey 등 웹 설정은 공개 식별자. 서비스 계정 키·기상청 서비스키는 절대 커밋 금지)
3. Authentication -> 로그인 방법 -> "이메일/비밀번호" 사용 + "이메일 링크(비밀번호 없는 로그인)" 사용. 승인된 도메인에 `localhost`, `nongsacheobang.web.app`(배포 주소), 도메인 구매 시 그 도메인 추가
4. Firestore 생성: 위치 `asia-northeast3`(서울), 프로덕션 모드. `firestore.rules` 배포
5. `js/config.js` 에서 `storage: 'firebase'`, `auth: 'firebase'`, `firebaseVersion` 최신 확인
6. 로컬에서 로그인 메일 수신 -> 링크 클릭 -> 동 등록 -> 일지 저장 -> Firestore 콘솔에서 `users/{uid}/records` 확인
7. 배포: Firebase CLI 가 이 PC 에서 막혀 있으면(npm EPERM) Cloud Shell 에서 `firebase deploy --only hosting,firestore:rules` (저장소 업로드 후)
8. 날씨: Cloud Functions(2세대, asia-northeast3) 날씨 프록시 작성 -> 기상청 서비스키는 Secret Manager -> 격자별 Firestore 캐시 -> `config.weather: 'proxy'`, `weatherProxyUrl` 설정
9. 비용 안전장치(운영비 견적 v1 7장): 함수 최대 인스턴스 3, App Check, 목록 30건 페이지, 예산 알림 확인

## 남은 TODO

- [ ] 대화 모드: LLM 연결(위 "LLM 연결 TODO"), 대화 기록 보관(30일), 하루 한도·잠금을 서버 기준으로, 거절·농약 안내 문구 효신 검수, iOS 사파리·설치(PWA) 모드 Web Speech 지원 확인, 실제 농민 발화로 사전 보강

- [ ] Firebase 실제 연결과 테스트 (GCP 권한 받은 뒤). `storage/firebase.js`, `auth.js` firebase 모드는 코드만 있고 미테스트
- [ ] Firebase 세션 복원(onAuthStateChanged), createdAt 서버 시각(serverTimestamp) + 보안 규칙 검증
- [ ] 기상청 API 키 발급 후 Cloud Functions 날씨 프록시, 실패 시 마지막 성공값 캐시
- [ ] 농장 위치 -> 좌표(카카오 로컬) -> 격자(nx, ny) 저장. 격자 변환 함수 `latLonToGrid` 는 준비됨
- [ ] 과거 날짜(사후입력) 날씨 출처 결정 (단기예보는 과거 조회 불가, 지상관측 자료 API 필요 여부)
- [ ] 목록 페이지 나누기(30건), 오프라인 캐시(Firestore persistentLocalCache)
- [ ] 효신 검토 반영: 세부 작업명·병해충 목록·단위(`js/constants.js`), 자주 쓰는 템플릿 5개(P1), 실제 데모 농가 데이터(`js/demo.js` 교체)
- [ ] 실제 기기(안드로이드 크롬) 설치·공유 시트 확인, 아이콘 디자인 교체
- [ ] 배포 주소 확정 후 사업계획서 스크린샷·링크

## 게이트1(11/16) / 게이트2(11/18) 결정에 따라 바꿀 곳

| 결정 | 바꿀 곳 |
|-|-|
| 첫 화면 1안/2안/3안 | `js/config.js` `homeVariant`, `showProgressLine`. 2안·3안은 `js/app.js` 의 `vHome()` 옆에 화면 함수 추가 (2안 +1.5일, 3안 +1.5~2일 견적) |
| 로그인 방식 (이메일 링크 / 6자리 코드) | `js/config.js` `auth`, `js/auth.js` 에 어댑터 추가. 6자리 코드는 Cloud Functions + 외부 메일(Resend 등, 달러 결제 이슈) 필요. 로그인 화면 문구는 `vLogin()`, `vSent()` |
| P0 범위 (가) 엄격안 / (나) 지원금 목업을 실제 화면 / (다) 날씨 고정 응답 | `js/config.js` `features.editDelete`(수정·삭제 끄기), `weather: 'mock'` 유지, 지원금 화면은 `vSupport()` |
| 지원금 서비스 범위 (A / A+B) | `vSupport()` 문구 ("신청 대행" 표현 금지 유지) |
| 작업 목록·병해충·단위 | `js/constants.js` |
| 엑셀 열 구성(농업ON 호환 시트 P2 등) | `js/excel.js` `buildWorkbook()` |

## 동작 확인 기록 (2026-11-15)

- 이 PC 의 작업 환경은 명령마다 네트워크가 격리되어, `python -m http.server` 는 실행되지만 다른 프로세스(브라우저 포함)에서 접속이 안 되고(타임아웃), PowerShell HttpListener 는 시작 단계에서 막힘. 같은 프로세스 안에서는 python 서버가 정상 응답(200, text/html).
- 대신 브라우저에 실제 소스 파일(js 모듈 전부, css)을 그대로 주입해 실행하는 방식으로 주요 흐름을 클릭 확인함: 로그인(데모 링크) -> 처음 설정(동 2개) -> 일지 2건 입력(오늘 1동 토마토 농약 사용 / 어제 2동 딸기 비료, 양 빈칸 -> 미완성 표시, 날씨 미수집) -> 목록 -> 상세 -> 수정(양 채움 -> 미완성 해제, 수정시각 기록) -> 엑셀 다운로드(.xlsx 파싱 확인: 시트 2개, A~M 머리글, 병합 없음, A열 날짜 셀, 미수집 날씨 빈칸, 0 값 없음, 시트2 사후입력 Y) -> 데모 데이터 넣기/지우기 -> 삭제 -> 로그아웃 -> 데모 계정 -> 미완성만 필터 -> 영농기간 전체 엑셀(20건).
- 이 방식에서는 서비스 워커·manifest 설치는 실행 확인 못 함 (문법·JSON 검사만). 실제 서버(localhost 또는 Firebase Hosting)에서 다시 확인 필요.
