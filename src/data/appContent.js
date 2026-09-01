export const quickQuestions = [
  '中午想吃点辣的，怎么搭配？',
  '帮我把今天晚餐换成素食',
  '最近三天的蛋白质够吗？',
]

export const publishedNotifications = [
  { id: 'product-launch', emoji: '🎉', title: '中华菜品库焕新', description: '5000 道传统菜、开源配方与家常搭配已可分页检索。', time: '刚刚' },
  { id: 'cloud-gallery', emoji: '🖼️', title: '菜品云端图库已更新', description: '新一批中国美食图片正在入库，找菜更有食欲。', time: '今天' },
  { id: 'weekly-report', emoji: '📊', title: '每周营养报告已生成', description: '本周膳食表现出炉，看看哪一顿最会吃。', time: '昨天' },
]

export const managedAiDefaults = Object.freeze({
  serviceId: 'meal-ai',
  serviceName: '小饭 AI',
  endpoint: '平台托管',
  managed: true,
  configured: false,
  ready: false,
  allocation: 'server-managed',
})

export const relationNodeLayout = [
  { x: 64, y: 34 }, { x: 256, y: 34 }, { x: 266, y: 105 },
  { x: 250, y: 176 }, { x: 70, y: 176 }, { x: 54, y: 105 },
]
