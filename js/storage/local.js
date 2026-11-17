// localStorage 어댑터 (지금 동작하는 저장소)
// 키 구조: nc:profile:{uid} = 농장 프로필 JSON, nc:records:{uid} = 일지 배열 JSON
// 모든 함수는 Promise를 돌려준다 (firebase.js와 같은 인터페이스).

const PFX = 'nc:';

function read(key, fallback) {
  try {
    const v = localStorage.getItem(PFX + key);
    return v ? JSON.parse(v) : fallback;
  } catch (e) {
    return fallback;
  }
}
function write(key, value) {
  localStorage.setItem(PFX + key, JSON.stringify(value));
}
function newId() {
  return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// 계약 모양(snake_case, contract-store.js가 씀)과 옛 모양(camelCase)을 모두 읽는다
const isDoc = (r) => !!r && 'record_id' in r && 'work_date' in r;
const idOf = (r) => (isDoc(r) ? r.record_id : r.id);
const dateOf = (r) => (isDoc(r) ? r.work_date : r.workDate) || '';
const createdOf = (r) => (isDoc(r) ? r.created_at : r.createdAt) || '';
const demoOf = (r) => (isDoc(r) ? r.is_demo : r.demo);

export const localStore = {
  name: 'local',

  async getProfile(uid) {
    return read('profile:' + uid, null);
  },

  async saveProfile(uid, profile) {
    const now = new Date().toISOString();
    const prev = read('profile:' + uid, null);
    const next = { ...profile, createdAt: prev?.createdAt || now, updatedAt: now };
    write('profile:' + uid, next);
    return next;
  },

  // opts.from/opts.to: 'YYYY-MM-DD' (포함). 작업일 내림차순, 같은 날은 작성 시각 내림차순
  async listRecords(uid, opts = {}) {
    let list = read('records:' + uid, []);
    if (opts.from) list = list.filter((r) => dateOf(r) >= opts.from);
    if (opts.to) list = list.filter((r) => dateOf(r) <= opts.to);
    list.sort((a, b) => (dateOf(b).localeCompare(dateOf(a))) || createdOf(b).localeCompare(createdOf(a)));
    return list;
  },

  async getRecord(uid, id) {
    return read('records:' + uid, []).find((r) => idOf(r) === id) || null;
  },

  // id가 없으면 새로 만들고, 있으면 수정. createdAt은 처음 저장 시각을 유지, updatedAt은 수정할 때만 갱신
  async saveRecord(uid, rec) {
    const list = read('records:' + uid, []);
    // 계약 모양은 시각과 못 바꿈 값을 contract.js가 이미 정했다. 그대로 넣거나 바꾼다
    if (isDoc(rec)) {
      const i = list.findIndex((r) => idOf(r) === rec.record_id);
      if (i >= 0) list[i] = rec; else list.push(rec);
      write('records:' + uid, list);
      return rec;
    }
    const now = new Date().toISOString();
    let saved;
    const idx = rec.id ? list.findIndex((r) => r.id === rec.id) : -1;
    if (idx >= 0) {
      saved = { ...rec, createdAt: list[idx].createdAt, updatedAt: now };
      list[idx] = saved;
    } else {
      saved = { ...rec, id: rec.id || newId(), createdAt: rec.createdAt || now, updatedAt: rec.updatedAt || null };
      list.push(saved);
    }
    write('records:' + uid, list);
    return saved;
  },

  async saveRecordsBulk(uid, recs) {
    const list = read('records:' + uid, []);
    recs.forEach((r) => list.push(isDoc(r) ? r : { ...r, id: r.id || newId() }));
    write('records:' + uid, list);
  },

  async deleteRecord(uid, id) {
    write('records:' + uid, read('records:' + uid, []).filter((r) => idOf(r) !== id));
  },

  async deleteDemoRecords(uid) {
    write('records:' + uid, read('records:' + uid, []).filter((r) => !demoOf(r)));
  },

  async clearAll(uid) {
    localStorage.removeItem(PFX + 'profile:' + uid);
    localStorage.removeItem(PFX + 'records:' + uid);
  },
};
