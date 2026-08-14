import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { createMealAiGateway } from '../server/ai-service.mjs'
import {
  buildElderProfileContext,
  buildFamilyProfileContext,
  createDefaultElderProfile,
  createDefaultFamilyProfile,
  normalizeElderProfile,
  normalizeFamilyProfile,
} from '../src/data/dietaryProfiles.js'

test('family profile keeps independent portions and food avoidance for every member', () => {
  const profile = normalizeFamilyProfile({
    ...createDefaultFamilyProfile(),
    completed: true,
    members: [
      { id: 'one', role: '外婆', icon: '👵🏻', ageGroup: '60 岁以上', portionMultiplier: 0.65, foodAvoidance: '花生过敏' },
      { id: 'two', role: '小朋友', icon: '🧒🏻', ageGroup: '7–12 岁', portionMultiplier: 0.8, foodAvoidance: '不吃香菜' },
    ],
    sharedFoodAvoidance: '全家少辣',
  })
  const context = buildFamilyProfileContext(profile)
  assert.equal(context.memberCount, 2)
  assert.equal(context.members[0].portionMultiplier, 0.65)
  assert.equal(context.members[0].foodAvoidance, '花生过敏')
  assert.equal(context.members[1].foodAvoidance, '不吃香菜')
  assert.equal(context.sharedFoodAvoidance, '全家少辣')
})

test('elder disease history can be explicitly withheld without retaining condition details', () => {
  const profile = normalizeElderProfile({
    ...createDefaultElderProfile(),
    completed: true,
    diseaseDisclosure: 'not_disclosed',
    conditions: ['hypertension', 'diabetes'],
    otherCondition: '不应保留的内容',
  })
  const context = buildElderProfileContext(profile)
  assert.equal(context.diseaseDisclosure, 'not_disclosed')
  assert.equal('conditions' in context, false)
  assert.equal('otherCondition' in context, false)
})

test('小饭 AI receives family settings while enforcing elder disease privacy', async () => {
  let completionRequest
  const gateway = createMealAiGateway({
    apiKeys: ['test-key'],
    endpoint: 'https://upstream.invalid/chat',
    model: 'private-upstream-model',
    assignmentSecret: 'test-assignment-secret',
    promptDirectory: path.resolve('prompts'),
    fetchImpl: async (_url, init) => {
      completionRequest = JSON.parse(init.body)
      return new Response(JSON.stringify({ choices: [{ message: { content: '可以先按已填写的进食偏好安排。' } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    },
  })

  await gateway.chat({
    module: 'elder',
    messages: [{ role: 'user', content: '疾病史不愿透露时，晚餐怎么吃？' }],
    context: {
      familyProfile: {
        members: [{ role: '外婆', ageGroup: '60 岁以上', portionMultiplier: 0.7, foodAvoidance: '花生过敏' }],
        sharedFoodAvoidance: '少辣',
      },
      elderProfile: {
        ageGroup: '不愿透露',
        chewing: 'soft',
        swallowing: 'not_disclosed',
        careGoals: ['soft-food'],
        diseaseDisclosure: 'not_disclosed',
        conditions: ['hypertension'],
        otherCondition: '不应发送',
      },
    },
  }, 'test-client-privacy')

  const liveContext = completionRequest.messages.find((message) => message.role === 'system' && message.content.includes('<elder_diet_profile'))
  assert.ok(liveContext)
  assert.match(liveContext.content, /family_diet_profile/)
  assert.match(liveContext.content, /外婆/)
  assert.match(liveContext.content, /花生过敏/)
  assert.match(liveContext.content, /用户明确选择“不愿透露”/)
  assert.doesNotMatch(liveContext.content, /高血压/)
  assert.doesNotMatch(liveContext.content, /不应发送/)
})
