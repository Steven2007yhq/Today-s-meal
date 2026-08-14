import { useState } from 'react'
import { CalendarDays, Check, ChevronRight, Dumbbell, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { ModalShell } from './ModalShell'
import {
  FITNESS_TRAINING_TYPES,
  FITNESS_WEEK_DAYS,
  addFitnessTrainingSession,
  getFitnessWeekdayIndex,
  getTrainingType,
  normalizeFitnessTrainingPlan,
  removeFitnessTrainingSession,
  resolveFitnessTraining,
  toggleFitnessTrainingType,
  updateFitnessTrainingSession,
} from '../data/trainingPlan'

export function FitnessTrainingPlanner({ plan, onChange, onEdit, onAskAssistant }) {
  const todayIndex = getFitnessWeekdayIndex()
  const today = resolveFitnessTraining(plan)

  function chooseType(typeId) {
    if (typeId === 'custom') {
      onEdit()
      return
    }
    onChange(toggleFitnessTrainingType(plan, todayIndex, typeId))
  }

  return (
    <section className="module-spotlight fitness-focus">
      <div className="fitness-spotlight-head">
        <div className="spotlight-title"><span><Dumbbell size={17} /></span><div><strong>高级教练训练窗</strong><small>今天：{today.isRestDay ? '休息恢复' : `${today.sessions.length} 项 · 共 ${today.totalDurationMinutes} 分钟`}</small></div></div>
        <div className="fitness-spotlight-actions">
          <button onClick={onEdit}><CalendarDays size={14} /> 编辑本周</button>
          <button className="ask" onClick={onAskAssistant}><Sparkles size={14} /> 问小饭</button>
        </div>
      </div>
      <div className="coach-track" aria-label="添加或移除今天的训练项目">
        {FITNESS_TRAINING_TYPES.map((item) => {
          const activeSession = today.sessions.find((session) => session.typeId === item.id)
          const isActive = Boolean(activeSession)
          return (
            <button key={item.id} className={isActive ? 'active' : ''} onClick={() => chooseType(item.id)} aria-pressed={isActive} title={isActive && item.id !== 'rest' ? `点击从今天移除${item.name}` : `点击加入今天的${item.name}`}>
              <span>{item.icon}</span>
              <div><small>{isActive ? '今天已安排' : item.group}</small><strong>{item.id === 'custom' && activeSession ? activeSession.displayName : item.name}</strong><em>{activeSession ? `${activeSession.durationMinutes || 0} 分钟 · ${activeSession.intensity}强度` : item.nutrition}</em></div>
              {isActive ? <Check size={15} /> : <ChevronRight size={15} />}
            </button>
          )
        })}
      </div>
    </section>
  )
}

export function FitnessPlanModal({ plan, onClose, onSave }) {
  const [draft, setDraft] = useState(() => normalizeFitnessTrainingPlan(plan))

  function updateSession(dayIndex, sessionId, patch) {
    setDraft((current) => updateFitnessTrainingSession(current, dayIndex, sessionId, patch))
  }

  function addSession(dayIndex) {
    setDraft((current) => addFitnessTrainingSession(current, dayIndex, 'push'))
  }

  function removeSession(dayIndex, sessionId) {
    setDraft((current) => removeFitnessTrainingSession(current, dayIndex, sessionId))
  }

  return (
    <ModalShell onClose={onClose} className="fitness-plan-modal">
      <button className="modal-close" onClick={onClose}><X size={20} /></button>
      <span className="modal-eyebrow">WEEKLY TRAINING PLAN</span>
      <h2>把这一周怎么练，告诉小饭</h2>
      <p className="modal-lead">每天可以安排多个训练项目；小饭会综合总时长和每段强度调整能量、蛋白质、碳水与补水建议。</p>
      <div className="fitness-week-editor">
        {draft.days.map((day, dayIndex) => {
          const isToday = dayIndex === getFitnessWeekdayIndex()
          const totalMinutes = day.sessions.reduce((sum, session) => sum + session.durationMinutes, 0)
          return (
            <article key={day.label} className={isToday ? 'today' : ''}>
              <header className="fitness-day-header">
                <div className="fitness-day-label"><span>{FITNESS_WEEK_DAYS[dayIndex]}</span>{isToday && <small>今天</small>}<em>{day.sessions.length} 项 · {totalMinutes} 分钟</em></div>
                <button type="button" onClick={() => addSession(dayIndex)} disabled={day.sessions.length >= 6}><Plus size={14} /> 添加训练项目</button>
              </header>
              <div className="fitness-session-list">
                {day.sessions.map((session, sessionIndex) => {
                  const type = getTrainingType(session.typeId)
                  return (
                    <div className="fitness-session-row" key={session.id}>
                      <span className="session-order">{sessionIndex + 1}</span>
                      <div className="fitness-type-editor">
                        <label><span>训练类型</span><select value={session.typeId} onChange={(event) => updateSession(dayIndex, session.id, { typeId: event.target.value })}>{FITNESS_TRAINING_TYPES.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}</select></label>
                        {type.id === 'custom' && <label className="custom-training-name"><span>自定义名称</span><input value={session.customName} maxLength={24} placeholder="例如：攀岩抱石" onChange={(event) => updateSession(dayIndex, session.id, { customName: event.target.value })} /></label>}
                      </div>
                      <label><span>时长</span><div className="duration-input"><input type="number" min="10" max="240" step="5" disabled={type.id === 'rest'} value={session.durationMinutes} onChange={(event) => updateSession(dayIndex, session.id, { durationMinutes: event.target.value })} /><em>分钟</em></div></label>
                      <label><span>强度</span><select value={session.intensity} disabled={type.id === 'rest'} onChange={(event) => updateSession(dayIndex, session.id, { intensity: event.target.value })}><option value="低">低</option><option value="中等">中等</option><option value="高">高</option></select></label>
                      <button type="button" className="remove-session" onClick={() => removeSession(dayIndex, session.id)} aria-label={`删除${day.label}第 ${sessionIndex + 1} 项训练`} title="删除这项训练"><Trash2 size={15} /></button>
                    </div>
                  )
                })}
              </div>
            </article>
          )
        })}
      </div>
      <div className="fitness-ai-note"><Sparkles size={16} /><span><strong>保存后小饭 AI 会自动使用完整训练清单</strong><small>建议会结合当天总训练量、各段强度和当前三餐；不替代教练或医疗意见。</small></span></div>
      <div className="modal-actions"><button className="soft-button" onClick={onClose}>暂不修改</button><button className="primary-button" onClick={() => onSave(draft)}><Check size={17} /> 保存训练计划</button></div>
    </ModalShell>
  )
}
