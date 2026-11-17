// 저장소 앞에 계약 변환을 한 겹 씌운다(계약 v1 C-3, 2-1).
// - 쓸 때: 화면 상태 -> toRecordDoc / mergeForUpdate -> 계약 모양(snake_case)으로 저장
// - 읽을 때: 계약 모양이든 옛 모양이든 fromRecordDoc -> 화면 상태(camelCase)
// 화면(app.js), 에이전트(agent.js), 엑셀(excel.js)은 지금처럼 화면 상태만 다룬다.
// "못 바꿈" 값(원문, 추출 방식, 작성자, 처음 저장 시각 등)은 수정 때 mergeForUpdate가 지킨다.

import { toRecordDoc, fromRecordDoc, mergeForUpdate, mixedCrops } from '../contract.js';

// 작목이 다른 동을 한 기록에 넣으면 쓰기 전에 거부한다(계약 C-6, S-7).
// 미완성 표시만으로는 부족하다(Codex 재검증 c7a7557). 이미 저장된 옛 기록은 그대로 읽힌다.
export const MIXED_CROP_MESSAGE = '작목이 다른 동은 한 기록에 넣을 수 없어요. 동별로 따로 기록해 주세요';
function rejectMixed(profile, rec) {
  if (mixedCrops(profile, rec.houseIds || rec.house_ids || [])) {
    const e = new Error(MIXED_CROP_MESSAGE);
    e.code = 'MIXED_CROPS';
    throw e;
  }
}

export function isDoc(r) {
  return !!r && 'record_id' in r && 'work_date' in r;
}

function newId() {
  return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function withContract(inner) {
  const ctxFor = async (uid) => ({ profile: await inner.getProfile(uid), uid });
  return {
    ...inner,
    name: inner.name + '+contract',
    raw: inner,

    async listRecords(uid, opts = {}) {
      return (await inner.listRecords(uid, opts)).map(fromRecordDoc);
    },

    async getRecord(uid, id) {
      return fromRecordDoc(await inner.getRecord(uid, id));
    },

    async saveRecord(uid, rec) {
      const ctx = await ctxFor(uid);
      rejectMixed(ctx.profile, rec);
      const now = new Date().toISOString();
      const old = rec.id ? await inner.getRecord(uid, rec.id) : null;
      let doc;
      if (old) {
        const oldDoc = isDoc(old) ? old : toRecordDoc(old, { ...ctx, now: old.createdAt || now });
        doc = mergeForUpdate(oldDoc, rec, { ...ctx, now });
      } else {
        doc = toRecordDoc({ ...rec, id: rec.id || newId() }, { ...ctx, now });
      }
      await inner.saveRecord(uid, doc);
      return fromRecordDoc(doc);
    },

    async saveRecordsBulk(uid, recs) {
      const ctx = await ctxFor(uid);
      recs.forEach((r) => rejectMixed(ctx.profile, r)); // 하나라도 걸리면 하나도 쓰지 않음
      const now = new Date().toISOString();
      const docs = recs.map((r) => toRecordDoc({ ...r, id: r.id || newId() }, { ...ctx, now: r.createdAt || now }));
      return inner.saveRecordsBulk(uid, docs);
    },
  };
}
