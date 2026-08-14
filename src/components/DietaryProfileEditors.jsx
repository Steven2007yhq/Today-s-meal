import { Check, Plus, ShieldCheck, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import {
  createFamilyMember,
  ELDER_AGE_OPTIONS,
  ELDER_CARE_GOALS,
  ELDER_CONDITIONS,
  FAMILY_AGE_OPTIONS,
  normalizeElderProfile,
  normalizeFamilyProfile,
} from '../data/dietaryProfiles'
import { ModalShell } from './ModalShell'

const PORTION_HINTS = Object.freeze([
  { value: 0.5, label: '少量 0.5×' },
  { value: 0.7, label: '儿童 0.7×' },
  { value: 1, label: '标准 1.0×' },
  { value: 1.2, label: '偏多 1.2×' },
  { value: 1.5, label: '大份 1.5×' },
])

function toggleListValue(list, value) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

export function FamilyProfileModal({ profile, isSetup = false, onClose, onSave }) {
  const [draft, setDraft] = useState(() => normalizeFamilyProfile(profile))

  function updateMember(index, patch) {
    setDraft((current) => ({
      ...current,
      members: current.members.map((member, memberIndex) => memberIndex === index ? { ...member, ...patch } : member),
    }))
  }

  function saveProfile() {
    const normalized = normalizeFamilyProfile({ ...draft, completed: true })
    if (!normalized.members.length) return
    onSave(normalized)
  }

  return (
    <ModalShell onClose={onClose} className="family-profile-modal">
      <button className="modal-close" onClick={onClose} aria-label="关闭家庭档案"><X size={20} /></button>
      <div className="profile-editor-head family-editor-head">
        <span>👨‍👩‍👧‍👦</span>
        <div><small>FAMILY TABLE PROFILE</small><h2>{isSetup ? '先设置这张家庭餐桌' : '编辑家庭餐桌档案'}</h2><p>每位成员都能单独设置年龄段、饭量和需要避开的食物。</p></div>
      </div>

      <div className="family-member-editor-list">
        {draft.members.map((member, index) => (
          <article className="family-member-editor" key={member.id}>
            <div className="family-member-title">
              <span>{member.icon}</span>
              <label><small>称呼（无需真实姓名）</small><input value={member.role} maxLength={20} onChange={(event) => updateMember(index, { role: event.target.value })} /></label>
              <button disabled={draft.members.length === 1} onClick={() => setDraft((current) => ({ ...current, members: current.members.filter((_, memberIndex) => memberIndex !== index) }))} title="删除成员"><Trash2 size={16} /></button>
            </div>
            <div className="family-member-fields">
              <label><span>年龄段</span><select value={member.ageGroup} onChange={(event) => updateMember(index, { ageGroup: event.target.value })}>{FAMILY_AGE_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label>
              <label><span>饭量系数</span><select value={member.portionMultiplier} onChange={(event) => updateMember(index, { portionMultiplier: Number(event.target.value) })}>{PORTION_HINTS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
              <label className="wide"><span>个人忌口或过敏（可不填）</span><input value={member.foodAvoidance} maxLength={120} placeholder="例如：花生过敏、不吃香菜" onChange={(event) => updateMember(index, { foodAvoidance: event.target.value })} /></label>
            </div>
          </article>
        ))}
      </div>

      <button className="profile-add-button" disabled={draft.members.length >= 8} onClick={() => setDraft((current) => ({ ...current, members: [...current.members, createFamilyMember(current.members.length)] }))}><Plus size={16} /> 添加家庭成员{draft.members.length >= 8 ? '（最多 8 位）' : ''}</button>
      <label className="profile-wide-field"><span>全家共同需要避开的食物（可不填）</span><textarea value={draft.sharedFoodAvoidance} maxLength={180} placeholder="例如：全家少辣，晚餐不吃太油" onChange={(event) => setDraft((current) => ({ ...current, sharedFoodAvoidance: event.target.value }))} /></label>
      <div className="privacy-note"><ShieldCheck size={18} /><span>只需填写饮食相关称呼，不需要真实姓名；档案保存在当前设备，可随时修改。</span></div>
      <div className="modal-actions"><button className="soft-button" onClick={onClose}>暂不修改</button><button className="primary-button" disabled={!draft.members.length} onClick={saveProfile}><Check size={17} /> 保存家庭档案</button></div>
    </ModalShell>
  )
}
export function ElderProfileModal({ profile, onClose, onSave }) {
  const [draft, setDraft] = useState(() => normalizeElderProfile(profile))

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  function chooseDisclosure(value) {
    setDraft((current) => ({
      ...current,
      diseaseDisclosure: value,
      ...(value === 'shared' ? {} : { conditions: [], otherCondition: '' }),
    }))
  }

  return (
    <ModalShell onClose={onClose} className="elder-profile-modal">
      <button className="modal-close" onClick={onClose} aria-label="关闭健康档案"><X size={20} /></button>
      <div className="profile-editor-head elder-editor-head">
        <span>🌿</span>
        <div><small>COMFORT & DIET PROFILE</small><h2>编辑乐龄饮食档案</h2><p>只填写愿意分享的内容；所有项目以后都能单独修改。</p></div>
      </div>

      <section className="profile-editor-section">
        <div className="profile-section-title"><strong>进食习惯</strong><small>不知道或不想说都可以选“不愿透露”</small></div>
        <div className="elder-basic-fields">
          <label><span>年龄段</span><select value={draft.ageGroup} onChange={(event) => update('ageGroup', event.target.value)}>{ELDER_AGE_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label>
          <label><span>咀嚼情况</span><select value={draft.chewing} onChange={(event) => update('chewing', event.target.value)}><option value="not_disclosed">不愿透露</option><option value="normal">正常咀嚼</option><option value="soft">偏好软一点</option><option value="very_soft">需要软烂细碎</option></select></label>
          <label><span>吞咽情况</span><select value={draft.swallowing} onChange={(event) => update('swallowing', event.target.value)}><option value="not_disclosed">不愿透露</option><option value="normal">无特别需要</option><option value="needs_attention">需要特别留意</option></select></label>
        </div>
      </section>

      <section className="profile-editor-section">
        <div className="profile-section-title"><strong>希望重点照顾</strong><small>可多选，也可以一项都不选</small></div>
        <div className="profile-choice-grid care-goal-grid">{ELDER_CARE_GOALS.map((goal) => <button key={goal.id} className={draft.careGoals.includes(goal.id) ? 'selected' : ''} onClick={() => update('careGoals', toggleListValue(draft.careGoals, goal.id))}><span>{draft.careGoals.includes(goal.id) && <Check size={14} />}</span>{goal.label}</button>)}</div>
      </section>

      <section className="profile-editor-section disease-disclosure-section">
        <div className="profile-section-title"><strong>疾病史</strong><small>这是可选隐私信息，不填写不会影响其他功能</small></div>
        <div className="disclosure-options">
          <button className={draft.diseaseDisclosure === 'not_disclosed' ? 'selected' : ''} onClick={() => chooseDisclosure('not_disclosed')}><ShieldCheck size={19} /><span><strong>不愿透露</strong><small>小饭不会推断、追问或假设疾病史</small></span></button>
          <button className={draft.diseaseDisclosure === 'none_known' ? 'selected' : ''} onClick={() => chooseDisclosure('none_known')}><span className="disclosure-icon">○</span><span><strong>暂无已知相关疾病</strong><small>按目前已知情况提供一般饮食建议</small></span></button>
          <button className={draft.diseaseDisclosure === 'shared' ? 'selected' : ''} onClick={() => chooseDisclosure('shared')}><span className="disclosure-icon">＋</span><span><strong>愿意填写</strong><small>仅用于让饮食建议更有针对性</small></span></button>
        </div>
        {draft.diseaseDisclosure === 'shared' && (
          <div className="condition-editor">
            <div className="profile-choice-grid">{ELDER_CONDITIONS.map((condition) => <button key={condition.id} className={draft.conditions.includes(condition.id) ? 'selected' : ''} onClick={() => update('conditions', toggleListValue(draft.conditions, condition.id))}><span>{draft.conditions.includes(condition.id) && <Check size={14} />}</span>{condition.label}</button>)}</div>
            <label className="profile-wide-field"><span>其他情况（可不填）</span><input value={draft.otherCondition} maxLength={120} placeholder="只写愿意告诉小饭的内容" onChange={(event) => update('otherCondition', event.target.value)} /></label>
          </div>
        )}
      </section>

      <section className="profile-editor-section">
        <div className="profile-section-title"><strong>其他饮食信息</strong><small>均为可选项</small></div>
        <div className="elder-notes-grid">
          <label className="profile-wide-field"><span>忌口、过敏或不喜欢的食物</span><textarea value={draft.foodAvoidance} maxLength={160} placeholder="可不填" onChange={(event) => update('foodAvoidance', event.target.value)} /></label>
          <label className="profile-wide-field"><span>与饮食有关的用药提醒</span><textarea value={draft.medicationNote} maxLength={160} placeholder="可不填；具体用药请遵医嘱" onChange={(event) => update('medicationNote', event.target.value)} /></label>
        </div>
      </section>

      <div className="privacy-note elder-privacy-note"><ShieldCheck size={18} /><span>{draft.diseaseDisclosure === 'not_disclosed' ? '已选择“不愿透露”：保存后不会向小饭发送疾病名称，也不会要求补填。' : '档案仅用于饮食建议，不作诊断，也不能替代医生或药师意见。'}</span></div>
      <div className="modal-actions"><button className="soft-button" onClick={onClose}>暂不修改</button><button className="primary-button" onClick={() => onSave(normalizeElderProfile({ ...draft, completed: true }))}><Check size={17} /> 保存健康档案</button></div>
    </ModalShell>
  )
}
