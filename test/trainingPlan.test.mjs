import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { createMealAiGateway } from '../server/ai-service.mjs'
import {
  buildFitnessTrainingContext,
  addFitnessTrainingSession,
  createDefaultFitnessTrainingPlan,
  normalizeFitnessTrainingPlan,
  resolveFitnessTraining,
  updateFitnessTrainingSession,
} from '../src/data/trainingPlan.js'

const friday = new Date(2026, 7, 14)

test('fitness plan supports multiple daily sessions with custom type, duration and intensity', () => {
  const initial = createDefaultFitnessTrainingPlan()
  const customized = updateFitnessTrainingSession(initial, 4, initial.days[4].sessions[0].id, {
    typeId: 'custom',
    customName: '攀岩抱石',
    durationMinutes: 95,
    intensity: '高',
  })
  const withRunning = addFitnessTrainingSession(customized, 4, 'running')
  const today = resolveFitnessTraining(withRunning, friday)
  assert.equal(today.sessions.length, 2)
  assert.equal(today.sessions[0].displayName, '攀岩抱石')
  assert.equal(today.totalDurationMinutes, 140)
  assert.equal(today.intensity, '高')
  assert.equal(buildFitnessTrainingContext(withRunning, friday).today.sessions.length, 2)
  assert.equal(buildFitnessTrainingContext(withRunning, friday).week.length, 7)
})

test('persisted training data is normalized to safe ranges', () => {
  const plan = normalizeFitnessTrainingPlan({ days: [{ typeId: 'running', durationMinutes: 999, intensity: '极限' }] })
  assert.equal(plan.version, 2)
  assert.equal(plan.days[0].sessions[0].durationMinutes, 240)
  assert.equal(plan.days[0].sessions[0].intensity, '中等')
  assert.equal(plan.days.length, 7)
})

test('fitness training context reaches 小饭 AI as authoritative live data', async () => {
  let completionRequest
  const gateway = createMealAiGateway({
    apiKeys: ['test-key'],
    endpoint: 'https://upstream.invalid/chat',
    model: 'private-upstream-model',
    assignmentSecret: 'test-assignment-secret',
    promptDirectory: path.resolve('prompts'),
    fetchImpl: async (_url, init) => {
      completionRequest = JSON.parse(init.body)
      return new Response(JSON.stringify({ choices: [{ message: { content: '训练后先补水，再安排蛋白质与碳水。' } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    },
  })

  const response = await gateway.chat({
    module: 'fitness',
    messages: [{ role: 'user', content: '今天训练后吃什么？' }],
    context: {
      currentMeals: [{ type: '晚餐', title: '鸡腿糙米饭', kcal: 620 }],
      fitnessTraining: {
        today: { day: '周五', totalDurationMinutes: 125, sessions: [
          { type: '攀岩抱石', durationMinutes: 95, intensity: '高', focus: '抓握力量与恢复' },
          { type: '跑步训练', durationMinutes: 30, intensity: '中等', focus: '耐力与补液' },
        ] },
        week: [{ day: '周五', totalDurationMinutes: 125, sessions: [
          { type: '攀岩抱石', durationMinutes: 95, intensity: '高', focus: '抓握力量与恢复' },
          { type: '跑步训练', durationMinutes: 30, intensity: '中等', focus: '耐力与补液' },
        ] }],
      },
    },
  }, 'test-client-123')

  assert.equal(response.demo, false)
  const liveContext = completionRequest.messages.find((message) => message.role === 'system' && message.content.includes('<current_training_plan'))
  assert.ok(liveContext)
  assert.match(liveContext.content, /攀岩抱石/)
  assert.match(liveContext.content, /95 分钟/)
  assert.match(liveContext.content, /跑步训练 30 分钟/)
  assert.match(liveContext.content, /全天合计 125 分钟/)
  assert.match(liveContext.content, /高强度/)
})
