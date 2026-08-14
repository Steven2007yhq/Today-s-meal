import crawledDishLibrary from './crawledDishLibrary.json'
import figureDishLibrary from './figureDishLibrary.json'
import figure2DishLibrary from './figure2DishLibrary.json'
import { seasonalDishes } from './seasonalDishLibrary.js'
import mapoImage from '../assets/dishes/mapo-doufu.jpg'
import gongbaoImage from '../assets/dishes/gongbao-jiding.jpg'
import shuizhuImage from '../assets/dishes/shuizhu-yu.jpg'
import baiqieImage from '../assets/dishes/baiqie-ji.jpg'
import fuqifeipianImage from '../assets/dishes/fuqifeipian.jpg'
import mizhichashaoImage from '../assets/dishes/mizhichashao.jpg'
import guangshiRoastPigImage from '../assets/dishes/guangshi-kaoruzhu.jpg'
import qingzhengGrouperImage from '../assets/dishes/qingzheng-shibanyu.jpg'
import congbaHaishenImage from '../assets/dishes/congba-haishen.jpg'
import jiuzhuanImage from '../assets/dishes/jiuzhuan-dachang.jpg'

export const cuisineMeta = [
  { id: 'all', name: '全部菜系', emoji: '🥢' },
  { id: '鲁菜', name: '鲁菜', emoji: '🌊' },
  { id: '川菜', name: '川菜', emoji: '🌶️' },
  { id: '粤菜', name: '粤菜', emoji: '🫖' },
  { id: '苏菜', name: '苏菜', emoji: '🎋' },
  { id: '闽菜', name: '闽菜', emoji: '🐚' },
  { id: '浙菜', name: '浙菜', emoji: '🍵' },
  { id: '湘菜', name: '湘菜', emoji: '🔥' },
  { id: '徽菜', name: '徽菜', emoji: '⛰️' },
  { id: '东北菜', name: '东北菜', emoji: '🌾' },
  { id: '家常菜', name: '家常菜', emoji: '🏠' },
  { id: '主食小吃', name: '主食小吃', emoji: '🍜' },
  { id: '节日美食', name: '节日美食', emoji: '🎊' },
  { id: '西式料理', name: '西式料理', emoji: '🍕' },
]

const curatedDishes = [
  {
    id: 'lu-jiuzhuan-dachang', name: '九转大肠', cuisine: '鲁菜', method: '红烧', taste: ['咸鲜', '酸甜'], image: jiuzhuanImage,
    ingredients: [{ name: '熟猪大肠', grams: 180 }, { name: '香菜', grams: 10 }, { name: '白糖', grams: 8 }, { name: '酱油', grams: 8 }, { name: '食用油', grams: 8 }],
    nutrition: { calories: 518, protein: 24, carbs: 18, fat: 39, fiber: 0.6, sodium: 930 }, tags: ['传统名菜', '高能量'],
  },
  {
    id: 'lu-congshao-haishen', name: '葱烧海参', cuisine: '鲁菜', method: '烧', taste: ['葱香', '咸鲜'], image: congbaHaishenImage,
    ingredients: [{ name: '水发海参', grams: 180 }, { name: '大葱', grams: 60 }, { name: '高汤', grams: 80 }, { name: '酱油', grams: 8 }, { name: '食用油', grams: 10 }],
    nutrition: { calories: 286, protein: 27, carbs: 13, fat: 14, fiber: 1.2, sodium: 760 }, tags: ['高蛋白', '宴客菜'],
  },
  {
    id: 'chuan-gongbao-jiding', name: '宫保鸡丁', cuisine: '川菜', method: '爆炒', taste: ['糊辣', '酸甜'], image: gongbaoImage,
    ingredients: [{ name: '鸡胸肉', grams: 160 }, { name: '花生米', grams: 25 }, { name: '黄瓜', grams: 60 }, { name: '干辣椒', grams: 8 }, { name: '食用油', grams: 12 }, { name: '酱油', grams: 8 }],
    nutrition: { calories: 463, protein: 42, carbs: 22, fat: 24, fiber: 3.1, sodium: 820 }, tags: ['高蛋白', '下饭'],
  },
  {
    id: 'chuan-mapo-doufu', name: '麻婆豆腐', cuisine: '川菜', method: '烧', taste: ['麻辣', '咸鲜'], image: mapoImage,
    ingredients: [{ name: '北豆腐', grams: 250 }, { name: '牛肉末', grams: 50 }, { name: '豆瓣酱', grams: 15 }, { name: '花椒', grams: 2 }, { name: '食用油', grams: 10 }],
    nutrition: { calories: 428, protein: 31, carbs: 18, fat: 27, fiber: 3.9, sodium: 990 }, tags: ['豆制品', '补钙'],
  },
  {
    id: 'yue-baiqie-ji', name: '白切鸡', cuisine: '粤菜', method: '浸煮', taste: ['清鲜', '姜葱'], image: baiqieImage,
    ingredients: [{ name: '三黄鸡', grams: 220 }, { name: '生姜', grams: 12 }, { name: '小葱', grams: 15 }, { name: '芝麻油', grams: 5 }, { name: '生抽', grams: 8 }],
    nutrition: { calories: 396, protein: 48, carbs: 5, fat: 21, fiber: 0.5, sodium: 650 }, tags: ['高蛋白', '少油'],
  },
  {
    id: 'yue-qingzheng-luyu', name: '清蒸鲈鱼', cuisine: '粤菜', method: '清蒸', taste: ['鲜香', '清淡'], image: 'https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?auto=format&fit=crop&w=700&q=84',
    ingredients: [{ name: '鲈鱼', grams: 260 }, { name: '大葱', grams: 20 }, { name: '生姜', grams: 12 }, { name: '蒸鱼豉油', grams: 10 }, { name: '食用油', grams: 5 }],
    nutrition: { calories: 315, protein: 51, carbs: 5, fat: 11, fiber: 0.6, sodium: 690 }, tags: ['高蛋白', '低脂'],
  },
  {
    id: 'su-songshu-guiyu', name: '松鼠鳜鱼', cuisine: '苏菜', method: '油炸浇汁', taste: ['酸甜', '酥香'], image: 'https://images.unsplash.com/photo-1574484284002-952d92456975?auto=format&fit=crop&w=700&q=84',
    ingredients: [{ name: '鳜鱼', grams: 260 }, { name: '番茄酱', grams: 35 }, { name: '青豆', grams: 20 }, { name: '淀粉', grams: 30 }, { name: '食用油', grams: 24 }],
    nutrition: { calories: 612, protein: 45, carbs: 47, fat: 28, fiber: 2.6, sodium: 720 }, tags: ['宴客菜', '酸甜'],
  },
  {
    id: 'su-yanshui-ya', name: '南京盐水鸭', cuisine: '苏菜', method: '盐卤', taste: ['咸鲜', '清香'], image: 'https://images.unsplash.com/photo-1518492104633-130d0cc84637?auto=format&fit=crop&w=700&q=84',
    ingredients: [{ name: '鸭腿肉', grams: 220 }, { name: '生姜', grams: 12 }, { name: '花椒', grams: 2 }, { name: '食盐', grams: 3 }, { name: '八角', grams: 1 }],
    nutrition: { calories: 487, protein: 39, carbs: 4, fat: 35, fiber: 0.4, sodium: 1180 }, tags: ['地方名菜', '高蛋白'],
  },
  {
    id: 'min-fotiaoqiang', name: '佛跳墙', cuisine: '闽菜', method: '煨', taste: ['浓鲜', '醇厚'], image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=700&q=84',
    ingredients: [{ name: '水发海参', grams: 70 }, { name: '鲍鱼', grams: 70 }, { name: '鸡肉', grams: 90 }, { name: '香菇', grams: 40 }, { name: '高汤', grams: 160 }],
    nutrition: { calories: 524, protein: 58, carbs: 20, fat: 23, fiber: 2.4, sodium: 1080 }, tags: ['高蛋白', '宴席'],
  },
  {
    id: 'min-lizhi-rou', name: '荔枝肉', cuisine: '闽菜', method: '炸熘', taste: ['酸甜', '蒜香'], image: 'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?auto=format&fit=crop&w=700&q=84',
    ingredients: [{ name: '猪里脊', grams: 180 }, { name: '荸荠', grams: 60 }, { name: '番茄酱', grams: 30 }, { name: '淀粉', grams: 25 }, { name: '食用油', grams: 18 }],
    nutrition: { calories: 559, protein: 38, carbs: 51, fat: 22, fiber: 3.2, sodium: 650 }, tags: ['酸甜', '下饭'],
  },
  {
    id: 'zhe-xihu-cuyu', name: '西湖醋鱼', cuisine: '浙菜', method: '汆煮', taste: ['酸甜', '鲜嫩'], image: 'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=700&q=84',
    ingredients: [{ name: '草鱼', grams: 280 }, { name: '香醋', grams: 25 }, { name: '白糖', grams: 18 }, { name: '酱油', grams: 8 }, { name: '生姜', grams: 10 }],
    nutrition: { calories: 383, protein: 49, carbs: 25, fat: 10, fiber: 0.5, sodium: 780 }, tags: ['少油', '高蛋白'],
  },
  {
    id: 'zhe-longjing-xiaren', name: '龙井虾仁', cuisine: '浙菜', method: '滑炒', taste: ['清鲜', '茶香'], image: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=700&q=84',
    ingredients: [{ name: '河虾仁', grams: 200 }, { name: '龙井茶叶', grams: 4 }, { name: '蛋清', grams: 20 }, { name: '淀粉', grams: 6 }, { name: '食用油', grams: 9 }],
    nutrition: { calories: 326, protein: 43, carbs: 13, fat: 11, fiber: 0.4, sodium: 520 }, tags: ['低脂', '清鲜'],
  },
  {
    id: 'xiang-duojiao-yutou', name: '剁椒鱼头', cuisine: '湘菜', method: '蒸', taste: ['鲜辣', '咸香'], image: 'https://images.unsplash.com/photo-1625944525533-473f1a3d54e7?auto=format&fit=crop&w=700&q=84',
    ingredients: [{ name: '胖头鱼头', grams: 320 }, { name: '剁椒', grams: 45 }, { name: '生姜', grams: 15 }, { name: '大蒜', grams: 12 }, { name: '食用油', grams: 10 }],
    nutrition: { calories: 447, protein: 52, carbs: 12, fat: 22, fiber: 1.8, sodium: 1260 }, tags: ['高蛋白', '鲜辣'],
  },
  {
    id: 'xiang-xiaochao-huangniu', name: '小炒黄牛肉', cuisine: '湘菜', method: '爆炒', taste: ['香辣', '鲜嫩'], image: 'https://images.unsplash.com/photo-1603360946369-dc9bb6258143?auto=format&fit=crop&w=700&q=84',
    ingredients: [{ name: '黄牛肉', grams: 180 }, { name: '香菜', grams: 35 }, { name: '小米辣', grams: 16 }, { name: '大蒜', grams: 12 }, { name: '食用油', grams: 12 }],
    nutrition: { calories: 421, protein: 45, carbs: 12, fat: 22, fiber: 2.2, sodium: 720 }, tags: ['高蛋白', '香辣'],
  },
  {
    id: 'hui-chou-guiyu', name: '臭鳜鱼', cuisine: '徽菜', method: '红烧', taste: ['发酵鲜', '咸香'], image: 'https://images.unsplash.com/photo-1616501268209-edfff098fdd2?auto=format&fit=crop&w=700&q=84',
    ingredients: [{ name: '腌鳜鱼', grams: 280 }, { name: '五花肉', grams: 35 }, { name: '笋片', grams: 50 }, { name: '酱油', grams: 10 }, { name: '食用油', grams: 8 }],
    nutrition: { calories: 496, protein: 51, carbs: 10, fat: 28, fiber: 1.7, sodium: 1380 }, tags: ['发酵风味', '地方名菜'],
  },
  {
    id: 'hui-mao-doufu', name: '徽州毛豆腐', cuisine: '徽菜', method: '煎烧', taste: ['发酵鲜', '香辣'], image: 'https://images.unsplash.com/photo-1582454235987-1e597bafcf58?auto=format&fit=crop&w=700&q=84',
    ingredients: [{ name: '毛豆腐', grams: 220 }, { name: '青蒜', grams: 25 }, { name: '辣椒酱', grams: 12 }, { name: '酱油', grams: 6 }, { name: '食用油', grams: 10 }],
    nutrition: { calories: 376, protein: 28, carbs: 19, fat: 24, fiber: 3.8, sodium: 760 }, tags: ['豆制品', '发酵风味'],
  },
  {
    id: 'chuan-shuizhu-yu', name: '水煮鱼', cuisine: '川菜', method: '水煮', taste: ['麻辣', '鲜香'], image: shuizhuImage,
    ingredients: [{ name: '黑鱼片', grams: 260 }, { name: '黄豆芽', grams: 100 }, { name: '干辣椒', grams: 18 }, { name: '花椒', grams: 4 }, { name: '食用油', grams: 28 }],
    nutrition: { calories: 536, protein: 50, carbs: 18, fat: 31, fiber: 3.2, sodium: 1080 }, tags: ['高蛋白', '重口味'],
  },
  {
    id: 'chuan-fuqifeipian', name: '夫妻肺片', cuisine: '川菜', method: '卤拌', taste: ['麻辣', '鲜香'], image: fuqifeipianImage,
    ingredients: [{ name: '牛腱肉', grams: 90 }, { name: '牛肚', grams: 70 }, { name: '牛舌', grams: 50 }, { name: '红油', grams: 18 }, { name: '花生碎', grams: 10 }],
    nutrition: { calories: 468, protein: 41, carbs: 9, fat: 30, fiber: 1.4, sodium: 1010 }, tags: ['凉菜', '高蛋白'],
  },
  {
    id: 'yue-mizhichashao', name: '蜜汁叉烧', cuisine: '粤菜', method: '烧烤', taste: ['咸甜', '酱香'], image: mizhichashaoImage,
    ingredients: [{ name: '猪里脊', grams: 220 }, { name: '蜂蜜', grams: 18 }, { name: '叉烧酱', grams: 22 }, { name: '生抽', grams: 8 }, { name: '麦芽糖', grams: 10 }],
    nutrition: { calories: 562, protein: 42, carbs: 32, fat: 29, fiber: 0.5, sodium: 840 }, tags: ['烧味', '下饭'],
  },
  {
    id: 'yue-guangshi-kaoruzhu', name: '广式烤乳猪', cuisine: '粤菜', method: '挂炉烤', taste: ['酥香', '咸鲜'], image: guangshiRoastPigImage,
    ingredients: [{ name: '乳猪肉', grams: 220 }, { name: '五香粉', grams: 3 }, { name: '白醋', grams: 12 }, { name: '麦芽糖', grams: 8 }, { name: '食用油', grams: 5 }],
    nutrition: { calories: 641, protein: 36, carbs: 11, fat: 49, fiber: 0.3, sodium: 790 }, tags: ['宴客菜', '烧味'],
  },
  {
    id: 'yue-qingzheng-shibanyu', name: '清蒸石斑鱼', cuisine: '粤菜', method: '清蒸', taste: ['清鲜', '嫩滑'], image: qingzhengGrouperImage,
    ingredients: [{ name: '石斑鱼', grams: 280 }, { name: '大葱', grams: 20 }, { name: '生姜', grams: 12 }, { name: '蒸鱼豉油', grams: 10 }, { name: '食用油', grams: 5 }],
    nutrition: { calories: 338, protein: 56, carbs: 5, fat: 12, fiber: 0.5, sodium: 670 }, tags: ['低脂', '高蛋白'],
  },
]

const figureDishes = [
  ...Object.values(figureDishLibrary.dishHash || {}),
  ...Object.values(figure2DishLibrary.dishHash || {}),
]
const figureByName = new Map(figureDishes.map((dish) => [dish.name, dish]))
const mergedCuratedDishes = curatedDishes.map((dish) => {
  const figureDish = figureByName.get(dish.name)
  return figureDish ? { ...figureDish, ...dish, id: figureDish.id, source: 'curated+figure' } : dish
})
const mergedSeasonalDishes = seasonalDishes.map((dish) => {
  const figureDish = figureByName.get(dish.name)
  return figureDish ? { ...figureDish, ...dish, id: dish.id, source: 'seasonal+figure' } : dish
})
const knownNames = new Set([...mergedCuratedDishes, ...mergedSeasonalDishes].map((dish) => dish.name))
const mergedDishes = [
  ...mergedCuratedDishes,
  ...mergedSeasonalDishes,
  ...figureDishes.filter((dish) => !knownNames.has(dish.name)),
  ...Object.values(crawledDishLibrary.dishHash || {}).filter((dish) => !knownNames.has(dish.name)),
]

export const dishes = [...new Map(mergedDishes.map((dish) => [dish.name, dish])).values()]

export const dishById = new Map(dishes.map((dish) => [dish.id, dish]))
export const dishByName = new Map(dishes.map((dish) => [dish.name, dish]))
