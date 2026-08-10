import { Component, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  Apple,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Beef,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Dumbbell,
  FileDown,
  Flame,
  Heart,
  Home,
  Leaf,
  LockKeyhole,
  MessageCircleMore,
  Minus,
  MoreHorizontal,
  PencilLine,
  PieChart,
  Plus,
  Search,
  Send,
  Settings,
  Share2,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  UserRound,
  UsersRound,
  Utensils,
  WalletCards,
  Wheat,
  X,
  Zap,
} from 'lucide-react'
import { cuisineMeta, dishes } from './data/dishLibrary'
import { useFavoriteCatalog } from './hooks/useFavoriteCatalog'
import { usePreloadedImages } from './hooks/usePreloadedImages'
import { analyzeDishQuery, calculateDishPortion, getDishGraphStats, getRelatedDishes, searchDishes } from './services/dishEngine'
import { loginAccount, logoutAccount, readCurrentAuthSession, registerAccount, sendVerificationCode, startSocialLogin } from './services/authApi'
import { readDemoAccount } from './services/session'
import { fetchDishImages } from './services/imageApi'
import { exportRecipeToPdf, exportWeeklyPlanToPdf } from './services/pdfExport'
import { formatChinaHeader, getChinaToday } from './utils/chinaTime'

const modules = [
  {
    id: 'standard',
    name: '日常模式',
    subtitle: '一日三餐，稳稳拿捏',
    icon: Utensils,
    color: '#e96f45',
    pale: '#fff0e8',
    emoji: '🍳',
  },
  {
    id: 'family',
    name: '家庭餐桌',
    subtitle: '一家人的胃，我全都懂',
    icon: UsersRound,
    color: '#db8d27',
    pale: '#fff4d9',
    emoji: '👨‍👩‍👧‍👦',
    pro: true,
  },
  {
    id: 'elder',
    name: '乐龄养护',
    subtitle: '吃得舒心，日子更轻盈',
    icon: Heart,
    color: '#2e9e83',
    pale: '#e5f5ed',
    emoji: '🌿',
    pro: true,
  },
  {
    id: 'fitness',
    name: '燃力健身',
    subtitle: '每一口都算在好身材里',
    icon: Dumbbell,
    color: '#5067d9',
    pale: '#e9edff',
    emoji: '💪',
    pro: true,
  },
]

const initialMeals = [
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

const demoMealHistory = [
  { type: '早餐', portionMultiplier: 0.85 }, { type: '早餐', portionMultiplier: 0.92 }, { type: '早餐', portionMultiplier: 0.88 },
  { type: '午餐', portionMultiplier: 1.08 }, { type: '午餐', portionMultiplier: 1.15 }, { type: '午餐', portionMultiplier: 1.04 },
  { type: '晚餐', portionMultiplier: 0.9 }, { type: '晚餐', portionMultiplier: 0.96 }, { type: '晚餐', portionMultiplier: 0.92 },
]

const weekPlan = [
  ['周一', '紫薯燕麦碗', '照烧鸡腿饭', '番茄豆腐煲'],
  ['周二', '鸡蛋蔬菜饼', '番茄牛腩面', '虾仁冬瓜汤'],
  ['周三', '香蕉花生吐司', '香菇滑鸡饭', '清蒸鲈鱼套餐'],
  ['周四', '玉米豆浆套餐', '黑椒牛柳饭', '菌菇荞麦面'],
  ['周五', '酸奶坚果杯', '三文鱼杂粮碗', '山药排骨汤'],
  ['周六', '鲜肉小馄饨', '家庭缤纷火锅', '轻食水果拼盘'],
  ['周日', '全麦鸡蛋卷', '板栗焖鸡套餐', '南瓜小米粥'],
]

const quickQuestions = [
  '中午想吃点辣的，怎么搭配？',
  '帮我把今天晚餐换成素食',
  '最近三天的蛋白质够吗？',
]

const publishedNotifications = [
  { id: 'product-launch', emoji: '🎉', title: '新产品上线啦', description: '餐食日历和八大菜系库已经焕新，快来安排下一顿。', time: '刚刚' },
  { id: 'cloud-gallery', emoji: '🖼️', title: '菜品云端图库已更新', description: '新一批中国美食图片正在入库，找菜更有食欲。', time: '今天' },
  { id: 'weekly-report', emoji: '📊', title: '每周营养报告已生成', description: '本周膳食表现出炉，看看哪一顿最会吃。', time: '昨天' },
]

const managedAiDefaults = {
  provider: 'deepseek',
  providerName: 'DeepSeek',
  model: 'deepseek-chat',
  endpoint: '平台托管',
  managed: true,
  configured: false,
  ready: false,
  allocation: 'server-managed',
}

const relationNodeLayout = [
  { x: 64, y: 34 }, { x: 256, y: 34 }, { x: 266, y: 105 },
  { x: 250, y: 176 }, { x: 70, y: 176 }, { x: 54, y: 105 },
]

const mealSlots = [
  { type: '早餐', time: '07:30', kcal: 430, protein: 18 },
  { type: '午餐', time: '12:10', kcal: 620, protein: 38 },
  { type: '晚餐', time: '18:30', kcal: 490, protein: 27 },
]

function sameCalendarDate(firstDate, secondDate) {
  return firstDate.getFullYear() === secondDate.getFullYear()
    && firstDate.getMonth() === secondDate.getMonth()
    && firstDate.getDate() === secondDate.getDate()
}

function buildMonthCells(monthDate) {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const mondayBasedOffset = (new Date(year, month, 1).getDay() + 6) % 7
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(year, month, index - mondayBasedOffset + 1)
    return { date, currentMonth: date.getMonth() === month }
  })
}

function calendarDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateFromCalendarKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function mealsForCalendarDate(date, meals, calendarMealsByDate = {}) {
  if (sameCalendarDate(date, getChinaToday())) return meals
  const dateKey = calendarDateKey(date)
  if (Array.isArray(calendarMealsByDate[dateKey])) return calendarMealsByDate[dateKey]
  const mondayBasedDay = (date.getDay() + 6) % 7
  return weekPlan[mondayBasedDay].slice(1).map((title, index) => ({
    ...mealSlots[index],
    calendarId: `${dateKey}-${index}`,
    title,
    description: '由循环食谱自动安排，可点击继续调整食材与用量。',
    tag: '循环食谱',
    image: initialMeals[index]?.image,
    done: false,
    portionMultiplier: 1,
  }))
}

function App() {
  const [activeModule, setActiveModule] = useState('standard')
  const [activePage, setActivePage] = useState('today')
  const [meals, setMeals] = useState(initialMeals)
  const [showAssistant, setShowAssistant] = useState(false)
  const [showMembership, setShowMembership] = useState(false)
  const [showFamilySetup, setShowFamilySetup] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settingsInitialSection, setSettingsInitialSection] = useState('account')
  const [showShare, setShowShare] = useState(false)
  const [searchFocusRequest, setSearchFocusRequest] = useState(0)
  const [editingMeal, setEditingMeal] = useState(null)
  const [editingDateKey, setEditingDateKey] = useState(null)
  const [pendingModule, setPendingModule] = useState(null)
  const [isPro, setIsPro] = useState(false)
  const [toast, setToast] = useState('')
  const [account, setAccount] = useState(() => readDemoAccount())
  const [familyReady, setFamilyReady] = useState(false)
  const tabNavigationRef = useRef(false)
  const [mealHistory, setMealHistory] = useState(() => {
    try {
      const savedHistory = JSON.parse(window.localStorage.getItem('mealHistory'))
      return Array.isArray(savedHistory) && savedHistory.length ? savedHistory : demoMealHistory
    } catch {
      return demoMealHistory
    }
  })
  const [calendarMealsByDate, setCalendarMealsByDate] = useState(() => {
    try {
      const savedMeals = JSON.parse(window.localStorage.getItem('calendarMealsByDate'))
      return savedMeals && typeof savedMeals === 'object' && !Array.isArray(savedMeals) ? savedMeals : {}
    } catch {
      return {}
    }
  })

  const selectedModule = modules.find((item) => item.id === activeModule)

  function openSearch() {
    setActivePage('library')
    setSearchFocusRequest((current) => current + 1)
  }

  useEffect(() => {
    function handleSearchShortcut(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        openSearch()
      }
    }

    window.addEventListener('keydown', handleSearchShortcut)
    return () => window.removeEventListener('keydown', handleSearchShortcut)
  }, [])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    let active = true
    readCurrentAuthSession().then((payload) => {
      if (active && payload?.user) setAccount(payload.user)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    window.localStorage.setItem('mealHistory', JSON.stringify(mealHistory.slice(-180)))
  }, [mealHistory])

  useEffect(() => {
    window.localStorage.setItem('calendarMealsByDate', JSON.stringify(calendarMealsByDate))
  }, [calendarMealsByDate])

  useEffect(() => {
    function trackKeyboardNavigation(event) {
      if (event.key === 'Tab') tabNavigationRef.current = true
    }
    function resetKeyboardNavigation(event) {
      if (event.key === 'Tab') tabNavigationRef.current = false
    }
    function resetForPointer() {
      tabNavigationRef.current = false
    }

    window.addEventListener('keydown', trackKeyboardNavigation)
    window.addEventListener('keyup', resetKeyboardNavigation)
    window.addEventListener('pointerdown', resetForPointer)
    return () => {
      window.removeEventListener('keydown', trackKeyboardNavigation)
      window.removeEventListener('keyup', resetKeyboardNavigation)
      window.removeEventListener('pointerdown', resetForPointer)
    }
  }, [])

  function handleFieldFocusCapture(event) {
    if (!tabNavigationRef.current || !event.target.matches?.('input, textarea')) return
    const field = event.target
    window.requestAnimationFrame(() => {
      try {
        field.select()
      } catch {}
    })
  }

  function chooseModule(moduleItem) {
    if (moduleItem.pro && !isPro) {
      setPendingModule(moduleItem.id)
      setShowMembership(true)
      return
    }
    if (moduleItem.id === 'family' && !familyReady) {
      setPendingModule('family')
      setShowFamilySetup(true)
      return
    }
    setActiveModule(moduleItem.id)
    setActivePage('today')
  }

  function activateTrial() {
    setIsPro(true)
    setShowMembership(false)
    const target = pendingModule || 'family'
    setPendingModule(null)
    if (target === 'family' && !familyReady) {
      setShowFamilySetup(true)
    } else {
      setActiveModule(target)
      setActivePage('today')
      setToast('Pro 体验已开启，去解锁更懂你的菜单吧！')
    }
  }

  function finishFamilySetup() {
    setFamilyReady(true)
    setShowFamilySetup(false)
    setActiveModule('family')
    setActivePage('today')
    setToast('全家档案已就位，开饭这事交给我！')
  }

  function handleAuthenticated(payload) {
    if (payload?.user) setAccount(payload.user)
    setShowLogin(false)
    setToast('登录成功，今天也要记得吃早餐！')
  }

  async function handleLogout() {
    try {
      await logoutAccount()
      setAccount(null)
      setToast('已退出登录，下次见，饭友。')
    } catch {
      setToast('退出登录失败，请稍后再试。')
    }
  }

  function addDishToMeal(dish, mealType = '午餐') {
    if (!dish) return
    const portion = calculateDishPortion(dish, mealHistory, mealType)
    const ingredientText = portion.ingredients.map((item) => `${item.name} ${item.grams}g`).join(' · ')
    setMeals((current) => [...current, {
      type: mealType,
      time: mealType === '早餐' ? '07:30' : mealType === '午餐' ? '12:10' : '18:30',
      title: dish.name,
      description: ingredientText,
      kcal: portion.nutrition.calories,
      protein: portion.nutrition.protein,
      tag: `${dish.cuisine} · ${dish.method}`,
      image: dish.image,
      done: false,
      dishId: dish.id,
      portionMultiplier: portion.multiplier,
    }])
    setActivePage('today')
    setToast(`${dish.name}已按你的历史饭量换算，加入${mealType}。`)
  }

  function toggleMealDone(index) {
    const targetMeal = meals[index]
    if (targetMeal && !targetMeal.done) {
      setMealHistory((current) => [...current, { ...targetMeal, recordedAt: new Date().toISOString(), portionMultiplier: targetMeal.portionMultiplier || 1 }])
    }
    setMeals((current) => current.map((meal, mealIndex) => (
      mealIndex === index ? { ...meal, done: !meal.done } : meal
    )))
  }

  function openTodayMealEditor(meal) {
    setEditingDateKey(null)
    setEditingMeal(meal)
  }

  function openCalendarMealEditor(meal, date) {
    setEditingDateKey(calendarDateKey(date))
    setEditingMeal(meal)
  }

  function closeMealEditor() {
    setEditingMeal(null)
    setEditingDateKey(null)
  }

  const mainContent = activePage === 'today' ? (
    <TodayView
      module={selectedModule}
      meals={meals}
      onEdit={openTodayMealEditor}
      onToggleDone={toggleMealDone}
      onOpenAssistant={() => setShowAssistant(true)}
      onShare={() => setShowShare(true)}
      onNavigate={setActivePage}
      onOpenLibrary={openSearch}
    />
  ) : activePage === 'calendar' ? (
    <CalendarView meals={meals} calendarMealsByDate={calendarMealsByDate} onEdit={openCalendarMealEditor} onToast={setToast} />
  ) : activePage === 'report' ? (
    <ReportView onShare={() => setShowShare(true)} />
  ) : activePage === 'library' ? (
    <DishLibraryView
      mealHistory={mealHistory}
      focusRequest={searchFocusRequest}
      onToast={setToast}
      onUseDish={addDishToMeal}
    />
  ) : (
    <FavoritesView onToast={setToast} onUseDish={addDishToMeal} />
  )

  return (
    <div className={`app-shell theme-${activeModule}`} onFocusCapture={handleFieldFocusCapture}>
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        modules={modules}
        activeModule={activeModule}
        onChooseModule={chooseModule}
        isPro={isPro}
        onOpenMembership={() => setShowMembership(true)}
        onOpenSettings={() => { setSettingsInitialSection('account'); setShowSettings(true) }}
      />

      <main className="main-panel">
        <Topbar
          module={selectedModule}
          onProfile={() => setShowProfile(true)}
          onLogin={() => setShowLogin(true)}
          account={account}
          onLogout={handleLogout}
          onSearch={openSearch}
          onToast={setToast}
        />
        <div className="content-scroll">{mainContent}</div>
      </main>

      <button className="ai-fab" onClick={() => setShowAssistant(true)} aria-label="打开小饭 AI">
        <span className="fab-face">饭</span>
        <span className="fab-copy"><strong>问问小饭</strong><small>好吃的今天，我有主意</small></span>
        <Sparkles size={17} />
      </button>

      {showAssistant && (
        <AssistantErrorBoundary onClose={() => setShowAssistant(false)}>
          <AssistantPanel
            module={selectedModule}
            meals={meals}
            mealHistory={mealHistory}
            onClose={() => setShowAssistant(false)}
            onConfigureAi={() => { setShowAssistant(false); setSettingsInitialSection('ai'); setShowSettings(true) }}
          />
        </AssistantErrorBoundary>
      )}
      {showMembership && (
        <MembershipModal
          onClose={() => setShowMembership(false)}
          onActivate={activateTrial}
          onToast={setToast}
        />
      )}
      {showFamilySetup && (
        <FamilySetupModal onClose={() => setShowFamilySetup(false)} onFinish={finishFamilySetup} />
      )}
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onToast={setToast} onAuthenticated={handleAuthenticated} />}
      {showShare && <ShareModal onClose={() => setShowShare(false)} onToast={setToast} />}
      {showSettings && <SettingsModal account={account} initialSection={settingsInitialSection} isPro={isPro} onClose={() => setShowSettings(false)} onOpenReadme={() => { if (window.mealDesktop?.openReadme) window.mealDesktop.openReadme(); else window.open('/README.md', '_blank') }} />}
      {editingMeal && (
        <MealEditor
          meal={editingMeal}
          onClose={closeMealEditor}
          onSave={(updatedMeal) => {
            const savedMeal = { ...updatedMeal, calendarId: updatedMeal.calendarId || editingMeal.calendarId }
            if (editingDateKey && editingDateKey !== calendarDateKey(getChinaToday())) {
              setCalendarMealsByDate((current) => {
                const sourceMeals = Array.isArray(current[editingDateKey])
                  ? current[editingDateKey]
                  : mealsForCalendarDate(dateFromCalendarKey(editingDateKey), meals, current)
                const existingIndex = sourceMeals.findIndex((meal) => meal.calendarId === savedMeal.calendarId)
                const nextMeals = existingIndex >= 0
                  ? sourceMeals.map((meal, index) => index === existingIndex ? savedMeal : meal)
                  : [...sourceMeals, savedMeal]
                return { ...current, [editingDateKey]: nextMeals }
              })
            } else {
              setMeals((current) => current.includes(editingMeal)
                ? current.map((meal) => meal === editingMeal ? savedMeal : meal)
                : [...current, savedMeal])
            }
            setMealHistory((current) => [...current, { ...savedMeal, recordedAt: new Date().toISOString(), portionMultiplier: savedMeal.portionMultiplier || 1 }])
            closeMealEditor()
            setToast(`${savedMeal.type}已经重新安排，稳！`)
          }}
        />
      )}

      {toast && <div className="toast"><CheckCircle2 size={18} />{toast}</div>}
    </div>
  )
}

function Sidebar({ activePage, onNavigate, modules: moduleItems, activeModule, onChooseModule, isPro, onOpenMembership, onOpenSettings }) {
  const primaryNav = [
    { id: 'today', label: '好吃的今天', icon: Home },
    { id: 'calendar', label: '餐食日历', icon: CalendarDays },
    { id: 'library', label: '八大菜系库', icon: Search },
    { id: 'report', label: '营养报告', icon: BarChart3 },
    { id: 'favorites', label: '我的收藏', icon: Heart },
  ]

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><span>吃</span><i /></div>
        <div><strong>好吃的今天</strong><small>一日三餐 · 不再为难</small></div>
      </div>

      <nav className="primary-nav">
        <div className="nav-caption">我的餐桌</div>
        {primaryNav.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              className={activePage === item.id ? 'active' : ''}
              onClick={() => onNavigate(item.id)}
            >
              <Icon size={19} strokeWidth={2.1} />
              <span>{item.label}</span>
              {item.id === 'report' && <em>NEW</em>}
            </button>
          )
        })}
      </nav>

      <div className="module-nav">
        <div className="nav-caption">场景模式 <span>换个口味</span></div>
        {moduleItems.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              className={activeModule === item.id ? 'active' : ''}
              onClick={() => onChooseModule(item)}
              style={{ '--module-color': item.color, '--module-pale': item.pale }}
            >
              <span className="module-icon"><Icon size={17} /></span>
              <span>{item.name}</span>
              {item.pro && !isPro && <LockKeyhole className="module-lock" size={13} />}
              {item.pro && isPro && <span className="tiny-pro">PRO</span>}
            </button>
          )
        })}
      </div>

      <div className="sidebar-spacer" />
      {!isPro && (
        <button className="pro-card" onClick={onOpenMembership}>
          <span className="pro-shine"><Sparkles size={15} /></span>
          <strong>升级 Pro 饭搭子</strong>
          <small>解锁全家 · 乐龄 · 健身</small>
          <i><Zap size={12} fill="currentColor" /> 限时体验</i>
        </button>
      )}
      {isPro && (
        <div className="pro-active-card">
          <span>👑</span><div><strong>Pro 饭搭子</strong><small>所有场景已解锁</small></div>
        </div>
      )}
      <button className="settings-link" onClick={onOpenSettings}><Settings size={17} /> 设置与帮助</button>
    </aside>
  )
}

function Topbar({ module, onProfile, onLogin, onLogout, account, onSearch, onToast }) {
  const [clock, setClock] = useState(() => new Date())
  const dateText = formatChinaHeader(clock)
  const notificationRef = useRef(null)
  const [showNotifications, setShowNotifications] = useState(false)
  const [readNotificationIds, setReadNotificationIds] = useState(() => {
    try {
      const savedIds = JSON.parse(window.localStorage.getItem('mealReadNotificationIds'))
      return Array.isArray(savedIds) ? savedIds : []
    } catch {
      return []
    }
  })
  const unreadCount = publishedNotifications.filter((item) => !readNotificationIds.includes(item.id)).length
  const accountLabel = account?.displayName || account?.identifierHint || '小饭同学'
  const accountMeta = account ? (account.identifierHint || '账号已验证') : '今日状态：嘴馋'

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!showNotifications) return undefined
    function closeNotifications(event) {
      if (!notificationRef.current?.contains(event.target)) setShowNotifications(false)
    }
    function closeOnEscape(event) {
      if (event.key === 'Escape') setShowNotifications(false)
    }
    window.addEventListener('pointerdown', closeNotifications)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('pointerdown', closeNotifications)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [showNotifications])

  function saveReadNotifications(ids) {
    setReadNotificationIds(ids)
    window.localStorage.setItem('mealReadNotificationIds', JSON.stringify(ids))
  }

  function openNotification(notification) {
    if (!readNotificationIds.includes(notification.id)) saveReadNotifications([...readNotificationIds, notification.id])
    setShowNotifications(false)
    onToast(`${notification.title}：${notification.description}`)
  }

  return (
    <header className="topbar">
      <div className="drag-area" />
      <div className="topbar-title">
        <span className="eyebrow">{dateText}</span>
        <div><h1>{module.name}</h1><span className="topbar-mood">{module.emoji} {module.subtitle}</span></div>
      </div>
      <div className="topbar-actions">
        <button className="search-pill" type="button" onClick={onSearch} aria-label="搜索食谱和食材" aria-keyshortcuts="Control+K"><Search size={17} /><span>搜食谱、食材</span><kbd>Ctrl K</kbd></button>
        <div className="notification-wrap" ref={notificationRef}>
          <button className={`icon-button ${showNotifications ? 'active' : ''}`} type="button" onClick={() => setShowNotifications((current) => !current)} aria-label={`通知中心，${unreadCount}条未读`} aria-expanded={showNotifications}><Bell size={19} />{unreadCount > 0 && <i />}</button>
          {showNotifications && (
            <section className="notification-panel" aria-label="已发布通知">
              <div className="notification-head"><div><strong>通知中心</strong><small>{unreadCount ? `${unreadCount} 条新鲜事等你看` : '消息都看过啦，真利落'}</small></div><span>{publishedNotifications.length} 条已发布</span></div>
              <div className="notification-list">
                {publishedNotifications.map((notification) => {
                  const isUnread = !readNotificationIds.includes(notification.id)
                  return <button key={notification.id} className={isUnread ? 'unread' : ''} type="button" onClick={() => openNotification(notification)}><span>{notification.emoji}</span><div><strong>{notification.title}</strong><p>{notification.description}</p><small>{notification.time}</small></div>{isUnread && <i />}</button>
                })}
              </div>
              <button className="notification-read-all" type="button" disabled={!unreadCount} onClick={() => saveReadNotifications(publishedNotifications.map((item) => item.id))}><CheckCircle2 size={15} /> 全部标为已读</button>
            </section>
          )}
        </div>
        <button className="user-chip" onClick={onProfile}>
          <span className="avatar">小</span>
          <span><strong>{accountLabel}</strong><small>{accountMeta}</small></span>
          <ChevronDown size={15} />
        </button>
        <button className="login-link" onClick={account ? onLogout : onLogin}>{account ? '退出' : '登录'}</button>
      </div>
    </header>
  )
}

function TodayView({ module, meals, onEdit, onToggleDone, onOpenAssistant, onShare, onNavigate, onOpenLibrary }) {
  const finishedCalories = meals.filter((meal) => meal.done).reduce((sum, meal) => sum + meal.kcal, 0)
  const totalCalories = meals.reduce((sum, meal) => sum + meal.kcal, 0)
  const moduleCopy = {
    standard: { title: '早上好，今天也要认真吃饭呀', note: '根据你近 3 天的记录，今天适合「高纤 + 优质蛋白」组合。', badge: 'AI 今日推荐' },
    family: { title: '开饭啦！把全家的幸福端上桌', note: '兼顾两位大人与两个孩子，今天安排少油、好嚼、孩子也爱吃。', badge: '一家四口方案' },
    elder: { title: '慢慢吃，好好过，今天也很舒心', note: '今天建议控盐补钙，食材软烂易嚼，餐后别忘了散散步。', badge: '乐龄安心方案' },
    fitness: { title: '练得漂亮，更要吃得明白', note: '今天是力量训练日：碳水别躲，蛋白拉满，状态直接起飞。', badge: '增肌训练日' },
  }
  const copy = moduleCopy[module.id]

  return (
    <div className="dashboard">
      <section className={`welcome-card welcome-${module.id}`}>
        <div className="welcome-copy">
          <span className="recommend-badge"><Sparkles size={14} /> {copy.badge}</span>
          <h2>{copy.title}</h2>
          <p>{copy.note}</p>
          <div className="welcome-actions">
            <button className="primary-button" onClick={onOpenAssistant}><Sparkles size={17} /> 让 AI 换个方案</button>
            <button className="soft-button" onClick={() => onNavigate('calendar')}><CalendarDays size={17} /> 查看本周</button>
          </div>
        </div>
        {module.id === 'family' ? <FamilyIllustration /> : module.id === 'elder' ? <ElderIllustration /> : module.id === 'fitness' ? <FitnessIllustration /> : <FoodIllustration />}
        <div className="hero-scribble">好好吃饭<br />就是头等大事</div>
      </section>

      {module.id !== 'standard' && <ModuleSpotlight module={module} onOpenAssistant={onOpenAssistant} />}

      <div className="dashboard-grid">
        <section className="today-plan panel-card">
          <div className="section-heading">
            <div><span className="section-kicker">TODAY'S PLAN</span><h3>今天的三餐安排</h3></div>
            <div className="heading-actions">
              <button onClick={onOpenLibrary}><Search size={16} /> 菜谱库</button>
              <button onClick={onShare}><Share2 size={16} /> 分享</button>
            </div>
          </div>
          <div className="meal-list">
            {meals.map((meal, index) => (
              <MealRow
                key={meal.type}
                meal={meal}
                index={index}
                onEdit={onEdit}
                onToggleDone={onToggleDone}
              />
            ))}
          </div>
          <button className="add-meal-button" onClick={() => onEdit({
            type: '加餐', time: '15:30', title: '坚果酸奶杯', description: '无糖酸奶 150g · 混合坚果 15g', kcal: 215, protein: 9, tag: '能量补给', done: false,
          })}><Plus size={16} /> 加一顿也没关系，日子要有滋有味</button>
        </section>

        <aside className="nutrition-column">
          <section className="energy-card panel-card">
            <div className="compact-heading"><div><span>今日能量账本</span><strong>吃得明白，心里不慌</strong></div></div>
            <div className="energy-main">
              <EnergyRing value={finishedCalories} total={1850} color={module.color} />
              <div className="energy-stats">
                <span><i className="dot protein" /><em>蛋白质</em><strong>87<small>/ 105g</small></strong></span>
                <span><i className="dot carb" /><em>碳水</em><strong>182<small>/ 230g</small></strong></span>
                <span><i className="dot fat" /><em>脂肪</em><strong>43<small>/ 62g</small></strong></span>
              </div>
            </div>
            <div className="smart-tip"><span>💡</span><p><strong>小饭碎碎念</strong>今天还差一点蛋白质，晚餐的豆腐别偷偷夹给别人哦。</p></div>
          </section>

          <section className="habit-card panel-card">
            <div className="habit-top"><div><span className="mini-flame"><Flame size={17} fill="currentColor" /></span><div><small>连续好好吃饭</small><strong>7 天</strong></div></div><span className="streak-up"><TrendingUp size={14} /> 超过 82% 饭友</span></div>
            <div className="week-dots">
              {['一', '二', '三', '四', '五', '六', '日'].map((day, index) => <span key={day}><i className={index < 6 ? 'done' : ''}>{index < 6 ? <Check size={12} /> : ''}</i><small>{day}</small></span>)}
            </div>
          </section>
        </aside>
      </div>

      <section className="insight-row">
        <InsightCard icon={Wheat} color="#e8a64c" value="24.6g" label="膳食纤维" note="比昨天多 3.2g" progress={78} />
        <InsightCard icon={Activity} color="#e36d51" value="1,245" label="已摄入千卡" note={`计划总计 ${totalCalories} kcal`} progress={67} />
        <InsightCard icon={ShoppingBasket} color="#5b9b76" value="8 种" label="今日食材" note="再来 2 种就满彩虹" progress={80} />
        <button className="report-entry" onClick={() => onNavigate('report')}>
          <span><PieChart size={22} /><i><Sparkles size={11} /></i></span>
          <div><small>你的本周营养周报</small><strong>整体表现很不错 <em>A-</em></strong></div>
          <ChevronRight size={20} />
        </button>
      </section>
    </div>
  )
}

function MealRow({ meal, index, onEdit, onToggleDone }) {
  return (
    <article className={`meal-row ${meal.done ? 'is-done' : ''}`}>
      <div className="meal-time"><strong>{meal.type}</strong><span><Clock3 size={12} /> {meal.time}</span></div>
      <div className="meal-image" style={{ backgroundImage: `url(${meal.image || initialMeals[index % initialMeals.length].image})` }}><span>{meal.tag}</span></div>
      <div className="meal-copy"><h4>{meal.title}</h4><p>{meal.description}</p><div><span><Flame size={13} /> {meal.kcal} kcal</span><span><Beef size={13} /> 蛋白 {meal.protein}g</span></div></div>
      <div className="meal-actions">
        <button className="edit-meal" onClick={() => onEdit(meal)}><PencilLine size={15} /> 换一换</button>
        <button className={`check-meal ${meal.done ? 'checked' : ''}`} onClick={() => onToggleDone(index)} aria-label="标记已吃"><Check size={17} /></button>
      </div>
    </article>
  )
}

function EnergyRing({ value, total, color }) {
  const percent = Math.min(value / total, 1)
  const circumference = 2 * Math.PI * 48
  return (
    <div className="energy-ring">
      <svg viewBox="0 0 116 116">
        <circle cx="58" cy="58" r="48" className="ring-track" />
        <circle cx="58" cy="58" r="48" className="ring-value" style={{ stroke: color, strokeDasharray: circumference, strokeDashoffset: circumference * (1 - percent) }} />
      </svg>
      <div><small>已摄入</small><strong>{value || 436}</strong><span>/ {total} kcal</span></div>
    </div>
  )
}

function InsightCard({ icon: Icon, color, value, label, note, progress }) {
  return (
    <article className="insight-card panel-card" style={{ '--insight-color': color }}>
      <span className="insight-icon"><Icon size={20} /></span>
      <div><small>{label}</small><strong>{value}</strong><em>{note}</em><i><b style={{ width: `${progress}%` }} /></i></div>
    </article>
  )
}

function FoodIllustration() {
  return <div className="hero-visual food-visual"><span className="plate">🍲</span><i className="leaf-one">🌿</i><i className="leaf-two">🍅</i><i className="food-dot">●</i></div>
}

function FamilyIllustration() {
  return <div className="hero-visual people-visual"><span>👨🏻</span><span>👩🏻</span><span>👧🏻</span><span>👦🏻</span><i>一家人，吃一桌好饭</i></div>
}

function ElderIllustration() {
  return <div className="hero-visual elder-visual"><span>🫖</span><i className="elder-leaf">🍃</i><strong>清淡有味<br />岁岁安康</strong></div>
}

function FitnessIllustration() {
  return <div className="hero-visual fitness-visual"><span>🏋🏻</span><i>蛋白 + 碳水</i><strong>训练状态<br />拉满!</strong></div>
}

function ModuleSpotlight({ module, onOpenAssistant }) {
  if (module.id === 'fitness') {
    const focusAreas = [
      ['胸肩日', '🏋🏻‍♂️', '推举训练', '蛋白 35g'],
      ['背部日', '🧗🏻‍♂️', '拉力训练', '碳水 65g'],
      ['腿臀日', '🏃🏻‍♂️', '深蹲训练', '补水 2.2L'],
      ['核心日', '🤸🏻‍♂️', '稳定训练', '轻负担餐'],
    ]
    return (
      <section className="module-spotlight fitness-focus">
        <div className="spotlight-title"><span><Dumbbell size={17} /></span><div><strong>高级教练训练窗</strong><small>滑动查看不同部位的训练日营养策略</small></div></div>
        <div className="coach-track">{focusAreas.map((item, index) => <button key={item[0]} className={index === 0 ? 'active' : ''} onClick={onOpenAssistant}><span>{item[1]}</span><div><small>{item[0]}</small><strong>{item[2]}</strong><em>{item[3]}</em></div><ChevronRight size={15} /></button>)}</div>
      </section>
    )
  }
  if (module.id === 'elder') {
    return (
      <section className="module-spotlight elder-focus">
        <div className="spotlight-title"><span><Heart size={17} /></span><div><strong>今日安心提醒</strong><small>根据健康档案动态调整，不替代医生诊疗</small></div></div>
        <div className="elder-checks"><span><i>盐</i><div><small>今日盐量</small><strong>建议 ≤ 5g</strong></div></span><span><i>糖</i><div><small>血糖友好</small><strong>主食粗细搭配</strong></div></span><span><i>钙</i><div><small>骨骼关怀</small><strong>奶豆各一份</strong></div></span><button onClick={onOpenAssistant}>向乐龄顾问补充疾病史 <ChevronRight size={15} /></button></div>
      </section>
    )
  }
  return (
    <section className="module-spotlight family-focus">
      <div className="spotlight-title"><span><UsersRound size={17} /></span><div><strong>这一桌，人人都有份</strong><small>同一道菜按家庭成员自动调整用量与口味</small></div></div>
      <div className="family-portions"><span><i>👨🏻</i><div><small>爸爸</small><strong>标准份 1.2×</strong></div></span><span><i>👩🏻</i><div><small>妈妈</small><strong>标准份 1.0×</strong></div></span><span><i>👧🏻</i><div><small>女儿</small><strong>儿童份 0.7×</strong></div></span><span><i>👦🏻</i><div><small>儿子</small><strong>幼儿份 0.5×</strong></div></span><button onClick={onOpenAssistant}>问问怎么一锅多吃 <ChevronRight size={15} /></button></div>
    </section>
  )
}

function CalendarView({ meals, calendarMealsByDate, onEdit, onToast }) {
  const [today, setToday] = useState(() => getChinaToday())
  const [viewMonth, setViewMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(today)
  const [contextMenu, setContextMenu] = useState(null)
  const [isExporting, setIsExporting] = useState(false)
  const calendarCells = useMemo(() => buildMonthCells(viewMonth), [viewMonth])
  const selectedMeals = useMemo(() => mealsForCalendarDate(selectedDate, meals, calendarMealsByDate), [selectedDate, meals, calendarMealsByDate])
  const monthLabel = `${viewMonth.getFullYear()} 年 ${viewMonth.getMonth() + 1} 月`
  const selectedWeekday = selectedDate.toLocaleDateString('zh-CN', { weekday: 'long' })

  useEffect(() => {
    const timer = window.setInterval(() => {
      const currentChinaDate = getChinaToday()
      setToday((current) => sameCalendarDate(current, currentChinaDate) ? current : currentChinaDate)
    }, 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!contextMenu) return undefined
    const closeMenu = () => setContextMenu(null)
    const closeOnEscape = (event) => { if (event.key === 'Escape') closeMenu() }
    window.addEventListener('click', closeMenu)
    window.addEventListener('blur', closeMenu)
    window.addEventListener('resize', closeMenu)
    window.addEventListener('keydown', closeOnEscape)
    document.addEventListener('scroll', closeMenu, true)
    return () => {
      window.removeEventListener('click', closeMenu)
      window.removeEventListener('blur', closeMenu)
      window.removeEventListener('resize', closeMenu)
      window.removeEventListener('keydown', closeOnEscape)
      document.removeEventListener('scroll', closeMenu, true)
    }
  }, [contextMenu])

  function chooseDate(date) {
    const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    setSelectedDate(normalizedDate)
    setViewMonth(new Date(normalizedDate.getFullYear(), normalizedDate.getMonth(), 1))
    setContextMenu(null)
  }

  function changeMonth(offset) {
    const targetMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + offset, 1)
    const lastDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate()
    const nextDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), Math.min(selectedDate.getDate(), lastDay))
    setViewMonth(targetMonth)
    setSelectedDate(nextDate)
    setContextMenu(null)
  }

  function showDayPlan(event, date) {
    event.preventDefault()
    const menuWidth = 286
    const menuHeight = 245
    const x = Math.max(12, Math.min(event.clientX, window.innerWidth - menuWidth - 12))
    const y = Math.max(12, Math.min(event.clientY, window.innerHeight - menuHeight - 12))
    chooseDate(date)
    setContextMenu({ date: new Date(date), x, y })
  }

  async function exportWeek() {
    if (isExporting) return
    setIsExporting(true)
    try {
      const result = await exportWeeklyPlanToPdf(weekPlan, monthLabel)
      if (result?.ok) onToast(result.browserPrint ? '打印窗口已打开，选择“另存为 PDF”即可。' : '本周食谱 PDF 已保存。')
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'PDF 导出失败，请再试一次。')
    } finally {
      setIsExporting(false)
    }
  }

  const contextMeals = contextMenu ? mealsForCalendarDate(contextMenu.date, meals, calendarMealsByDate) : []

  return (
    <div className="page-view calendar-page">
      <section className="page-intro">
        <div><span className="section-kicker">MEAL CALENDAR</span><h2>{viewMonth.getMonth() + 1}月的吃饭大事</h2><p>左键选日期，右键直接偷看当天吃什么。</p></div>
        <button className="primary-button" onClick={() => onToast('本周食谱已按你的饭量重新排好。')}><Sparkles size={17} /> AI 生成整周食谱</button>
      </section>
      <div className="calendar-layout">
        <section className="month-card panel-card">
          <div className="calendar-toolbar">
            <button onClick={() => changeMonth(-1)} aria-label="上一个月"><ArrowLeft size={18} /></button>
            <h3>{monthLabel}</h3>
            <button onClick={() => changeMonth(1)} aria-label="下一个月"><ArrowRight size={18} /></button>
            <button className="calendar-today" onClick={() => chooseDate(today)}>回到今天</button>
          </div>
          <div className="calendar-weekdays">{['一', '二', '三', '四', '五', '六', '日'].map((day) => <span key={day}>周{day}</span>)}</div>
          <div className="calendar-grid">
            {calendarCells.map((cell) => {
              const isToday = sameCalendarDate(cell.date, today)
              const isSelected = sameCalendarDate(cell.date, selectedDate)
              const isBirthday = cell.date.getFullYear() === 2026 && cell.date.getMonth() === 7 && cell.date.getDate() === 8
              const isFestival = cell.date.getFullYear() === 2026 && cell.date.getMonth() === 7 && cell.date.getDate() === 19
              return (
                <button
                  key={`${cell.date.getFullYear()}-${cell.date.getMonth()}-${cell.date.getDate()}`}
                  className={`${isSelected ? 'selected' : ''} ${cell.currentMonth ? 'planned' : 'outside'}`}
                  onClick={() => chooseDate(cell.date)}
                  onContextMenu={(event) => showDayPlan(event, cell.date)}
                  aria-label={`${cell.date.getFullYear()}年${cell.date.getMonth() + 1}月${cell.date.getDate()}日`}
                  aria-pressed={isSelected}
                >
                  <span>{cell.date.getDate()}</span>
                  {isToday && <em>今天</em>}
                  {isBirthday && <b className="date-event birthday">🎂 妈妈生日</b>}
                  {isFestival && <b className="date-event festival">💞 七夕</b>}
                  <div className="meal-dots"><i /><i /><i /></div>
                </button>
              )
            })}
          </div>
        </section>
        <aside className="day-detail panel-card">
          <div className="day-detail-head"><span>{selectedDate.getMonth() + 1}月</span><strong>{selectedDate.getDate()}</strong><div><em>{selectedWeekday}</em><small>{selectedDate.getFullYear()} · 宜：好好吃饭</small></div></div>
          <div className="mini-meals">
            {selectedMeals.map((meal, index) => <button key={meal.calendarId || `${meal.type}-${index}`} onClick={() => onEdit(meal, selectedDate)}><span>{meal.time}</span><div><small>{meal.type}</small><strong>{meal.title}</strong></div><ChevronRight size={17} /></button>)}
          </div>
          <button className="outline-full" onClick={() => onEdit({ calendarId: `${calendarDateKey(selectedDate)}-custom-${Date.now()}`, type: '加餐', time: '15:30', title: '新的一餐', description: '在这里填写食材与用量', kcal: 200, protein: 8, portionMultiplier: 1 }, selectedDate)}><Plus size={16} /> 添加一餐</button>
          <div className="calendar-tip"><Sparkles size={18} /><p>当前选中 {selectedDate.getMonth() + 1} 月 {selectedDate.getDate()} 日；在日期格上点右键，还能快速查看当日三餐。</p></div>
        </aside>
      </div>
      <section className="week-strip panel-card">
        <div className="section-heading"><div><span className="section-kicker">WEEKLY OVERVIEW</span><h3>本周菜单速览</h3></div><button className="share-small" onClick={exportWeek} disabled={isExporting}><FileDown size={15} /> {isExporting ? '正在生成…' : '导出 PDF'}</button></div>
        <div className="week-table">
          {weekPlan.map((day, index) => <div className={index === (today.getDay() + 6) % 7 ? 'today' : ''} key={day[0]}><strong>{day[0]}</strong>{day.slice(1).map((meal) => <span key={meal}>{meal}</span>)}</div>)}
        </div>
      </section>
      {contextMenu && (
        <div className="calendar-context-menu" role="menu" aria-label={`${contextMenu.date.getMonth() + 1}月${contextMenu.date.getDate()}日餐饮方案`} style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}>
          <div className="context-menu-head"><span>🍱</span><div><strong>{contextMenu.date.getMonth() + 1}月{contextMenu.date.getDate()}日餐饮方案</strong><small>{contextMenu.date.toLocaleDateString('zh-CN', { weekday: 'long' })} · 右键菜单</small></div><button onClick={() => setContextMenu(null)} aria-label="关闭当日餐饮方案"><X size={15} /></button></div>
          <div className="context-menu-meals">{contextMeals.map((meal, index) => <button role="menuitem" key={meal.calendarId || `${meal.type}-${index}`} onClick={() => { setContextMenu(null); onEdit(meal, contextMenu.date) }}><span>{meal.type}<small>{meal.time}</small></span><strong>{meal.title}</strong><ChevronRight size={14} /></button>)}</div>
          <p>点一餐可继续修改食材、用量和热量。</p>
        </div>
      )}
    </div>
  )
}

function ReportView({ onShare }) {
  return (
    <div className="page-view report-page">
      <section className="page-intro">
        <div><span className="section-kicker">WEEKLY REPORT</span><h2>这周吃得怎么样？</h2><p>不批评每一口，只帮你看见每一点进步。</p></div>
        <div className="report-actions"><button className="soft-button"><ArrowLeft size={16} /> 上一周</button><button className="primary-button" onClick={onShare}><Share2 size={17} /> 分享周报</button></div>
      </section>
      <section className="score-hero panel-card">
        <div className="score-orbit"><span>A-</span><svg viewBox="0 0 160 160"><circle cx="80" cy="80" r="68" /><circle className="score-line" cx="80" cy="80" r="68" /></svg></div>
        <div className="score-copy"><span>7月29日 — 8月4日</span><h3>你正在成为更会吃的人</h3><p>本周餐食多样性表现优秀，优质蛋白也很稳。蔬菜量还有一点上升空间——下周让绿色多占半盘吧。</p><div><span><CheckCircle2 size={16} /> 记录完整 6 天</span><span><TrendingUp size={16} /> 较上周提升 8 分</span></div></div>
        <div className="score-stamp">本周饭霸<br /><strong>认真生活奖</strong></div>
      </section>
      <div className="report-grid">
        <section className="nutrient-chart panel-card">
          <div className="section-heading"><div><span className="section-kicker">NUTRITION TREND</span><h3>每日营养摄入</h3></div><select defaultValue="calorie"><option value="calorie">热量趋势</option><option>蛋白质</option></select></div>
          <div className="chart-area">
            <div className="chart-y"><span>2000</span><span>1500</span><span>1000</span><span>500</span><span>0</span></div>
            <div className="chart-bars">{[72, 88, 64, 92, 80, 68, 76].map((height, index) => <div key={index}><span className={index === 3 ? 'peak' : ''} style={{ height: `${height}%` }}><i>{[1620, 1870, 1480, 1940, 1760, 1520, 1680][index]}</i></span><small>{['一', '二', '三', '四', '五', '六', '日'][index]}</small></div>)}</div>
          </div>
          <div className="chart-legend"><span><i className="actual" />实际摄入</span><span><i className="target" />建议区间 1600–1900 kcal</span></div>
        </section>
        <section className="balance-card panel-card">
          <div className="section-heading"><div><span className="section-kicker">BALANCE</span><h3>三大营养素</h3></div><button><MoreHorizontal size={18} /></button></div>
          <div className="macro-donut"><div><span><strong>91%</strong><small>整体达标</small></span></div></div>
          <div className="macro-list"><span><i style={{ background: '#e76f51' }} /><em>蛋白质</em><strong>26%</strong></span><span><i style={{ background: '#e8ac48' }} /><em>碳水</em><strong>49%</strong></span><span><i style={{ background: '#69a486' }} /><em>脂肪</em><strong>25%</strong></span></div>
        </section>
      </div>
      <div className="achievement-row">
        <article className="achievement"><span>🥦</span><div><small>蔬菜探索家</small><strong>本周吃了 12 种蔬菜</strong></div></article>
        <article className="achievement"><span>🥛</span><div><small>补钙小能手</small><strong>乳制品达标 5 天</strong></div></article>
        <article className="achievement"><span>🌙</span><div><small>夜宵终结者</small><strong>连续 7 天没有深夜加餐</strong></div></article>
      </div>
    </div>
  )
}

function FavoritesView({ onToast, onUseDish }) {
  const {
    collections,
    favorites,
    favoriteImages,
    favoriteByDishId,
    activeCollectionId,
    activeCollection,
    loading,
    error,
    reload,
    setActiveCollectionId,
    removeFavorite,
    addCollection,
  } = useFavoriteCatalog()
  const [selectedCollectionId, setSelectedCollectionId] = useState('all')

  useEffect(() => {
    if (selectedCollectionId === 'all') return
    if (collections.some((collection) => collection.id === selectedCollectionId)) return
    setSelectedCollectionId(collections.find((collection) => collection.isDefault)?.id || 'all')
  }, [collections, selectedCollectionId])

  const visibleFavorites = selectedCollectionId === 'all'
    ? favorites
    : favorites.filter((favorite) => favorite.collectionId === selectedCollectionId)
  function favoriteImageUrl(favorite) {
    return favoriteImages[favorite.dishId]?.thumbnailUrl
      || favorite.image
      || dishes.find((dish) => dish.id === favorite.dishId)?.image
      || ''
  }

  const visibleImageUrls = visibleFavorites.map(favoriteImageUrl).filter(Boolean)
  const imageReadyMap = usePreloadedImages(visibleImageUrls)

  async function handleCreateCollection() {
    const nextName = window.prompt('新收藏夹叫什么？', '今日想吃')
    if (!nextName) return
    try {
      const collection = await addCollection(nextName)
      if (collection?.id) {
        setSelectedCollectionId(collection.id)
        setActiveCollectionId(collection.id)
        onToast(`收藏夹「${collection.name}」已创建`)
      }
    } catch (error) {
      onToast(error instanceof Error ? error.message : '创建收藏夹失败')
    }
  }

  async function handleRemoveFavorite(favorite) {
    try {
      await removeFavorite(favorite.dishId)
      onToast(`${favorite.name}已从收藏里移出`)
    } catch (error) {
      onToast(error instanceof Error ? error.message : '移除收藏失败')
    }
  }

  async function handleScheduleFavorite(favorite) {
    if (!onUseDish) return
    onUseDish({ ...favorite, image: favoriteImages[favorite.dishId]?.url || favoriteImageUrl(favorite) }, '午餐')
  }

  return (
    <div className="page-view favorites-page">
      <section className="page-intro">
        <div>
          <span className="section-kicker">MY FAVORITES</span>
          <h2>舍不得忘掉的好味道</h2>
          <p>收藏不是吃灰，是给下一顿留个盼头。</p>
        </div>
        <button className="primary-button" onClick={handleCreateCollection}><Plus size={17} /> 新建收藏夹</button>
      </section>
      <div className="filter-row">
        <button className={selectedCollectionId === 'all' ? 'active' : ''} onClick={() => setSelectedCollectionId('all')}>全部 {favorites.length}</button>
        {collections.map((collection) => (
          <button
            key={collection.id}
            className={selectedCollectionId === collection.id ? 'active' : ''}
            onClick={() => {
              setSelectedCollectionId(collection.id)
              setActiveCollectionId(collection.id)
            }}
            title={collection.isDefault ? '默认收藏夹' : '收藏夹'}
          >
            {collection.name} {collection.dishCount ?? 0}
          </button>
        ))}
      </div>
      <div className="favorites-meta">
        <span>当前新增收藏会进入 <strong>{activeCollection?.name || '默认收藏'}</strong></span>
        <button onClick={() => reload()}>重新同步</button>
      </div>
      {error && <div className="favorites-error">{error}</div>}
      <div className="favorite-grid">
        {loading && !favorites.length && Array.from({ length: 4 }).map((_, index) => (
          <article key={`favorite-skeleton-${index}`} className="favorite-card panel-card skeleton-card">
            <div className="favorite-image skeleton-media" />
            <div className="skeleton-copy">
              <span className="skeleton-line short" />
              <span className="skeleton-line" />
              <span className="skeleton-line tiny" />
              <span className="skeleton-line button" />
            </div>
          </article>
        ))}
        {!loading && !visibleFavorites.length && (
          <div className="empty-favorites">
            <span>💌</span>
            <strong>这里还空着</strong>
            <p>先去菜肴库点一下小爱心，收藏夹就会开始长胖。</p>
          </div>
        )}
        {visibleFavorites.map((favorite, index) => {
          const imageUrl = favoriteImageUrl(favorite)
          const imageReady = imageUrl ? Boolean(imageReadyMap[imageUrl]) : true
          const favoriteScore = 4.9 - (index % 4) * 0.1
          return (
            <article key={favorite.id} className="favorite-card panel-card">
              <div
                className={`favorite-image ${imageReady ? 'is-ready' : 'is-loading'}`}
                style={imageReady && imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}
              >
                {!imageReady && <span className="image-skeleton-mark" />}
                <span>{favorite.collectionName || '默认收藏'}</span>
                <button
                  onClick={() => handleRemoveFavorite(favorite)}
                  title="移出收藏"
                  aria-label={`移出收藏：${favorite.name}`}
                >
                  <Heart size={18} fill="currentColor" />
                </button>
              </div>
              <div>
                <small>饭友评分 {favoriteScore.toFixed(1)} <Star size={12} fill="currentColor" /></small>
                <h3>{favorite.name}</h3>
                <p>{favorite.cuisine} · {favorite.method} · {favorite.nutrition?.calories || 0} kcal</p>
                <button onClick={() => handleScheduleFavorite(favorite)}>安排进菜单 <ArrowRight size={15} /></button>
              </div>
            </article>
          )
        })}
      </div>
      {selectedCollectionId !== 'all' && !visibleFavorites.length && !loading && (
        <div className="empty-favorites collection-empty">
          <span>🗂️</span>
          <strong>这个收藏夹里还没有菜</strong>
          <p>去菜肴库收藏几道，再回来就会热闹起来。</p>
        </div>
      )}
    </div>
  )
}

function DishLibraryView({ mealHistory, onUseDish, focusRequest, onToast }) {
  const [query, setQuery] = useState('')
  const [cuisine, setCuisine] = useState('all')
  const [selectedDish, setSelectedDish] = useState(dishes[2])
  const [mealType, setMealType] = useState('午餐')
  const [remoteImages, setRemoteImages] = useState({})
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const { favoriteByDishId, activeCollection, toggleFavorite } = useFavoriteCatalog()
  const searchInputRef = useRef(null)
  const graphStats = getDishGraphStats()
  const searchAnalysis = useMemo(() => analyzeDishQuery(query), [query])
  const results = useMemo(() => searchDishes(query, cuisine), [query, cuisine])
  const portion = selectedDish ? calculateDishPortion(selectedDish, mealHistory, mealType) : null
  const relatedDishes = selectedDish ? getRelatedDishes(selectedDish.id, 6) : []
  const imageUrls = useMemo(() => [...new Set(results.map((dish) => dishImage(dish)).filter(Boolean).concat(selectedDish ? [dishImage(selectedDish, false)] : []))], [results, remoteImages, selectedDish])
  const imageReadyMap = usePreloadedImages(imageUrls)

  useEffect(() => {
    let active = true
    fetchDishImages(dishes.map((dish) => dish.id))
      .then((images) => { if (active) setRemoteImages(images) })
      .catch(() => { if (active) setRemoteImages({}) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!focusRequest) return undefined
    const frame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [focusRequest])

  useEffect(() => {
    if (!results.length || results.some((dish) => dish.id === selectedDish?.id)) return
    setSelectedDish(results[0])
  }, [results, selectedDish?.id])

  function dishImage(dish, thumbnail = true) {
    const remoteImage = remoteImages[dish.id]
    return (thumbnail ? remoteImage?.thumbnailUrl : remoteImage?.url) || dish.image
  }

  async function exportSelectedRecipe() {
    if (!selectedDish || !portion || isExportingPdf) return
    setIsExportingPdf(true)
    try {
      const result = await exportRecipeToPdf(selectedDish, portion, mealType)
      if (result?.ok) onToast(result.browserPrint ? '打印窗口已打开，选择“另存为 PDF”即可。' : `${selectedDish.name}食谱 PDF 已保存。`)
    } catch (error) {
      onToast(error instanceof Error ? error.message : '食谱 PDF 导出失败。')
    } finally {
      setIsExportingPdf(false)
    }
  }

  async function handleToggleFavorite(dish, event) {
    event?.preventDefault()
    event?.stopPropagation()
    try {
      const result = await toggleFavorite({ ...dish, image: dishImage(dish, false) })
      if (result.action === 'removed') {
        onToast(`${dish.name}已从收藏里移出`)
      } else {
        onToast(`${dish.name}已收藏到${result.collection || activeCollection?.name || '默认收藏'}`)
      }
    } catch (error) {
      onToast(error instanceof Error ? error.message : '收藏操作失败')
    }
  }

  return (
    <div className="page-view library-page">
      <section className="page-intro library-intro"><div><span className="section-kicker">DISH ATLAS · HASHED</span><h2>八大菜系，今天搜哪一味？</h2><p>菜品、食材、烹饪方式都已建立联系，搜到就能按你的饭量算一份。</p></div><div className="library-stats"><span><strong>{dishes.length}</strong><small>道种子菜</small></span><span><strong>{graphStats.edges}</strong><small>条搭配关系</small></span><span><strong>{Object.keys(remoteImages).length}</strong><small>张云端图</small></span></div></section>
      <div className="library-searchbar"><Search size={18} /><input ref={searchInputRef} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') { setQuery(''); event.currentTarget.blur() } }} placeholder="支持拼音缩写、食材、口味、做法：如 gbjd / 猪肉饺 / 低脂鸡胸…" aria-label="搜索菜名、食材、口味或烹饪方式" /><kbd>Ctrl K</kbd></div>
      {!searchAnalysis.isEmpty && (
        <div className="library-search-insight">
          <span>已智能提取</span>
          {searchAnalysis.displayTokens.length
            ? searchAnalysis.displayTokens.map((token) => <em key={token}>{token}</em>)
            : <em>近似菜名</em>}
          <small>按菜名、食材、做法、口味、拼音/缩写综合排序</small>
        </div>
      )}
      <div className="cuisine-chips">{cuisineMeta.map((item) => <button key={item.id} className={cuisine === item.id ? 'active' : ''} onClick={() => setCuisine(item.id)}><span>{item.emoji}</span>{item.name}</button>)}</div>
      <div className="library-layout">
        <section className="dish-results">
          <div className="library-result-head"><span>找到 {results.length} 道好菜</span><button onClick={() => { setQuery(''); setCuisine('all') }}>清空筛选</button></div>
          <div className="dish-card-grid">
            {results.map((dish) => {
              const imageUrl = dishImage(dish)
              const imageReady = Boolean(imageReadyMap[imageUrl])
              const isFavorited = favoriteByDishId.has(dish.id)
              return (
                <article
                  key={dish.id}
                  className={`dish-card ${selectedDish?.id === dish.id ? 'selected' : ''} ${isFavorited ? 'is-favorited' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedDish(dish)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelectedDish(dish)
                    }
                  }}
                >
                  <div
                    className={`dish-card-image ${imageReady ? 'is-ready' : 'is-loading'}`}
                    style={imageReady && imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}
                  >
                    {!imageReady && <span className="image-skeleton-mark" />}
                    <span>{dish.cuisine}</span>
                    <i>{remoteImages[dish.id] ? '☁ 云端' : dish.method}</i>
                    <button
                      className={`dish-favorite-button ${isFavorited ? 'active' : ''}`}
                      onClick={(event) => handleToggleFavorite(dish, event)}
                      title={isFavorited ? '从收藏中移出' : `收藏到${activeCollection?.name || '默认收藏'}`}
                      aria-label={isFavorited ? `取消收藏：${dish.name}` : `收藏：${dish.name}`}
                    >
                      <Heart size={15} fill={isFavorited ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                  <div className="dish-card-copy">
                    <strong>{dish.name}</strong>
                    <small>{dish.nutrition.calories} kcal · 蛋白 {dish.nutrition.protein}g</small>
                    <div>{(dish.tags || ['新收录']).slice(0, 2).map((tag) => <em key={tag}>{tag}</em>)}</div>
                  </div>
                </article>
              )
            })}
          </div>
          {!results.length && <div className="empty-library"><span>🍜</span><strong>这道菜还在后厨备菜</strong><small>换个关键词，或者等爬虫把它带回来。</small></div>}
        </section>
        {selectedDish && portion && <aside className="dish-detail panel-card">
          <div
            className={`dish-detail-image ${imageReadyMap[dishImage(selectedDish, false)] ? 'is-ready' : 'is-loading'}`}
            style={imageReadyMap[dishImage(selectedDish, false)] ? { backgroundImage: `url(${dishImage(selectedDish, false)})` } : undefined}
          >
            {!imageReadyMap[dishImage(selectedDish, false)] && <span className="image-skeleton-mark" />}
            <span>{selectedDish.cuisine} · {selectedDish.method}{remoteImages[selectedDish.id] ? ' · MinIO' : ''}</span>
            <button
              className={`favorite-pin ${favoriteByDishId.has(selectedDish.id) ? 'active' : ''}`}
              onClick={(event) => handleToggleFavorite(selectedDish, event)}
              title={favoriteByDishId.has(selectedDish.id) ? '从收藏中移出' : `收藏到${activeCollection?.name || '默认收藏'}`}
            >
              <Heart size={15} fill={favoriteByDishId.has(selectedDish.id) ? 'currentColor' : 'none'} />
            </button>
            <button onClick={() => setSelectedDish(null)}><X size={16} /></button>
          </div>
          <div className="dish-detail-copy"><span className="section-kicker">PORTION ENGINE</span><h3>{selectedDish.name}</h3><p>这份菜是 <strong>{(selectedDish.taste || ['经典']).join('、')}</strong> 风味，系统会按你过去的饭量动态换算。</p><div className="meal-type-switch">{['早餐', '午餐', '晚餐'].map((type) => <button className={mealType === type ? 'active' : ''} key={type} onClick={() => setMealType(type)}>{type}</button>)}</div><div className="portion-highlight"><span>建议系数<strong>{portion.multiplier}×</strong></span><span>单人热量<strong>{portion.nutrition.calories}<small> kcal</small></strong></span><span>蛋白质<strong>{portion.nutrition.protein}<small> g</small></strong></span></div><div className="ingredient-list"><strong>这顿要准备</strong>{portion.ingredients.slice(0, 5).map((ingredient) => <span key={ingredient.name}><em>{ingredient.name}</em><b>{ingredient.grams}g</b></span>)}</div><small className="portion-reason"><Sparkles size={13} /> {portion.reason}</small><div className="dish-detail-actions"><button className="primary-full" onClick={() => onUseDish({ ...selectedDish, image: dishImage(selectedDish, false) }, mealType)}>按我的饭量加入{mealType} <Plus size={16} /></button><button className="outline-full" onClick={exportSelectedRecipe} disabled={isExportingPdf}><FileDown size={15} /> {isExportingPdf ? '正在生成 PDF…' : '导出这份食谱 PDF'}</button></div></div>
          <div className="relation-map"><div className="relation-map-head"><strong>这道菜和谁有关系？</strong><small>食材 · 做法 · 风味 · 菜系</small></div><div className="relation-canvas"><svg className="relation-lines" viewBox="0 0 320 210" preserveAspectRatio="none" aria-hidden="true">{relatedDishes.map((relatedDish, index) => { const point = relationNodeLayout[index]; return <g key={relatedDish.id}><line x1="160" y1="105" x2={point.x} y2={point.y} /><circle cx={point.x} cy={point.y} r="3" /><text x={(160 + point.x) / 2} y={(105 + point.y) / 2 - 4}>{relatedDish.relationScore}</text></g> })}</svg><span className="relation-center">{selectedDish.name}</span>{relatedDishes.map((relatedDish, index) => { const point = relationNodeLayout[index]; return <button key={relatedDish.id} className="relation-node" style={{ left: `${point.x / 3.2}%`, top: `${point.y / 2.1}%` }} onClick={() => setSelectedDish(relatedDish)} title={`关系强度 ${relatedDish.relationScore}`}><i>{relatedDish.name}</i><small>{relatedDish.relationReason}</small></button> })}{!relatedDishes.length && <small className="relation-empty">暂时没有达到阈值的关系</small>}</div></div>
        </aside>}
      </div>
    </div>
  )
}

class AssistantErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return <div className="assistant-panel assistant-fallback"><div className="assistant-head"><div className="assistant-avatar">饭</div><div><strong>小饭 AI</strong><span>刚刚打了个盹</span></div><button onClick={this.props.onClose}><X size={19} /></button></div><div className="assistant-fallback-copy"><span>🍚</span><h3>小饭暂时端不出这道回答</h3><p>当前对话没有影响，你可以关闭后重新打开再问一次。</p><button className="primary-button" onClick={() => this.setState({ hasError: false })}>重新唤醒小饭</button></div></div>
    }
    return this.props.children
  }
}

function AssistantPanel({ module, meals, mealHistory, onClose, onConfigureAi }) {
  const [messages, setMessages] = useState([{ role: 'assistant', content: `嗨，我是小饭！${module.emoji}\n现在是「${module.name}」，你可以告诉我想吃什么、家里有啥菜，或者直接问“今晚怎么安排？”` }])
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [connectionNote, setConnectionNote] = useState('正在连接平台 AI…')
  const [connectionState, setConnectionState] = useState('checking')
  const endRef = useRef(null)
  const revealTimerRef = useRef(null)
  const mealContextFingerprint = meals.map(({ type, title, description, kcal, portionMultiplier }) => `${type}|${title}|${description}|${kcal}|${portionMultiplier}`).join('||')
  const mealContextRef = useRef(mealContextFingerprint)
  const requestRevisionRef = useRef(0)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isThinking])

  useEffect(() => {
    let active = true
    async function loadAiStatus() {
      if (!window.mealDesktop?.getAiConfig) {
        if (active) {
          setConnectionState('preview')
          setConnectionNote('网页预览未连接外部 AI')
        }
        return
      }
      try {
        const config = await window.mealDesktop.getAiConfig()
        if (active) {
          if (config?.configurationIssue) {
            setConnectionState('error')
            setConnectionNote(config.configurationIssue)
          } else if (config?.configured) {
            setConnectionState('configured')
            setConnectionNote(`${config.providerName} · ${config.model} · 平台托管`)
          } else {
            setConnectionState('unconfigured')
            setConnectionNote('平台 DeepSeek 暂未就绪')
          }
        }
      } catch {
        if (active) {
          setConnectionState('error')
          setConnectionNote('平台 AI 状态读取失败')
        }
      }
    }
    loadAiStatus()
    return () => {
      active = false
      if (revealTimerRef.current) window.clearInterval(revealTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (mealContextRef.current === mealContextFingerprint) return
    mealContextRef.current = mealContextFingerprint
    requestRevisionRef.current += 1
    if (revealTimerRef.current) {
      window.clearInterval(revealTimerRef.current)
      revealTimerRef.current = null
    }
    setIsThinking(false)
    const currentPlan = meals.map((meal) => `${meal.type}“${meal.title}”`).join('、')
    setMessages([{ role: 'assistant', content: `看到你更新餐桌啦！接下来的回答会以当前安排为准：${currentPlan || '今天还没有安排餐食'}。` }])
  }, [mealContextFingerprint, meals])

  function revealAssistantReply(content) {
    const fullText = String(content || '')
    let cursor = 0
    setMessages((current) => [...current, { role: 'assistant', content: '' }])
    revealTimerRef.current = window.setInterval(() => {
      cursor = Math.min(fullText.length, cursor + 3)
      setMessages((current) => current.map((message, index) => (
        index === current.length - 1 ? { ...message, content: fullText.slice(0, cursor) } : message
      )))
      if (cursor >= fullText.length) {
        window.clearInterval(revealTimerRef.current)
        revealTimerRef.current = null
        setIsThinking(false)
      }
    }, 18)
  }

  async function sendMessage(messageText = input) {
    const text = messageText.trim()
    if (!text || isThinking) return
    const foodTerms = /吃|饭|菜|餐|营养|热量|蛋白|碳水|脂肪|食谱|食材|烹饪|早餐|午餐|晚餐|加餐|减脂|减肥|增肌|健身|训练|控糖|血糖|血压|血脂|健康|疾病|过敏|忌口|食物|食品|水果|蔬菜|肉|鱼|蛋|奶|豆|辣|甜|咸|饿|膳食|维生素|盐|油|糖/
    const nextMessages = [...messages, { role: 'user', content: text }]
    const requestRevision = requestRevisionRef.current
    setMessages(nextMessages)
    setInput('')
    setIsThinking(true)

    if (!foodTerms.test(text)) {
      window.setTimeout(() => {
        setMessages((current) => [...current, { role: 'assistant', content: '这题有点超出厨房管辖范围啦 😅 我只聊吃饭、营养和食谱。要不问问我“今晚吃什么”？' }])
        setIsThinking(false)
      }, 650)
      return
    }

    try {
      const apiMessages = nextMessages.map(({ role, content }) => ({ role, content }))
      const context = {
        currentMeals: meals.map(({ type, title, description, kcal, portionMultiplier }) => ({ type, title, description, kcal, portionMultiplier })),
        recentMeals: mealHistory.slice(-12).map(({ type, title, description, kcal, portionMultiplier }) => ({ type, title, description, kcal, portionMultiplier })),
      }
      const rawResponse = window.mealDesktop ? await window.mealDesktop.chat({ module: module.id, messages: apiMessages, context }) : { demo: true, reason: 'browser_preview' }
      if (requestRevision !== requestRevisionRef.current) return
      const response = rawResponse && typeof rawResponse === 'object' ? rawResponse : { demo: true }
      if (response.apiError) {
        setConnectionState('error')
        setConnectionNote(`连接失败：${response.apiError}`)
        revealAssistantReply(`这次没有拿到 DeepSeek 的回答：${response.apiError}\n请稍后再试；若持续失败，请让管理员检查后台密钥池。`)
      } else if (response.demo) {
        const isPreview = response.reason === 'browser_preview'
        setConnectionState(isPreview ? 'preview' : 'unconfigured')
        setConnectionNote(isPreview ? '网页预览未连接平台 AI' : '平台 DeepSeek 暂未就绪')
        revealAssistantReply(isPreview
          ? '当前是网页预览，没有连接平台 AI；请在 Windows 桌面版中使用小饭。'
          : '平台 DeepSeek 暂未就绪，请稍后再试或联系管理员检查后台密钥池。')
      } else if (typeof response.content === 'string' && response.content.trim()) {
        setConnectionState('connected')
        setConnectionNote(`${response.provider} · ${response.model} · 本次请求成功`)
        revealAssistantReply(response.content)
      } else {
        setConnectionState('error')
        setConnectionNote('AI 返回内容异常')
        revealAssistantReply('真实 AI 没有返回有效内容，请稍后重试或检查 AI 设置。')
      }
    } catch {
      setConnectionState('error')
      setConnectionNote('平台 AI 请求异常')
      setMessages((current) => [...current, { role: 'assistant', content: '锅里刚刚冒了点小状况，AI 暂时没接上。你可以稍后再试，现有菜单不会受影响。' }])
      setIsThinking(false)
    }
  }

  return (
      <div className={`assistant-panel ai-status-${connectionState}`}>
      <div className="assistant-head"><div className="assistant-avatar">饭<i /></div><div><strong>小饭 AI</strong><span><i /> {connectionState === 'connected' ? 'DeepSeek 在线' : connectionState === 'configured' ? '平台 AI 已就绪' : connectionState === 'checking' ? '正在检查连接' : connectionState === 'error' ? '连接异常' : '平台 AI 未就绪'} · 只聊吃饭</span></div><button onClick={onClose}><X size={19} /></button></div>
      <div className="assistant-context"><span>{module.emoji}</span><p>已进入 <strong>{module.name}</strong><br /><small>回答会结合近三天记录与当前场景</small></p><button className="assistant-configure" onClick={onConfigureAi} title="查看 AI 服务"><ShieldCheck size={16} /><small>{connectionNote}</small></button></div>
      <div className="chat-scroll">
        {messages.map((message, index) => <div key={index} className={`chat-message ${message.role}`}><span>{message.role === 'assistant' ? '饭' : '我'}</span><p>{message.content}</p></div>)}
        {isThinking && <div className="chat-message assistant"><span>饭</span><p className="typing"><i /><i /><i /></p></div>}
        <div ref={endRef} />
      </div>
      {messages.length < 3 && <div className="quick-questions">{quickQuestions.map((question) => <button key={question} onClick={() => sendMessage(question)}>{question}</button>)}</div>}
      <div className="chat-input"><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage() } }} placeholder="问问今晚吃什么，或者冰箱剩菜怎么救…" /><button onClick={() => sendMessage()}><Send size={18} /></button></div>
      <small className="ai-note">AI 建议仅作饮食参考，疾病治疗请听医生的</small>
    </div>
  )
}

function ModalShell({ children, onClose, className = '' }) {
  const modalRef = useRef(null)

  useEffect(() => {
    const modal = modalRef.current
    const preferredField = modal?.querySelector('input:not([disabled]), textarea:not([disabled]), select:not([disabled])')
    const firstControl = modal?.querySelector('button:not([disabled]), [tabindex]:not([tabindex="-1"])')
    window.requestAnimationFrame(() => (preferredField || firstControl)?.focus())
  }, [])

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = [...modalRef.current.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter((element) => element.getClientRects().length > 0)
    if (!focusable.length) return
    const currentIndex = focusable.indexOf(document.activeElement)
    const direction = event.shiftKey ? -1 : 1
    const nextIndex = currentIndex < 0
      ? (event.shiftKey ? focusable.length - 1 : 0)
      : (currentIndex + direction + focusable.length) % focusable.length
    const nextControl = focusable[nextIndex]
    event.preventDefault()
    nextControl.focus()
    if (nextControl.matches('input, textarea') && nextControl.value) {
      window.requestAnimationFrame(() => {
        try {
          nextControl.select()
        } catch {}
      })
    }
  }

  return <div className="modal-backdrop" onMouseDown={onClose}><div ref={modalRef} className={`modal-card ${className}`} role="dialog" aria-modal="true" onKeyDown={handleKeyDown} onMouseDown={(event) => event.stopPropagation()}>{children}</div></div>
}

function MembershipModal({ onClose, onActivate, onToast }) {
  const [plan, setPlan] = useState('year')
  return (
    <ModalShell onClose={onClose} className="membership-modal">
      <button className="modal-close" onClick={onClose}><X size={20} /></button>
      <div className="membership-visual"><span>🥘</span><i>✨</i><strong>饭桌上的<br />全能队友</strong></div>
      <div className="membership-content"><span className="pro-label"><Sparkles size={14} /> 好吃的今天 PRO</span><h2>让每一顿，都更懂你</h2><p>三种进阶场景、专属营养分析和无限 AI 问答，一顿饭钱照顾整月餐桌。</p>
        <div className="feature-list"><span><CheckCircle2 size={17} /> 家庭、乐龄、健身场景全解锁</span><span><CheckCircle2 size={17} /> 每周食谱与营养报告无限生成</span><span><CheckCircle2 size={17} /> DeepSeek 专属营养顾问随时问</span></div>
        <div className="price-options">
          <button className={plan === 'month' ? 'selected' : ''} onClick={() => setPlan('month')}><span>连续包月</span><strong>¥29.99<small>/月</small></strong><em>随时可取消</em></button>
          <button className={plan === 'year' ? 'selected hot' : 'hot'} onClick={() => setPlan('year')}><i>🔥 HOT · 省 ¥159.89</i><span>年度饭搭子</span><strong>¥199.99<small>/年</small></strong><em>每天只要 ¥0.55</em></button>
        </div>
        <button className="pay-button" onClick={() => { onToast(`已选择${plan === 'year' ? '年度' : '月度'}方案，支付功能为演示模式`); onActivate() }}>先免费体验 7 天 <ChevronRight size={18} /></button>
        <div className="pay-methods"><span>安全支付</span><i className="wechat">微</i> 微信支付 <i className="alipay">支</i> 支付宝 <ShieldCheck size={14} /></div>
      </div>
    </ModalShell>
  )
}

function FamilySetupModal({ onClose, onFinish }) {
  const [members, setMembers] = useState([
    { role: '爸爸', icon: '👨🏻', age: '35–44 岁' },
    { role: '妈妈', icon: '👩🏻', age: '35–44 岁' },
    { role: '女儿', icon: '👧🏻', age: '7–12 岁' },
    { role: '儿子', icon: '👦🏻', age: '3–6 岁' },
  ])
  return (
    <ModalShell onClose={onClose} className="family-modal">
      <button className="modal-close" onClick={onClose}><X size={20} /></button>
      <div className="family-modal-head"><span>👨‍👩‍👧‍👦</span><div><small>先认识一下你的餐桌</small><h2>家里有几位饭友？</h2><p>不用姓名和身份信息，只为分量与营养更合适。</p></div></div>
      <div className="member-list">
        {members.map((member, index) => <div key={`${member.role}-${index}`} className="member-row"><span className="member-face">{member.icon}</span><input value={member.role} onChange={(event) => setMembers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, role: event.target.value } : item))} /><select value={member.age} onChange={(event) => setMembers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, age: event.target.value } : item))}><option>3–6 岁</option><option>7–12 岁</option><option>13–17 岁</option><option>18–34 岁</option><option>35–44 岁</option><option>45–59 岁</option><option>60 岁以上</option></select><button onClick={() => setMembers((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X size={16} /></button></div>)}
      </div>
      <button className="add-member" onClick={() => setMembers((current) => [...current, { role: '家庭成员', icon: '🙂', age: '18–34 岁' }])}><Plus size={16} /> 再加一位</button>
      <label className="allergy-input"><span>有没有需要避开的食物？</span><input placeholder="比如：花生过敏、不吃香菜（可不填）" /></label>
      <div className="privacy-note"><ShieldCheck size={17} /><span>这些信息只保存在你的设备上，不涉及具体个人身份。</span></div>
      <button className="primary-full" onClick={onFinish}>开启全家好好吃饭计划 <ArrowRight size={17} /></button>
    </ModalShell>
  )
}

function MealEditor({ meal, onClose, onSave }) {
  const [draft, setDraft] = useState(meal)
  function update(field, value) { setDraft((current) => ({ ...current, [field]: value })) }
  return (
    <ModalShell onClose={onClose} className="meal-modal">
      <button className="modal-close" onClick={onClose}><X size={20} /></button>
      <span className="modal-eyebrow">EDIT YOUR MEAL</span><h2>给{draft.type}换个新花样</h2><p className="modal-lead">吃饭不是做数学题，大致靠谱就很好。</p>
      <div className="form-grid"><label><span>餐次</span><select value={draft.type} onChange={(event) => update('type', event.target.value)}><option>早餐</option><option>午餐</option><option>晚餐</option><option>加餐</option></select></label><label><span>时间</span><input type="time" value={draft.time} onChange={(event) => update('time', event.target.value)} /></label><label className="wide"><span>菜品名称</span><input value={draft.title} onChange={(event) => update('title', event.target.value)} /></label><label className="wide"><span>食材与用量</span><textarea value={draft.description} onChange={(event) => update('description', event.target.value)} /></label><label><span>热量 kcal</span><input type="number" value={draft.kcal} onChange={(event) => update('kcal', Number(event.target.value))} /></label><label><span>蛋白质 g</span><input type="number" value={draft.protein} onChange={(event) => update('protein', Number(event.target.value))} /></label><label className="wide"><span>实际饭量（1.0 = 标准份）</span><input type="number" min="0.5" max="2" step="0.05" value={draft.portionMultiplier ?? 1} onChange={(event) => update('portionMultiplier', Number(event.target.value))} /></label></div>
      <div className="modal-actions"><button className="soft-button" onClick={onClose}>算了，原来的也挺香</button><button className="primary-button" onClick={() => onSave(draft)}><Check size={17} /> 就这么安排</button></div>
    </ModalShell>
  )
}

function SettingsModal({ account: activeAccount, initialSection = 'account', isPro, onClose, onOpenReadme }) {
  const [section, setSection] = useState(initialSection)
  const [aiConfig, setAiConfig] = useState(managedAiDefaults)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiVerified, setAiVerified] = useState(false)
  const [aiFeedback, setAiFeedback] = useState({ type: '', message: '' })

  useEffect(() => {
    let active = true
    async function loadAiConfig() {
      if (!window.mealDesktop?.getAiConfig) {
        if (active) setAiFeedback({ type: 'warning', message: '网页预览不连接平台 AI，请在 Windows 桌面版中查看。' })
        return
      }
      try {
        const config = await window.mealDesktop.getAiConfig()
        if (active && config) setAiConfig(config)
      } catch {
        if (active) setAiFeedback({ type: 'error', message: '平台 AI 状态读取失败，请稍后重试。' })
      }
    }
    loadAiConfig()
    return () => { active = false }
  }, [])

  async function testManagedAi() {
    if (!window.mealDesktop?.testAiConfig || aiBusy) return
    setAiBusy(true)
    setAiVerified(false)
    setAiFeedback({ type: '', message: '正在请后台分配 DeepSeek 通道并测试…' })
    try {
      const result = await window.mealDesktop.testAiConfig()
      if (!result?.ok) throw new Error(result?.error || '连接测试失败。')
      setAiVerified(true)
      setAiConfig((current) => ({ ...current, configured: true, ready: true, configurationIssue: '' }))
      setAiFeedback({ type: 'success', message: `${result.provider} · ${result.model} 后台通道正常，可以开聊啦！` })
    } catch (error) {
      setAiFeedback({ type: 'error', message: error instanceof Error ? error.message : '平台 AI 检测失败。' })
    } finally {
      setAiBusy(false)
    }
  }

  const account = activeAccount || readDemoAccount()
  const accountLabel = account?.displayName || (account?.loginType === 'phone' ? account.phone : account?.loginType === 'email' ? account.email : account?.provider || '尚未登录')
  const settingsSections = [
    { id: 'account', label: '账号信息', icon: UserRound },
    { id: 'membership', label: '会员信息', icon: WalletCards },
    { id: 'ai', label: 'AI 顾问', icon: Sparkles },
    { id: 'help', label: '帮助中心', icon: MessageCircleMore },
  ]
  return (
    <ModalShell onClose={onClose} className="settings-modal">
      <button className="modal-close" onClick={onClose}><X size={20} /></button>
      <div className="settings-title"><span><Settings size={20} /></span><div><small>SETTINGS & HELP</small><h2>把你的饭碗设置好</h2></div></div>
      <div className="settings-layout"><nav>{settingsSections.map((item) => { const Icon = item.icon; return <button key={item.id} className={section === item.id ? 'active' : ''} onClick={() => setSection(item.id)}><Icon size={17} />{item.label}<ChevronRight size={14} /></button> })}</nav><section>
        {section === 'account' && <div className="settings-section"><span className="settings-kicker">ACCOUNT</span><h3>账号信息</h3><div className="account-summary"><span className="avatar">小</span><div><strong>{account ? '已登录饭友' : '游客饭友'}</strong><small>{accountLabel}</small></div><i>{account ? '已验证' : '未登录'}</i></div><div className="settings-rows"><span><em>登录方式</em><strong>{account?.loginType === 'phone' ? '手机验证码 + 密码' : account?.loginType === 'email' ? '邮箱 + 密码' : account?.provider || '—'}</strong></span><span><em>本地数据</em><strong>保存在当前设备</strong></span><span><em>账号安全</em><strong>滑块验证已开启</strong></span></div></div>}
        {section === 'membership' && <div className="settings-section"><span className="settings-kicker">MEMBERSHIP</span><h3>会员信息</h3><div className={`membership-status ${isPro ? 'is-pro' : ''}`}><span>{isPro ? '👑' : '🍚'}</span><div><small>当前方案</small><strong>{isPro ? 'Pro 饭搭子' : '普通饭友 · 免费版'}</strong><p>{isPro ? '家庭、乐龄、健身模式均已解锁' : '日常模式永久免费，升级可解锁三种专属场景'}</p></div></div><div className="settings-rows"><span><em>月度会员</em><strong>¥29.99 / 月</strong></span><span><em>年度会员</em><strong>¥199.99 / 年 · HOT</strong></span><span><em>自动续费</em><strong>{isPro ? '演示模式' : '未开启'}</strong></span></div></div>}
        {section === 'ai' && (
          <div className="settings-section ai-settings-section">
            <span className="settings-kicker">MANAGED DEEPSEEK</span>
            <h3>DeepSeek 已由平台统一接管</h3>
            <div className={`ai-connection-card ${aiVerified ? 'connected' : aiConfig.configured ? 'configured' : ''}`}>
              <span>{aiVerified ? '⚡' : aiConfig.configured ? '🛡️' : '🔌'}</span>
              <div>
                <strong>{aiVerified ? 'DeepSeek 后台通道正常' : aiConfig.configured ? '平台 DeepSeek 已就绪' : '平台 AI 暂未就绪'}</strong>
                <small>{aiConfig.configurationIssue || '系统会为每位用户自动分配后台密钥，无需填写任何 API Key。'}</small>
              </div>
              <i>{aiVerified ? '已验证' : aiConfig.configured ? '托管中' : '待后台配置'}</i>
            </div>
            <div className="ai-managed-grid">
              <span><small>唯一服务商</small><strong>DeepSeek</strong></span>
              <span><small>固定模型</small><strong>deepseek-chat</strong></span>
              <span><small>密钥来源</small><strong>后台密钥池</strong></span>
              <span><small>分配方式</small><strong>按用户自动分配</strong></span>
            </div>
            <div className="ai-security-note"><ShieldCheck size={16} /><span>用户端不会读取、保存或显示 DeepSeek API Key。后台会为匿名用户标识稳定分配一条通道，并在密钥限流或失效时自动切换。</span></div>
            {aiFeedback.message && <div className={`ai-feedback ${aiFeedback.type}`}>{aiFeedback.message}</div>}
            <div className="ai-config-actions"><button className="primary-button" onClick={testManagedAi} disabled={aiBusy}>{aiBusy ? '检测中…' : '检测平台 AI'}</button></div>
          </div>
        )}
        {section === 'help' && <div className="settings-section help-section"><span className="settings-kicker">HELP CENTER</span><h3>有问题，别饿着</h3><p>README 里包含运行方法、八大菜系爬取脚本、AI 接入配置、数据库结构和健康合规说明。</p><button className="readme-button" onClick={onOpenReadme}><span><MessageCircleMore size={20} /></span><div><strong>打开 README.md 帮助文档</strong><small>使用说明 · 数据脚本 · 常见问题</small></div><ArrowRight size={17} /></button><div className="help-note"><ShieldCheck size={16} /><span>营养建议只作生活参考，疾病治疗请咨询专业医生。</span></div></div>}
      </section></div>
    </ModalShell>
  )
}

function ProfileModal({ onClose }) {
  const [activity, setActivity] = useState(2)
  return (
    <ModalShell onClose={onClose} className="profile-modal">
      <button className="modal-close" onClick={onClose}><X size={20} /></button>
      <span className="modal-eyebrow">MY FOOD PROFILE</span><h2>让我更懂你的胃</h2><p className="modal-lead">只记饮食偏好，不记你的秘密。</p>
      <div className="profile-avatar-row"><span>小</span><div><strong>小饭同学</strong><small>普通饭友 · 已好好吃饭 7 天</small></div><button>换头像</button></div>
      <div className="form-grid"><label><span>年龄段</span><select defaultValue="25"><option value="18">18–24 岁</option><option value="25">25–34 岁</option><option>35–44 岁</option><option>45–59 岁</option><option>60 岁以上</option></select></label><label><span>生理性别</span><select defaultValue="female"><option value="female">女</option><option value="male">男</option><option value="none">不提供</option></select></label><label><span>身高 cm</span><input defaultValue="165" /></label><label><span>体重 kg</span><input defaultValue="55" /></label></div>
      <div className="activity-select"><span>日常活动量</span><div>{['久坐办公', '偶尔运动', '规律运动', '运动达人'].map((item, index) => <button className={activity === index ? 'selected' : ''} onClick={() => setActivity(index)} key={item}>{item}</button>)}</div></div>
      <label className="allergy-input"><span>饮食目标与健康情况</span><input placeholder="比如：控糖、轻微乳糖不耐、少盐" /></label>
      <button className="primary-full" onClick={onClose}>保存我的饮食档案 <Check size={17} /></button>
    </ModalShell>
  )
}

function LoginModal({ onClose, onToast, onAuthenticated }) {
  const [mode, setMode] = useState('login')
  const [loginType, setLoginType] = useState('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [captchaPassed, setCaptchaPassed] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')
  const [sliderPosition, setSliderPosition] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState('')
  const [codeHint, setCodeHint] = useState('')
  const sliderRef = useRef(null)

  useEffect(() => {
    if (!countdown) return undefined
    const timer = window.setInterval(() => setCountdown((current) => current - 1), 1000)
    return () => window.clearInterval(timer)
  }, [countdown])

  useEffect(() => {
    if (!isDragging) return undefined
    function moveSlider(event) {
      if (!sliderRef.current) return
      const bounds = sliderRef.current.getBoundingClientRect()
      const handleWidth = 45
      const nextPosition = Math.max(0, Math.min(bounds.width - handleWidth, event.clientX - bounds.left - handleWidth / 2))
      setSliderPosition(nextPosition)
      if (nextPosition >= bounds.width - handleWidth - 3) {
        const generatedCaptchaToken = window.crypto?.randomUUID?.() || `captcha-${Date.now()}-${Math.random().toString(16).slice(2)}`
        setCaptchaPassed(true)
        setCaptchaToken(generatedCaptchaToken)
        setIsDragging(false)
      }
    }
    function stopSlider() {
      setIsDragging(false)
    }
    window.addEventListener('pointermove', moveSlider)
    window.addEventListener('pointerup', stopSlider)
    return () => {
      window.removeEventListener('pointermove', moveSlider)
      window.removeEventListener('pointerup', stopSlider)
    }
  }, [isDragging])

  function resetCaptcha() {
    setCaptchaPassed(false)
    setCaptchaToken('')
    setSliderPosition(0)
    setError('')
  }

  function switchMode(nextMode) {
    setMode(nextMode)
    setCode('')
    setCodeHint('')
    setCountdown(0)
    setError('')
    resetCaptcha()
  }

  function switchLoginType(nextType) {
    setLoginType(nextType)
    setCode('')
    setCodeHint('')
    setCountdown(0)
    setError('')
    resetCaptcha()
  }

  function currentIdentifier() {
    return loginType === 'phone' ? phone : email
  }

  async function handleGetCode() {
    if (!captchaPassed || !captchaToken) {
      setError('请先把滑块拖到最右边，再获取验证码。')
      return
    }
    if (countdown || isBusy) return
    const identifier = currentIdentifier()
    if (loginType === 'phone' && !/^1\d{10}$/.test(phone)) {
      setError('请输入正确的 11 位手机号，再来获取验证码。')
      return
    }
    if (loginType === 'email' && !/^[^\s@]+@(163|126|yeah|qq|foxmail)\.(com|net)$/.test(email.trim().toLowerCase())) {
      setError('目前支持 163、126、yeah、QQ 或 Foxmail 邮箱。')
      return
    }
    setIsBusy(true)
    setError('')
    try {
      const payload = await sendVerificationCode({
        channel: loginType,
        identifier,
        purpose: mode,
        captchaToken,
      })
      const retryAfter = Number(payload?.retryAfter || 60)
      setCountdown(retryAfter)
      if (payload?.devCode) {
        setCodeHint(`开发环境验证码：${payload.devCode}`)
        onToast(`验证码已生成：${payload.devCode}`)
      } else {
        setCodeHint('验证码已发送，请查收短信或邮件。')
        onToast('验证码已发送，记得在 5 分钟内填好。')
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '验证码发送失败，请稍后再试。')
    } finally {
      setIsBusy(false)
    }
  }

  async function handleSubmit() {
    if (!captchaPassed || !captchaToken) {
      setError('请先完成滑块验证，证明你不是一只偷偷登录的机器人。')
      return
    }
    const identifier = currentIdentifier()
    if (loginType === 'phone' && !/^1\d{10}$/.test(phone)) {
      setError('请输入正确的 11 位手机号。')
      return
    }
    if (loginType === 'email' && !/^[^\s@]+@(163|126|yeah|qq|foxmail)\.(com|net)$/.test(email.trim().toLowerCase())) {
      setError('请输入有效的 163、QQ 或 Foxmail 邮箱。')
      return
    }
    if (password.length < 6) {
      setError('密码至少 6 位，吃饭可以随意，账号安全不能随意。')
      return
    }
    if (mode === 'register' && code.length !== 6) {
      setError('注册需要先获取并填写 6 位验证码。')
      return
    }
    if (mode === 'register' && password !== confirmPassword) {
      setError('两次输入的密码不一致，再检查一下吧。')
      return
    }
    setIsBusy(true)
    setError('')
    try {
      const payload = mode === 'register'
        ? await registerAccount({
          channel: loginType,
          identifier,
          password,
          code,
          captchaToken,
          displayName,
        })
        : await loginAccount({
          channel: loginType,
          identifier,
          password,
          code: loginType === 'phone' ? code : '',
          captchaToken,
        })
      onAuthenticated(payload)
      onToast(mode === 'register' ? '注册成功，已经自动登录，开饭吧！' : '登录成功，今天也要记得吃早餐！')
    } catch (caughtError) {
      if (caughtError?.code === 'not_registered') {
        setError('这个账号还没有注册，下面有“还没有账号？点我注册”。')
      } else if (caughtError?.code === 'account_exists') {
        setError('这个账号已经注册过了，切换到登录即可。')
        setMode('login')
      } else {
        setError(caughtError instanceof Error ? caughtError.message : '账号服务暂时不可用，请稍后再试。')
      }
    } finally {
      setIsBusy(false)
    }
  }

  async function handleSocialLogin(provider) {
    if (!captchaPassed) {
      setError(`请先完成滑块验证，再使用${provider}登录。`)
      return
    }
    setIsBusy(true)
    setError('')
    try {
      const payload = await startSocialLogin(provider === '微信' ? 'wechat' : 'qq')
      if (payload?.authorizationUrl) {
        window.open(payload.authorizationUrl, '_blank', 'noopener,noreferrer')
        onToast(`${provider}授权页已打开，完成授权后返回应用。`)
      } else {
        setError(payload?.message || `${provider}登录暂未配置。`)
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : `${provider}登录暂未配置。`)
    } finally {
      setIsBusy(false)
    }
  }

  const showCodeField = loginType === 'phone' || mode === 'register'
  return (
    <ModalShell onClose={onClose} className="login-modal">
      <button className="modal-close" onClick={onClose}><X size={20} /></button>
      <div className="login-brand"><div className="brand-mark"><span>吃</span><i /></div><h2>{mode === 'login' ? '欢迎回来，开饭吧' : '注册饭友，马上开饭'}</h2><p>{mode === 'login' ? '账号、密码和滑块都校验通过，菜单才会为你打开。' : '注册只收必要信息，验证码确认是你本人。'}</p></div>
      <div className="login-tabs"><button className={loginType === 'phone' ? 'active' : ''} onClick={() => switchLoginType('phone')}>手机号</button><button className={loginType === 'email' ? 'active' : ''} onClick={() => switchLoginType('email')}>邮箱</button></div>
      <div className="login-fields">
        {mode === 'register' && <label><input value={displayName} onChange={(event) => setDisplayName(event.target.value.slice(0, 40))} placeholder="昵称（可选）" /></label>}
        {loginType === 'phone'
          ? <label><span>+86</span><input value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="请输入手机号" inputMode="numeric" /></label>
          : <label><input value={email} onChange={(event) => setEmail(event.target.value.trim())} placeholder="163 / QQ / Foxmail 邮箱" type="email" autoComplete="email" /></label>}
        {showCodeField && <label><input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6 位验证码" inputMode="numeric" autoComplete="one-time-code" /><button disabled={Boolean(countdown) || isBusy} onClick={handleGetCode}>{countdown ? `${countdown}s 后重发` : '获取验证码'}</button></label>}
        <label><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder={mode === 'register' ? '设置密码（至少 6 位）' : '请输入密码'} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} /></label>
        {mode === 'register' && <label><input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type="password" placeholder="再输入一次密码" autoComplete="new-password" /></label>}
      </div>
      {codeHint && <p className="login-code-hint">{codeHint}</p>}
      <div className="slider-captcha" ref={sliderRef}><div className="slider-track-fill" style={{ width: `${sliderPosition + 45}px` }} /><span className={`slider-handle ${captchaPassed ? 'passed' : ''}`} style={{ left: `${sliderPosition}px` }} onPointerDown={(event) => { event.preventDefault(); if (!captchaPassed && !isBusy) setIsDragging(true) }}><ChevronRight size={18} /><ChevronRight size={18} /></span><p>{captchaPassed ? '验证成功，可以继续啦' : '按住滑块，拖到最右边'}</p></div>
      {error && <p className="login-error"><X size={13} /> {error}</p>}
      <button className="primary-full" onClick={handleSubmit} disabled={isBusy}>{isBusy ? '正在校验…' : mode === 'login' ? '登录' : '注册账号'} <ChevronRight size={17} /></button>
      <div className="other-login"><span>其他方式</span><div><button className="wechat" onClick={() => handleSocialLogin('微信')} disabled={isBusy}>微</button><button className="qq" onClick={() => handleSocialLogin('QQ')} disabled={isBusy}>Q</button></div></div>
      <p className="switch-auth">{mode === 'login' ? <>还没有账号？<button onClick={() => switchMode('register')}>点我注册</button></> : <>已经有账号？<button onClick={() => switchMode('login')}>返回登录</button></>}</p>
      <small className="terms">继续即代表同意《用户协议》和《隐私政策》</small>
    </ModalShell>
  )
}

function ShareModal({ onClose, onToast }) {
  return (
    <ModalShell onClose={onClose} className="share-modal">
      <button className="modal-close" onClick={onClose}><X size={20} /></button>
      <span className="modal-eyebrow">SHARE THE GOOD TASTE</span><h2>把认真吃饭分享出去</h2><p className="modal-lead">已经为你生成了一张“不馋人，只鼓励人”的餐食卡片。</p>
      <div className="share-preview"><div className="share-logo">好吃的今天 <span>吃</span></div><strong>我的本周吃饭成绩单</strong><div className="share-score"><span>A-</span><p>好好吃饭 7 天<br /><em>比上周进步 8 分</em></p></div><div className="share-food">🥦 🥚 🍚 🥕 🥛</div><small>每一口，都是认真生活的证据。</small></div>
      <div className="share-options"><button onClick={() => { onToast('分享卡片已复制，可粘贴到微信'); onClose() }}><span className="wechat">微</span>微信好友</button><button onClick={() => { onToast('分享卡片已生成，可发布朋友圈'); onClose() }}><span className="moments">◉</span>朋友圈</button><button onClick={() => { onToast('分享卡片已复制，可发送到 QQ'); onClose() }}><span className="qq">Q</span>QQ 好友</button><button onClick={() => { onToast('高清图片已保存到下载目录'); onClose() }}><span className="save">↓</span>保存图片</button></div>
    </ModalShell>
  )
}

export default App
