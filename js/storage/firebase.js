// Firestore 어댑터 (연결 자리, 아직 테스트 안 함)
// GCP 프로젝트 nongsacheobang 권한을 받은 뒤 아래 순서로 연결한다. (README "Firebase 연결 절차" 참고)
//   1) Firebase 콘솔에서 Firestore 생성 (위치: asia-northeast3 서울, 프로덕션 모드)
//   2) js/config.js 의 firebase 웹 설정 채우기, storage: 'firebase' 로 변경
//   3) firestore.rules 배포 (본인 uid 문서만 읽기/쓰기)
//   4) 로컬에서 Firebase 에뮬레이터 또는 실제 프로젝트로 로그인 -> 동 등록 -> 일지 저장 확인
//
// 데이터 구조 (local.js 와 같은 모양):
//   users/{uid}                    농장 프로필 (name, farmName, location, houses[])
//   users/{uid}/records/{recordId} 일지 1건 (workDate, houseIds, crop, weather, stage, task, materials[], detail, memo, createdAt, updatedAt ...)
//
// 비용 주의 (운영비 견적 v1 7장): 전체 컬렉션 실시간 구독 금지, 목록은 30건씩 페이지(TODO), 내 uid 범위로만 쿼리.
// createdAt/updatedAt 은 증빙 신뢰도용이라 TODO: serverTimestamp() 로 바꾸고 보안 규칙에서 클라이언트 임의 값 거부.

import { getFirebase } from '../firebase-init.js';

let fs = null; // firestore 모듈 함수 모음
let db = null;

async function ensure() {
  if (db) return;
  const fb = await getFirebase();
  fs = fb.firestore;
  db = fb.db;
  // TODO: 오프라인 캐시 (initializeFirestore + persistentLocalCache) 적용 검토
}

function recCol(uid) {
  return fs.collection(db, 'users', uid, 'records');
}

export const firebaseStore = {
  name: 'firebase',

  async getProfile(uid) {
    await ensure();
    const snap = await fs.getDoc(fs.doc(db, 'users', uid));
    return snap.exists() ? snap.data() : null;
  },

  async saveProfile(uid, profile) {
    await ensure();
    const now = new Date().toISOString();
    const next = { ...profile, updatedAt: now, createdAt: profile.createdAt || now };
    await fs.setDoc(fs.doc(db, 'users', uid), next, { merge: true });
    return next;
  },

  async listRecords(uid, opts = {}) {
    await ensure();
    // 기존 화면 형식과 계약 문서를 함께 읽는다. Firestore의 orderBy는 필드가 없는 문서를 제외한다.
    const snap = await fs.getDocs(fs.query(recCol(uid)));
    const rows = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    const date = r => r.work_date || r.workDate || '';
    return rows.filter(r => (!opts.from || date(r) >= opts.from) && (!opts.to || date(r) <= opts.to))
      .sort((a,b) => date(b).localeCompare(date(a)) || String(b.created_at || b.createdAt || '').localeCompare(String(a.created_at || a.createdAt || '')));

  },

  async getRecord(uid, id) {
    await ensure();
    const snap = await fs.getDoc(fs.doc(db, 'users', uid, 'records', id));
    return snap.exists() ? { ...snap.data(), id: snap.id } : null;
  },

  async saveRecord(uid, rec) {
    await ensure();
    const id = rec.record_id || rec.id;
    if (rec.record_id) {
      const ref = fs.doc(db, 'users', uid, 'records', id);
      await fs.setDoc(ref, rec);
      return rec;
    }
    const now = new Date().toISOString();
    if (id) {
      const ref = fs.doc(db, 'users', uid, 'records', id);
      const prev = await fs.getDoc(ref);
      if (prev.exists()) {
        const saved = { ...rec, id, createdAt: prev.data().createdAt, updatedAt: now };
        await fs.setDoc(ref, saved);
        return saved;
      }
    }
    const ref = id ? fs.doc(db, 'users', uid, 'records', id) : fs.doc(recCol(uid));
    const saved = { ...rec, id: ref.id, createdAt: rec.createdAt || now, updatedAt: rec.updatedAt || null };
    await fs.setDoc(ref, saved);
    return saved;

  },

  async saveRecordsBulk(uid, recs) {
    await ensure();
    if (recs.length > 500) throw new Error('한 번에 저장할 수 있는 기록은 500건까지입니다');
    const batch = fs.writeBatch(db);
    recs.forEach((r) => {
      const id = r.record_id || r.id;
      const ref = id ? fs.doc(db, 'users', uid, 'records', id) : fs.doc(recCol(uid));
      batch.set(ref, r.record_id ? r : { ...r, id: ref.id });
    });
    await batch.commit();
  },

  async deleteRecord(uid, id) {
    await ensure();
    await fs.deleteDoc(fs.doc(db, 'users', uid, 'records', id));
  },

  async deleteDemoRecords(uid) {
    await ensure();
    const snap = await fs.getDocs(fs.query(recCol(uid)));
    const demo = snap.docs.filter(d => { const r=d.data(); return r.is_demo === true || r.demo === true; });
    if (demo.length > 500) throw new Error('한 번에 삭제할 수 있는 데모 기록은 500건까지입니다');
    const batch = fs.writeBatch(db);
    demo.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  },

  async clearAll(uid) {
    // 계정 삭제는 TODO (Cloud Functions 에서 하위 컬렉션까지 삭제)
    throw new Error('Firebase 모드에서는 전체 삭제를 지원하지 않습니다 (TODO)');
  },
};
