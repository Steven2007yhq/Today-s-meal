export const initialMeals = [
  {
    type: '早餐',
    time: '07:30',
    title: '元气紫薯燕麦碗',
    description: '紫薯 100g · 燕麦 40g · 牛奶 250ml · 蓝莓一小把',
    kcal: 436,
    protein: 18,
    tag: '高纤维',
    portionMultiplier: 0.9,
    image: 'https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?auto=format&fit=crop&w=500&q=85',
    done: true,
  },
  {
    type: '午餐',
    time: '12:10',
    title: '照烧鸡腿糙米饭',
    description: '去皮鸡腿 150g · 糙米饭 180g · 西兰花 120g',
    kcal: 628,
    protein: 42,
    tag: '蛋白优选',
    portionMultiplier: 1.1,
    image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=500&q=85',
    done: false,
  },
  {
    type: '晚餐',
    time: '18:30',
    title: '番茄菌菇豆腐煲',
    description: '北豆腐 160g · 番茄 200g · 菌菇 100g · 青菜 150g',
    kcal: 492,
    protein: 27,
    tag: '清爽少盐',
    portionMultiplier: 0.95,
    image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=500&q=85',
    done: false,
  },
]

export const demoMealHistory = [
  { type: '早餐', portionMultiplier: 0.85 }, { type: '早餐', portionMultiplier: 0.92 }, { type: '早餐', portionMultiplier: 0.88 },
  { type: '午餐', portionMultiplier: 1.08 }, { type: '午餐', portionMultiplier: 1.15 }, { type: '午餐', portionMultiplier: 1.04 },
  { type: '晚餐', portionMultiplier: 0.9 }, { type: '晚餐', portionMultiplier: 0.96 }, { type: '晚餐', portionMultiplier: 0.92 },
]

export const weekPlan = [
  ['周一', '紫薯燕麦碗', '照烧鸡腿饭', '番茄豆腐煲'],
  ['周二', '鸡蛋蔬菜饼', '番茄牛腩面', '虾仁冬瓜汤'],
  ['周三', '香蕉花生吐司', '香菇滑鸡饭', '清蒸鲈鱼套餐'],
  ['周四', '玉米豆浆套餐', '黑椒牛柳饭', '菌菇荞麦面'],
  ['周五', '酸奶坚果杯', '三文鱼杂粮碗', '山药排骨汤'],
  ['周六', '鲜肉小馄饨', '家庭缤纷火锅', '轻食水果拼盘'],
  ['周日', '全麦鸡蛋卷', '板栗焖鸡套餐', '南瓜小米粥'],
]

export const mealSlots = [
  { type: '早餐', time: '07:30', kcal: 430, protein: 18 },
  { type: '午餐', time: '12:10', kcal: 620, protein: 38 },
  { type: '晚餐', time: '18:30', kcal: 490, protein: 27 },
]
