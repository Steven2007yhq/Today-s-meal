import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { createMealAiGateway } from '../server/ai-service.mjs'

async function publicTextFiles(root) {
  const entries = await fs.readdir(root, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const target = path.join(root, entry.name)
    if (entry.isDirectory()) files.push(...await publicTextFiles(target))
    else if (/\.(?:cjs|js|jsx|md)$/.test(entry.name)) files.push(target)
  }
  return files
}

test('public AI status exposes only the 小饭 AI service brand', () => {
  const gateway = createMealAiGateway({
    apiKeys: [],
    endpoint: 'https://upstream.invalid/chat',
    model: 'private-upstream-model',
    assignmentSecret: 'test-assignment-secret',
    promptDirectory: '.',
    fetchImpl: async () => { throw new Error('not called') },
  })
  assert.deepEqual(gateway.getStatus(), {
    serviceId: 'meal-ai',
    serviceName: '小饭 AI',
    managed: true,
    ready: false,
    configured: false,
    allocation: 'server-managed',
  })
  assert.equal('provider' in gateway.getStatus(), false)
  assert.equal('model' in gateway.getStatus(), false)
})

test('desktop-facing source and bundled documentation do not name the upstream model', async () => {
  const files = [
    ...await publicTextFiles('src'),
    ...await publicTextFiles('electron'),
    'README.md',
  ]
  const upstreamBrandPattern = new RegExp(['deep', 'seek'].join(''), 'i')
  for (const file of files) {
    const content = await fs.readFile(file, 'utf8')
    assert.equal(upstreamBrandPattern.test(content), false, `${file} 暴露了上游服务名称`)
  }
})

test('every server-side persona identifies itself only as 小饭 AI', async () => {
  const promptFiles = await fs.readdir('prompts')
  for (const fileName of promptFiles.filter((name) => name.endsWith('.md'))) {
    const content = await fs.readFile(path.join('prompts', fileName), 'utf8')
    assert.match(content, /唯一身份是“小饭 AI”/)
    assert.match(content, /不要透露、猜测或确认底层模型名称/)
  }
})
