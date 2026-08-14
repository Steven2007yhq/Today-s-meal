import { Component, useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import {
  Activity,
  Apple,
  ArrowLeft,
  ArrowRight,
  Beef,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Dumbbell,
  FileDown,
  Flame,
  Heart,
  Keyboard,
  Leaf,
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
} from 'lucide-react'
import { Sidebar, Topbar } from './components/AppNavigation'
import elderTeaImage from './assets/lifestyle/elder-tea.webp'
import familyDinnerImage from './assets/lifestyle/family-dinner.webp'
import fitnessTrainingImage from './assets/lifestyle/fitness-training.webp'
import { ElderProfileModal, FamilyProfileModal } from './components/DietaryProfileEditors'
import { FitnessPlanModal, FitnessTrainingPlanner } from './components/FitnessTrainingPlanner'
import { ModalShell } from './components/ModalShell'
import { managedAiDefaults, quickQuestions, relationNodeLayout } from './data/appContent'
import {
  buildElderProfileContext,
  buildFamilyProfileContext,
  createDefaultElderProfile,
  createDefaultFamilyProfile,
  ELDER_CARE_GOALS,
  elderProfileSummary,
  familyProfileSummary,
  normalizeElderProfile,
  normalizeFamilyProfile,
} from './data/dietaryProfiles'
import { cuisineMeta, dishes } from './data/dishLibrary'
import { demoMealHistory, initialMeals, weekPlan } from './data/mealPlan'
import { buildFitnessTrainingContext, createDefaultFitnessTrainingPlan, normalizeFitnessTrainingPlan, resolveFitnessTraining } from './data/trainingPlan'
import { useFavoriteCatalog } from './hooks/useFavoriteCatalog'
import { usePreloadedImages } from './hooks/usePreloadedImages'
import { analyzeDishQuery, calculateDishPortion, getDishGraphStats, getRelatedDishes, searchDishes } from './services/dishEngine'
import { listCatalogDishes, readCatalogFacets, readCatalogRelations } from './services/catalogApi'
import { loginAccount, logoutAccount, readCurrentAuthSession, registerAccount, sendVerificationCode, startSocialLogin } from './services/authApi'
import {
  completeDevelopmentOrder,
  createBillingOrder,
  listBillingOrders,
  listBillingProducts,
  readBillingOrder,
  readMembership,
  reconcileBillingOrder,
} from './services/billingApi'
import { readDemoAccount } from './services/session'
import { fetchDishImages } from './services/imageApi'
import { exportRecipeToPdf, exportWeeklyPlanToPdf } from './services/pdfExport'
import { readJsonStorage, STORAGE_KEYS, writeJsonStorage } from './services/browserStorage'
import { buildMonthCells, calendarDateKey, dateFromCalendarKey, mealsForCalendarDate, sameCalendarDate } from './services/mealPlanner'
import { resolveKeyboardShortcut } from './services/keyboardShortcuts'
import { createViewHistory, getCurrentView, moveViewHistory, pushView } from './services/viewHistory'
import { getChinaToday } from './utils/chinaTime'

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

const browserHelpDocuments = Object.freeze({
  'user-guide': '/docs/hao-chi-de-jin-tian-user-guide.pdf',
  'keyboard-shortcuts': '/docs/hao-chi-de-jin-tian-keyboard-shortcuts.pdf',
})

function App() {
  const [viewHistory, setViewHistory] = useState(() => createViewHistory({ module: 'standard', page: 'today' }))
  const { module: activeModule, page: activePage } = getCurrentView(viewHistory)
  const [meals, setMeals] = useState(initialMeals)
  const [showAssistant, setShowAssistant] = useState(false)
  const [showMembership, setShowMembership] = useState(false)
  const [showFamilySetup, setShowFamilySetup] = useState(false)
  const [showElderProfile, setShowElderProfile] = useState(false)
  const [showFitnessPlan, setShowFitnessPlan] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settingsInitialSection, setSettingsInitialSection] = useState('account')
  const [showShare, setShowShare] = useState(false)
  const [searchFocusRequest, setSearchFocusRequest] = useState(0)
  const [editingMeal, setEditingMeal] = useState(null)
  const [editingDateKey, setEditingDateKey] = useState(null)
  const [pendingModule, setPendingModule] = useState(null)
  const [membership, setMembership] = useState({ isPro: false, plan: 'free', validUntil: null, source: 'server' })
  const [toast, setToast] = useState('')
  const [account, setAccount] = useState(() => readDemoAccount())
  const tabNavigationRef = useRef(false)
  const membershipReminderRef = useRef('')
  const [mealHistory, setMealHistory] = useState(() => {
    const savedHistory = readJsonStorage(STORAGE_KEYS.mealHistory, demoMealHistory, Array.isArray)
    return savedHistory.length ? savedHistory : demoMealHistory
  })
  const [calendarMealsByDate, setCalendarMealsByDate] = useState(() => {
    return readJsonStorage(
      STORAGE_KEYS.calendarMeals,
      {},
      (value) => value && typeof value === 'object' && !Array.isArray(value),
    )
  })
  const [fitnessTrainingPlan, setFitnessTrainingPlan] = useState(() => {
    return normalizeFitnessTrainingPlan(readJsonStorage(
      STORAGE_KEYS.fitnessTrainingPlan,
      createDefaultFitnessTrainingPlan(),
      (value) => value && typeof value === 'object' && Array.isArray(value.days),
    ))
  })
  const [familyProfile, setFamilyProfile] = useState(() => {
    return normalizeFamilyProfile(readJsonStorage(
      STORAGE_KEYS.familyProfile,
      createDefaultFamilyProfile(),
      (value) => value && typeof value === 'object' && Array.isArray(value.members),
    ))
  })
  const [elderProfile, setElderProfile] = useState(() => {
    return normalizeElderProfile(readJsonStorage(
      STORAGE_KEYS.elderProfile,
      createDefaultElderProfile(),
      (value) => value && typeof value === 'object',
    ))
  })

  const isPro = membership.isPro

  const selectedModule = modules.find((item) => item.id === activeModule)
  const todayTraining = useMemo(() => resolveFitnessTraining(fitnessTrainingPlan, getChinaToday()), [fitnessTrainingPlan])
  const familyReady = familyProfile.completed

  function navigateView(nextView) {
    setViewHistory((current) => pushView(current, { ...getCurrentView(current), ...nextView }))
  }

  function navigatePage(page) {
    navigateView({ page })
  }

  function goBack() {
    setViewHistory((current) => moveViewHistory(current, -1))
  }

  function goForward() {
    setViewHistory((current) => moveViewHistory(current, 1))
  }

  function openSearch() {
    navigatePage('library')
    setSearchFocusRequest((current) => current + 1)
  }

  function openSettings(section = 'account') {
    setSettingsInitialSection(section)
    setShowSettings(true)
  }

  async function openHelpDocument(documentId) {
    try {
      if (window.mealDesktop?.openHelpDocument) {
        const result = await window.mealDesktop.openHelpDocument(documentId)
        if (!result?.ok) throw new Error(result?.error || '文档打开失败')
        return
      }

      const documentUrl = browserHelpDocuments[documentId]
      if (!documentUrl) throw new Error('未找到对应说明文档')
      window.open(documentUrl, '_blank', 'noopener,noreferrer')
    } catch (error) {
      setToast(error instanceof Error ? error.message : '说明文档打开失败')
    }
  }

  useEffect(() => {
    function handleAppShortcut(event) {
      const action = resolveKeyboardShortcut(event)
      if (!action || (event.target.closest?.('[role="dialog"]') && action.type !== 'close-overlay')) return

      event.preventDefault()
      if (action.type === 'history') {
        if (action.direction === 'back') goBack()
        else goForward()
      } else if (action.type === 'page') {
        navigatePage(action.target)
      } else if (action.type === 'module') {
        chooseModule(modules.find((item) => item.id === action.target))
      } else if (action.type === 'search') {
        setShowAssistant(false)
        openSearch()
      } else if (action.type === 'assistant') {
        setShowAssistant((current) => !current)
      } else if (action.type === 'settings') {
        setShowAssistant(false)
        openSettings('account')
      } else if (action.type === 'document') {
        openHelpDocument(action.target)
      } else if (action.type === 'close-overlay' && showAssistant) {
        setShowAssistant(false)
      }
    }

    window.addEventListener('keydown', handleAppShortcut)
    return () => window.removeEventListener('keydown', handleAppShortcut)
  }, [familyReady, isPro, showAssistant])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    let active = true
    readCurrentAuthSession().then((payload) => {
      if (!active) return
      setAccount(payload?.user || null)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    if (!account) {
      setMembership({ isPro: false, plan: 'free', validUntil: null, source: 'server' })
      return () => { active = false }
    }
    readMembership()
      .then((payload) => {
        if (active && payload?.membership) setMembership(payload.membership)
      })
      .catch(() => {
        if (active) setMembership({ isPro: false, plan: 'free', validUntil: null, source: 'server' })
      })
    return () => { active = false }
  }, [account?.id])

  useEffect(() => {
    if (!membership?.isPro || !membership.reminder?.message) return
    const reminderKey = `${membership.validUntil}:${membership.reminder.daysRemaining}`
    if (membershipReminderRef.current === reminderKey) return
    membershipReminderRef.current = reminderKey
    setToast(`${membership.reminder.message} 可在设置中的会员信息查看续费记录。`)
  }, [membership])

  useEffect(() => {
    writeJsonStorage(STORAGE_KEYS.mealHistory, mealHistory.slice(-180))
  }, [mealHistory])

  useEffect(() => {
    writeJsonStorage(STORAGE_KEYS.calendarMeals, calendarMealsByDate)
  }, [calendarMealsByDate])

  useEffect(() => {
    writeJsonStorage(STORAGE_KEYS.fitnessTrainingPlan, fitnessTrainingPlan)
  }, [fitnessTrainingPlan])

  useEffect(() => {
    writeJsonStorage(STORAGE_KEYS.familyProfile, familyProfile)
  }, [familyProfile])

  useEffect(() => {
    writeJsonStorage(STORAGE_KEYS.elderProfile, elderProfile)
  }, [elderProfile])

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

  function updateFitnessPlan(nextPlan, message = '') {
    const normalized = normalizeFitnessTrainingPlan(nextPlan)
    setFitnessTrainingPlan(normalized)
    if (message) setToast(message)
  }

  function changeTodayTrainingPlan(nextPlan) {
    const nextTraining = resolveFitnessTraining(nextPlan, getChinaToday())
    updateFitnessPlan(nextPlan, nextTraining.isRestDay
      ? '今天已改为休息恢复，小饭会按休息日调整建议。'
      : `今天已安排 ${nextTraining.sessions.length} 项训练，共 ${nextTraining.totalDurationMinutes} 分钟，小饭会综合计算补给。`)
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
    navigateView({ module: moduleItem.id, page: 'today' })
  }

  function finishMembershipPurchase(nextMembership) {
    if (!nextMembership?.isPro) return
    setMembership(nextMembership)
    setShowMembership(false)
    const target = pendingModule || 'family'
    setPendingModule(null)
    if (target === 'family' && !familyReady) {
      setShowFamilySetup(true)
    } else {
      navigateView({ module: target, page: 'today' })
      setToast('Pro 会员已到账，去解锁更懂你的菜单吧！')
    }
  }

  function finishFamilySetup(nextProfile) {
    const wasReady = familyProfile.completed
    setFamilyProfile(normalizeFamilyProfile({ ...nextProfile, completed: true }))
    setShowFamilySetup(false)
    if (!wasReady) navigateView({ module: 'family', page: 'today' })
    setToast(wasReady ? '家庭档案已更新，小饭会按每位成员重新调整。' : '全家档案已就位，开饭这事交给我！')
  }

  function finishElderProfile(nextProfile) {
    setElderProfile(normalizeElderProfile({ ...nextProfile, completed: true }))
    setShowElderProfile(false)
    setToast(nextProfile.diseaseDisclosure === 'not_disclosed'
      ? '健康偏好已保存；疾病史保持私密，小饭不会推断或追问。'
      : '乐龄饮食档案已更新，小饭会按新偏好给建议。')
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
      setMembership({ isPro: false, plan: 'free', validUntil: null, source: 'server' })
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
    navigatePage('today')
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
      onNavigate={navigatePage}
      onOpenLibrary={openSearch}
      fitnessTrainingPlan={fitnessTrainingPlan}
      todayTraining={todayTraining}
      onChangeTrainingPlan={changeTodayTrainingPlan}
      onEditTrainingPlan={() => setShowFitnessPlan(true)}
      familyProfile={familyProfile}
      elderProfile={elderProfile}
      onEditFamilyProfile={() => setShowFamilySetup(true)}
      onEditElderProfile={() => setShowElderProfile(true)}
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
        onNavigate={navigatePage}
        modules={modules}
        activeModule={activeModule}
        onChooseModule={chooseModule}
        isPro={isPro}
        onOpenMembership={() => setShowMembership(true)}
        onOpenSettings={() => openSettings('account')}
      />

      <main className="main-panel">
        <Topbar
          module={selectedModule}
          canGoBack={viewHistory.index > 0}
          canGoForward={viewHistory.index < viewHistory.entries.length - 1}
          onBack={goBack}
          onForward={goForward}
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
            fitnessTrainingPlan={fitnessTrainingPlan}
            familyProfile={familyProfile}
            elderProfile={elderProfile}
            onClose={() => setShowAssistant(false)}
            onConfigureAi={() => { setShowAssistant(false); openSettings('ai') }}
          />
        </AssistantErrorBoundary>
      )}
      {showMembership && (
        <MembershipModal
          account={account}
          onClose={() => setShowMembership(false)}
          onActivate={finishMembershipPurchase}
          onRequireLogin={() => { setShowMembership(false); setShowLogin(true) }}
          onToast={setToast}
        />
      )}
      {showFamilySetup && (
        <FamilyProfileModal profile={familyProfile} isSetup={!familyProfile.completed} onClose={() => setShowFamilySetup(false)} onSave={finishFamilySetup} />
      )}
      {showElderProfile && (
        <ElderProfileModal profile={elderProfile} onClose={() => setShowElderProfile(false)} onSave={finishElderProfile} />
      )}
      {showFitnessPlan && (
        <FitnessPlanModal
          plan={fitnessTrainingPlan}
          onClose={() => setShowFitnessPlan(false)}
          onSave={(nextPlan) => {
            updateFitnessPlan(nextPlan, '本周训练计划已保存，小饭会按每天的类型、时长和强度给建议。')
            setShowFitnessPlan(false)
          }}
        />
      )}
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onToast={setToast} onAuthenticated={handleAuthenticated} />}
      {showShare && <ShareModal onClose={() => setShowShare(false)} onToast={setToast} />}
      {showSettings && <SettingsModal account={account} initialSection={settingsInitialSection} membership={membership} onMembershipChange={setMembership} onToast={setToast} onClose={() => setShowSettings(false)} onOpenDocument={openHelpDocument} />}
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

function TodayView({ module, meals, onEdit, onToggleDone, onOpenAssistant, onShare, onNavigate, onOpenLibrary, fitnessTrainingPlan, todayTraining, onChangeTrainingPlan, onEditTrainingPlan, familyProfile, elderProfile, onEditFamilyProfile, onEditElderProfile }) {
  const finishedCalories = meals.filter((meal) => meal.done).reduce((sum, meal) => sum + meal.kcal, 0)
  const totalCalories = meals.reduce((sum, meal) => sum + meal.kcal, 0)
  const familySummary = familyProfileSummary(familyProfile)
  const elderSummary = elderProfileSummary(elderProfile)
  const moduleCopy = {
    standard: { title: '早上好，今天也要认真吃饭呀', note: '根据你近 3 天的记录，今天适合「高纤 + 优质蛋白」组合。', badge: '小饭今日推荐' },
    family: {
      title: '开饭啦！把全家的幸福端上桌',
      note: `已按 ${familySummary.memberCount} 位成员、共 ${familySummary.totalPortions} 标准份来安排${familySummary.avoidanceCount ? `，并避开 ${familySummary.avoidanceCount} 项忌口` : ''}。`,
      badge: `${familySummary.memberCount} 人家庭方案`,
    },
    elder: {
      title: '慢慢吃，好好过，今天也很舒心',
      note: elderProfile.completed
        ? `已按 ${elderSummary.goalCount} 项饮食重点调整；疾病史${elderSummary.diseaseLabel === '不愿透露' ? '保持私密，不影响继续使用' : `状态为“${elderSummary.diseaseLabel}”`}。`
        : '可以独立设置进食习惯和饮食重点；疾病史不想填写时可直接选择“不愿透露”。',
      badge: elderProfile.completed ? '我的乐龄方案' : '乐龄安心方案',
    },
    fitness: {
      title: '练得漂亮，更要吃得明白',
      note: todayTraining.isRestDay
        ? '今天安排休息恢复：蛋白质保持稳定，碳水按活动量适当回落。'
        : `今天有${todayTraining.sessions.length}项训练：${todayTraining.displayName}，共 ${todayTraining.totalDurationMinutes} 分钟，小饭会综合训练量调整补给。`,
      badge: todayTraining.isRestDay ? '恢复休息日' : `${todayTraining.sessions.length} 项训练 · ${todayTraining.totalDurationMinutes} 分钟`,
    },
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
            <button className="primary-button" onClick={onOpenAssistant}><Sparkles size={17} /> {module.id === 'fitness' ? '让小饭按训练建议' : '让小饭换个方案'}</button>
            <button className="soft-button" onClick={() => onNavigate('calendar')}><CalendarDays size={17} /> 查看本周</button>
          </div>
        </div>
        {module.id === 'family' ? <FamilyIllustration members={familyProfile.members} /> : module.id === 'elder' ? <ElderIllustration /> : module.id === 'fitness' ? <FitnessIllustration /> : <FoodIllustration />}
        {module.id === 'standard' && <div className="hero-scribble">好好吃饭<br />就是头等大事</div>}
      </section>

      {module.id !== 'standard' && <ModuleSpotlight module={module} onOpenAssistant={onOpenAssistant} fitnessTrainingPlan={fitnessTrainingPlan} onChangeTrainingPlan={onChangeTrainingPlan} onEditTrainingPlan={onEditTrainingPlan} familyProfile={familyProfile} elderProfile={elderProfile} onEditFamilyProfile={onEditFamilyProfile} onEditElderProfile={onEditElderProfile} />}

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

function FamilyIllustration({ members = [] }) {
  return <div className="hero-visual lifestyle-visual family-lifestyle"><img src={familyDinnerImage} alt="东亚家庭围坐分享家常晚餐" /><i>{members.length} 位饭友，吃一桌好饭</i></div>
}

function ElderIllustration() {
  return <div className="hero-visual lifestyle-visual elder-lifestyle"><img src={elderTeaImage} alt="乐龄夫妇在家中安静品茶" /><i>清淡有味 · 岁岁安康</i></div>
}

function FitnessIllustration() {
  return <div className="hero-visual lifestyle-visual fitness-lifestyle"><img src={fitnessTrainingImage} alt="男士在健身房进行哑铃力量训练" /><i>训练日 · 蛋白 + 碳水</i></div>
}

function ModuleSpotlight({ module, onOpenAssistant, fitnessTrainingPlan, onChangeTrainingPlan, onEditTrainingPlan, familyProfile, elderProfile, onEditFamilyProfile, onEditElderProfile }) {
  if (module.id === 'fitness') {
    return <FitnessTrainingPlanner plan={fitnessTrainingPlan} onChange={onChangeTrainingPlan} onEdit={onEditTrainingPlan} onAskAssistant={onOpenAssistant} />
  }
  if (module.id === 'elder') {
    const summary = elderProfileSummary(elderProfile)
    const goalLabels = elderProfile.careGoals.map((goalId) => ELDER_CARE_GOALS.find((goal) => goal.id === goalId)?.label).filter(Boolean)
    const chewingLabel = elderProfile.chewing === 'normal' ? '正常咀嚼' : elderProfile.chewing === 'soft' ? '偏好软一点' : elderProfile.chewing === 'very_soft' ? '需要软烂细碎' : '不愿透露'
    return (
      <section className="module-spotlight elder-focus">
        <div className="spotlight-title"><span><Heart size={17} /></span><div><strong>今日安心提醒</strong><small>根据健康档案动态调整，不替代医生诊疗</small></div></div>
        <div className="elder-checks"><span><i>食</i><div><small>饮食重点</small><strong title={goalLabels.join('、')}>{goalLabels.length ? `${goalLabels.slice(0, 2).join('、')}${goalLabels.length > 2 ? `等 ${goalLabels.length} 项` : ''}` : '暂未设置'}</strong></div></span><span><i>嚼</i><div><small>咀嚼偏好</small><strong>{chewingLabel}</strong></div></span><span><i>史</i><div><small>疾病史</small><strong>{elderProfile.completed ? summary.diseaseLabel : '尚未设置'}</strong></div></span><button onClick={onEditElderProfile}><PencilLine size={15} /> 编辑健康档案</button></div>
      </section>
    )
  }
  return (
    <section className="module-spotlight family-focus">
      <div className="spotlight-title"><span><UsersRound size={17} /></span><div><strong>这一桌，人人都有份</strong><small>同一道菜按家庭成员自动调整用量与口味</small></div></div>
      <div className="family-portions">{familyProfile.members.map((member) => <span key={member.id}><i>{member.icon}</i><div><small>{member.role}</small><strong>{member.portionMultiplier.toFixed(1)}× · {member.ageGroup}</strong></div></span>)}<button onClick={onEditFamilyProfile}><PencilLine size={15} /> 编辑家庭档案</button></div>
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
  const [region, setRegion] = useState('all')
  const [dishType, setDishType] = useState('all')
  const [catalogPage, setCatalogPage] = useState(1)
  const [results, setResults] = useState(() => dishes.slice(0, 36))
  const [pageInfo, setPageInfo] = useState({ page: 1, limit: 36, total: dishes.length, totalPages: Math.ceil(dishes.length / 36), hasNextPage: dishes.length > 36 })
  const [facets, setFacets] = useState({ summary: { dishes: dishes.length, relations: getDishGraphStats().edges, sourceBacked: dishes.length }, cuisines: [], regions: [], dishTypes: [] })
  const [catalogState, setCatalogState] = useState('loading')
  const [relatedDishes, setRelatedDishes] = useState(() => getRelatedDishes(dishes[2]?.id, 6))
  const [selectedDish, setSelectedDish] = useState(dishes[2])
  const [mealType, setMealType] = useState('午餐')
  const [remoteImages, setRemoteImages] = useState({})
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const { favoriteByDishId, activeCollection, toggleFavorite } = useFavoriteCatalog()
  const searchInputRef = useRef(null)
  const searchAnalysis = useMemo(() => analyzeDishQuery(query), [query])
  const portion = selectedDish ? calculateDishPortion(selectedDish, mealHistory, mealType) : null
  const availableCuisines = useMemo(() => {
    const known = new Set(cuisineMeta.map((item) => item.id))
    return [...cuisineMeta, ...facets.cuisines.filter((item) => !known.has(item.value)).map((item) => ({ id: item.value, name: item.value, emoji: '🍲' }))]
  }, [facets.cuisines])
  const imageUrls = useMemo(() => [...new Set(results.map((dish) => dishImage(dish)).filter(Boolean).concat(selectedDish ? [dishImage(selectedDish, false)] : []))], [results, remoteImages, selectedDish])
  const imageReadyMap = usePreloadedImages(imageUrls)

  useEffect(() => {
    const controller = new AbortController()
    readCatalogFacets(controller.signal).then(setFacets).catch(() => {})
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setCatalogState('loading')
      listCatalogDishes({ query, cuisine, region, dishType, page: catalogPage, limit: 36 }, controller.signal)
        .then((payload) => {
          setResults(payload.dishes || [])
          setPageInfo(payload.pageInfo)
          setCatalogState('online')
        })
        .catch((error) => {
          if (error.name === 'AbortError') return
          const fallback = searchDishes(query, cuisine)
          const start = (catalogPage - 1) * 36
          setResults(fallback.slice(start, start + 36))
          setPageInfo({ page: catalogPage, limit: 36, total: fallback.length, totalPages: Math.max(1, Math.ceil(fallback.length / 36)), hasNextPage: start + 36 < fallback.length })
          setCatalogState('offline')
        })
    }, query ? 220 : 0)
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [catalogPage, cuisine, dishType, query, region])

  useEffect(() => {
    const visibleIds = [...results.map((dish) => dish.id), selectedDish?.id].filter(Boolean)
    let active = true
    fetchDishImages(visibleIds)
      .then((images) => { if (active) setRemoteImages((current) => ({ ...current, ...images })) })
      .catch(() => {})
    return () => { active = false }
  }, [results, selectedDish?.id])

  useEffect(() => {
    if (!selectedDish) { setRelatedDishes([]); return undefined }
    const controller = new AbortController()
    readCatalogRelations(selectedDish.id, 6, controller.signal)
      .then((payload) => setRelatedDishes(payload.relations || []))
      .catch((error) => { if (error.name !== 'AbortError') setRelatedDishes(getRelatedDishes(selectedDish.id, 6)) })
    return () => controller.abort()
  }, [selectedDish?.id])

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
      <section className="page-intro library-intro"><div><span className="section-kicker">CHINESE DISH ATLAS</span><h2>中华菜品库，今天搜哪一味？</h2><p>覆盖传统菜、家常菜、主食小吃与可组合搭配；配方来源和营养可信度会如实标明。</p></div><div className="library-stats"><span><strong>{facets.summary.dishes.toLocaleString('zh-CN')}</strong><small>道可搜索菜</small></span><span><strong>{facets.summary.relations.toLocaleString('zh-CN')}</strong><small>条精选关系</small></span><span><strong>{(facets.summary.sourceBacked || 0).toLocaleString('zh-CN')}</strong><small>条有来源配方</small></span></div></section>
      <div className="library-searchbar"><Search size={18} /><input ref={searchInputRef} value={query} onChange={(event) => { setQuery(event.target.value); setCatalogPage(1) }} onKeyDown={(event) => { if (event.key === 'Escape') { setQuery(''); setCatalogPage(1); event.currentTarget.blur() } }} placeholder="搜菜名、食材、口味、做法：如 番茄 / 猪肉饺 / 清蒸…" aria-label="搜索菜名、食材、口味或烹饪方式" /><kbd>Ctrl K</kbd></div>
      {!searchAnalysis.isEmpty && (
        <div className="library-search-insight">
          <span>已智能提取</span>
          {searchAnalysis.displayTokens.length
            ? searchAnalysis.displayTokens.map((token) => <em key={token}>{token}</em>)
            : <em>近似菜名</em>}
          <small>按菜名、食材、做法、口味、拼音/缩写综合排序</small>
        </div>
      )}
      <div className="library-filter-row">
        <div className="cuisine-chips">{availableCuisines.map((item) => <button key={item.id} className={cuisine === item.id ? 'active' : ''} onClick={() => { setCuisine(item.id); setCatalogPage(1) }}><span>{item.emoji}</span>{item.name}</button>)}</div>
        <select value={region} onChange={(event) => { setRegion(event.target.value); setCatalogPage(1) }} aria-label="按地区筛选"><option value="all">全部地区</option>{facets.regions.map((item) => <option key={item.value} value={item.value}>{item.value} · {item.count}</option>)}</select>
        <select value={dishType} onChange={(event) => { setDishType(event.target.value); setCatalogPage(1) }} aria-label="按类型筛选"><option value="all">全部类型</option>{facets.dishTypes.map((item) => <option key={item.value} value={item.value}>{item.value} · {item.count}</option>)}</select>
      </div>
      <div className="library-layout">
        <section className="dish-results">
          <div className="library-result-head"><span>找到 {pageInfo.total.toLocaleString('zh-CN')} 道好菜 <i className={`catalog-state ${catalogState}`}>{catalogState === 'online' ? '服务端目录' : catalogState === 'offline' ? '离线基础库' : '正在检索'}</i></span><button onClick={() => { setQuery(''); setCuisine('all'); setRegion('all'); setDishType('all'); setCatalogPage(1) }}>清空筛选</button></div>
          <div className="dish-card-grid">
            {results.map((dish) => {
              const imageUrl = dishImage(dish)
              const imageReady = !imageUrl || Boolean(imageReadyMap[imageUrl])
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
                    {!imageUrl && <b className="dish-image-fallback">{dish.dishType === '主食' ? '🍜' : dish.dishType === '饮品' ? '🫖' : '🥘'}</b>}
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
                    <small>{dish.nutritionConfidence === 'unverified' ? '营养待核验' : `${dish.nutrition.calories || 0} kcal · ${dish.nutritionConfidence === 'estimated' ? '营养估算' : `蛋白 ${dish.nutrition.protein || 0}g`}`}</small>
                    <div>{(dish.tags || ['新收录']).slice(0, 2).map((tag) => <em key={tag}>{tag}</em>)}</div>
                  </div>
                </article>
              )
            })}
          </div>
          {pageInfo.totalPages > 1 && <nav className="catalog-pagination" aria-label="菜品库分页"><button disabled={catalogPage <= 1 || catalogState === 'loading'} onClick={() => setCatalogPage((page) => Math.max(1, page - 1))}>上一页</button><span>第 {pageInfo.page} / {pageInfo.totalPages} 页</span><button disabled={!pageInfo.hasNextPage || catalogState === 'loading'} onClick={() => setCatalogPage((page) => page + 1)}>下一页</button></nav>}
          {!results.length && <div className="empty-library"><span>🍜</span><strong>这道菜还在后厨备菜</strong><small>换个关键词，或者等爬虫把它带回来。</small></div>}
        </section>
        {selectedDish && portion && <aside className="dish-detail panel-card">
          <div
            className={`dish-detail-image ${!dishImage(selectedDish, false) || imageReadyMap[dishImage(selectedDish, false)] ? 'is-ready' : 'is-loading'}`}
            style={imageReadyMap[dishImage(selectedDish, false)] ? { backgroundImage: `url(${dishImage(selectedDish, false)})` } : undefined}
          >
            {dishImage(selectedDish, false) && !imageReadyMap[dishImage(selectedDish, false)] && <span className="image-skeleton-mark" />}
            {!dishImage(selectedDish, false) && <b className="dish-detail-fallback">🥘</b>}
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
          <div className="dish-detail-copy"><span className="section-kicker">PORTION ENGINE</span><h3>{selectedDish.name}</h3><p>这份菜是 <strong>{(selectedDish.taste || ['经典']).join('、')}</strong> 风味，系统会按你过去的饭量动态换算。</p><div className={`dish-evidence ${selectedDish.reviewStatus || 'candidate'}`}>{selectedDish.reviewStatus === 'generated' ? '家常搭配 · 组合规则生成' : selectedDish.source === 'howtocook' ? '开源配方 · 来源可追溯' : selectedDish.reviewStatus === 'candidate' || !selectedDish.reviewStatus ? '候选配方 · 待人工复核' : '项目配方 · 已审阅'}<small>{selectedDish.nutritionConfidence === 'unverified' ? '营养数据待核验' : selectedDish.nutritionConfidence === 'verified' || selectedDish.nutritionConfidence === 'source_estimate' ? '营养数据来自可信来源' : '营养数据为估算值'}</small>{selectedDish.sourceUrl && <a href={selectedDish.sourceUrl} target="_blank" rel="noreferrer">查看配方来源 ↗</a>}</div><div className="meal-type-switch">{['早餐', '午餐', '晚餐'].map((type) => <button className={mealType === type ? 'active' : ''} key={type} onClick={() => setMealType(type)}>{type}</button>)}</div><div className="portion-highlight"><span>建议系数<strong>{portion.multiplier}×</strong></span><span>单人热量<strong>{portion.nutrition.calories}<small> kcal</small></strong></span><span>蛋白质<strong>{portion.nutrition.protein}<small> g</small></strong></span></div><div className="ingredient-list"><strong>这顿要准备</strong>{portion.ingredients.slice(0, 5).map((ingredient) => <span key={ingredient.name}><em>{ingredient.name}</em><b>{ingredient.grams}g</b></span>)}</div><small className="portion-reason"><Sparkles size={13} /> {portion.reason}</small><div className="dish-detail-actions"><button className="primary-full" onClick={() => onUseDish({ ...selectedDish, image: dishImage(selectedDish, false) }, mealType)}>按我的饭量加入{mealType} <Plus size={16} /></button><button className="outline-full" onClick={exportSelectedRecipe} disabled={isExportingPdf}><FileDown size={15} /> {isExportingPdf ? '正在生成 PDF…' : '导出这份食谱 PDF'}</button></div></div>
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

function AssistantPanel({ module, meals, mealHistory, fitnessTrainingPlan, familyProfile, elderProfile, onClose, onConfigureAi }) {
  const fitnessContext = useMemo(() => module.id === 'fitness' ? buildFitnessTrainingContext(fitnessTrainingPlan, getChinaToday()) : null, [fitnessTrainingPlan, module.id])
  const familyContext = useMemo(() => module.id === 'family' ? buildFamilyProfileContext(familyProfile) : null, [familyProfile, module.id])
  const elderContext = useMemo(() => module.id === 'elder' ? buildElderProfileContext(elderProfile) : null, [elderProfile, module.id])
  const fitnessSummary = fitnessContext?.today.sessions.map((session) => session.type).join(' + ') || ''
  const fitnessIntensity = fitnessContext?.today.sessions.some((session) => session.intensity === '高') ? '含高强度' : fitnessContext?.today.sessions.some((session) => session.intensity === '中等') ? '最高中等强度' : '低强度'
  const familySummaryText = familyContext ? `${familyContext.memberCount} 位饭友的饭量与忌口` : ''
  const elderSummaryText = elderContext ? `饮食重点与${elderContext.diseaseDisclosure === 'not_disclosed' ? '疾病史隐私选择' : '健康档案'}` : ''
  const [messages, setMessages] = useState([{ role: 'assistant', content: fitnessContext
    ? `嗨，我是小饭！${module.emoji}\n今天安排了${fitnessSummary}，共 ${fitnessContext.today.totalDurationMinutes} 分钟（${fitnessIntensity}）。我会结合每一段训练和当前三餐，帮你安排训练前后怎么吃。`
    : familyContext
      ? `嗨，我是小饭！${module.emoji}\n我会结合${familySummaryText}来安排一桌饭，并分别说明份量和替换方法。`
      : elderContext
        ? `嗨，我是小饭！${module.emoji}\n我会结合已填写的${elderSummaryText}给饮食建议；未透露的疾病信息不会被猜测或追问。`
        : `嗨，我是小饭！${module.emoji}\n现在是「${module.name}」，你可以告诉我想吃什么、家里有啥菜，或者直接问“今晚怎么安排？”` }])
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [connectionNote, setConnectionNote] = useState('正在连接小饭 AI…')
  const [connectionState, setConnectionState] = useState('checking')
  const endRef = useRef(null)
  const revealTimerRef = useRef(null)
  const mealContextFingerprint = meals.map(({ type, title, description, kcal, portionMultiplier }) => `${type}|${title}|${description}|${kcal}|${portionMultiplier}`).join('||')
  const fitnessContextFingerprint = fitnessContext?.week.map((item) => `${item.day}|${item.sessions.map((session) => `${session.type}|${session.durationMinutes}|${session.intensity}`).join('+')}`).join('||') || ''
  const familyContextFingerprint = familyContext ? JSON.stringify(familyContext) : ''
  const elderContextFingerprint = elderContext ? JSON.stringify(elderContext) : ''
  const liveContextFingerprint = `${module.id}##${mealContextFingerprint}##${fitnessContextFingerprint}##${familyContextFingerprint}##${elderContextFingerprint}`
  const mealContextRef = useRef(liveContextFingerprint)
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
          setConnectionNote('网页预览未连接小饭 AI')
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
            setConnectionNote(`${config.serviceName || '小饭 AI'} · 平台托管`)
          } else {
            setConnectionState('unconfigured')
            setConnectionNote('小饭 AI 暂未就绪')
          }
        }
      } catch {
        if (active) {
          setConnectionState('error')
          setConnectionNote('小饭 AI 状态读取失败')
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
    if (mealContextRef.current === liveContextFingerprint) return
    mealContextRef.current = liveContextFingerprint
    requestRevisionRef.current += 1
    if (revealTimerRef.current) {
      window.clearInterval(revealTimerRef.current)
      revealTimerRef.current = null
    }
    setIsThinking(false)
    const currentPlan = meals.map((meal) => `${meal.type}“${meal.title}”`).join('、')
    const trainingNote = fitnessContext ? `；今天安排${fitnessSummary}，共 ${fitnessContext.today.totalDurationMinutes} 分钟（${fitnessIntensity}）` : ''
    const familyNote = familyContext ? `；已读取 ${familySummaryText}` : ''
    const elderNote = elderContext ? `；已读取${elderSummaryText}` : ''
    setMessages([{ role: 'assistant', content: `看到你的安排更新啦！接下来的回答会以当前数据为准：${currentPlan || '今天还没有安排餐食'}${trainingNote}${familyNote}${elderNote}。` }])
  }, [liveContextFingerprint, meals, fitnessContext, familyContext, elderContext])

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
        fitnessTraining: fitnessContext,
        familyProfile: familyContext,
        elderProfile: elderContext,
      }
      const rawResponse = window.mealDesktop ? await window.mealDesktop.chat({ module: module.id, messages: apiMessages, context }) : { demo: true, reason: 'browser_preview' }
      if (requestRevision !== requestRevisionRef.current) return
      const response = rawResponse && typeof rawResponse === 'object' ? rawResponse : { demo: true }
      if (response.apiError) {
        setConnectionState('error')
        setConnectionNote(`连接失败：${response.apiError}`)
        revealAssistantReply(`这次没有拿到小饭 AI 的回答：${response.apiError}\n请稍后再试；若持续失败，请联系管理员检查后台通道。`)
      } else if (response.demo) {
        const isPreview = response.reason === 'browser_preview'
        setConnectionState(isPreview ? 'preview' : 'unconfigured')
        setConnectionNote(isPreview ? '网页预览未连接小饭 AI' : '小饭 AI 暂未就绪')
        revealAssistantReply(isPreview
          ? '当前是网页预览，没有连接小饭 AI；请在 Windows 桌面版中使用。'
          : '小饭 AI 暂未就绪，请稍后再试或联系管理员检查后台通道。')
      } else if (typeof response.content === 'string' && response.content.trim()) {
        setConnectionState('connected')
        setConnectionNote('小饭 AI · 本次请求成功')
        revealAssistantReply(response.content)
      } else {
        setConnectionState('error')
        setConnectionNote('小饭 AI 返回内容异常')
        revealAssistantReply('小饭 AI 没有返回有效内容，请稍后重试或检查服务设置。')
      }
    } catch {
      setConnectionState('error')
      setConnectionNote('小饭 AI 请求异常')
      setMessages((current) => [...current, { role: 'assistant', content: '锅里刚刚冒了点小状况，AI 暂时没接上。你可以稍后再试，现有菜单不会受影响。' }])
      setIsThinking(false)
    }
  }

  return (
      <div className={`assistant-panel ai-status-${connectionState}`}>
      <div className="assistant-head"><div className="assistant-avatar">饭<i /></div><div><strong>小饭 AI</strong><span><i /> {connectionState === 'connected' ? '小饭 AI 在线' : connectionState === 'configured' ? '小饭 AI 已就绪' : connectionState === 'checking' ? '正在检查连接' : connectionState === 'error' ? '连接异常' : '小饭 AI 未就绪'} · 只聊吃饭</span></div><button onClick={onClose}><X size={19} /></button></div>
      <div className="assistant-context"><span>{module.emoji}</span><p>已进入 <strong>{module.name}</strong><br /><small>{fitnessContext ? `今天 ${fitnessContext.today.sessions.length} 项训练 · 共 ${fitnessContext.today.totalDurationMinutes} 分钟` : familyContext ? `已读取 ${familyContext.memberCount} 位成员的独立设置` : elderContext ? `疾病史：${elderContext.diseaseDisclosure === 'not_disclosed' ? '不愿透露（保持私密）' : elderContext.diseaseDisclosure === 'none_known' ? '暂无已知相关疾病' : '按已填写内容使用'}` : '回答会结合近三天记录与当前场景'}</small></p><button className="assistant-configure" onClick={onConfigureAi} title="查看小饭 AI 服务"><ShieldCheck size={16} /><small>{connectionNote}</small></button></div>
      <div className="chat-scroll">
        {messages.map((message, index) => <div key={index} className={`chat-message ${message.role}`}><span>{message.role === 'assistant' ? '饭' : '我'}</span><p>{message.content}</p></div>)}
        {isThinking && <div className="chat-message assistant"><span>饭</span><p className="typing"><i /><i /><i /></p></div>}
        <div ref={endRef} />
      </div>
      {messages.length < 3 && <div className="quick-questions">{quickQuestions.map((question) => <button key={question} onClick={() => sendMessage(question)}>{question}</button>)}</div>}
      <div className="chat-input"><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage() } }} placeholder="问问今晚吃什么，或者冰箱剩菜怎么救…" /><button onClick={() => sendMessage()}><Send size={18} /></button></div>
      <small className="ai-note">小饭 AI 建议仅作饮食参考，疾病治疗请听医生的</small>
    </div>
  )
}

const fallbackMembershipProducts = [
  { code: 'pro_month', name: 'Pro 饭搭子月度会员', amountFen: 2999, durationDays: 31, billingPeriod: 'month', billingPeriodCount: 1 },
  { code: 'pro_year', name: 'Pro 饭搭子年度会员', amountFen: 19999, durationDays: 366, billingPeriod: 'year', billingPeriodCount: 1 },
]

function formatBillingPeriod(product) {
  const count = Number(product?.billingPeriodCount || 1)
  if (product?.billingPeriod === 'month') return `${count} 个自然月会员权益`
  if (product?.billingPeriod === 'year') return `${count} 个自然年会员权益`
  return `${Number(product?.durationDays || 0)} 天会员权益`
}

function formatMoney(amountFen) {
  return `¥${(Number(amountFen || 0) / 100).toFixed(2)}`
}

function MembershipModal({ account, onClose, onActivate, onRequireLogin, onToast }) {
  const [productCode, setProductCode] = useState('pro_year')
  const [products, setProducts] = useState(fallbackMembershipProducts)
  const [providers, setProviders] = useState({})
  const [provider, setProvider] = useState('')
  const [order, setOrder] = useState(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const activatedOrderRef = useRef('')

  useEffect(() => {
    let active = true
    listBillingProducts()
      .then((payload) => {
        if (!active) return
        if (payload?.products?.length) setProducts(payload.products)
        const nextProviders = payload?.providers || {}
        setProviders(nextProviders)
        const firstConfigured = ['wechat', 'alipay', 'dev'].find((key) => nextProviders[key]?.configured)
        setProvider(firstConfigured || '')
      })
      .catch((caughtError) => {
        if (active) setError(caughtError.message || '会员服务暂时不可用。')
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    if (!order?.qrPayload) {
      setQrDataUrl('')
      return () => { active = false }
    }
    QRCode.toDataURL(order.qrPayload, { width: 240, margin: 1, color: { dark: '#292620', light: '#ffffff' } })
      .then((url) => { if (active) setQrDataUrl(url) })
      .catch(() => { if (active) setError('付款码生成失败，请重新下单。') })
    return () => { active = false }
  }, [order?.qrPayload])

  useEffect(() => {
    if (!order?.id || order.status !== 'pending') return undefined
    let active = true
    let timer = null
    async function pollOrder() {
      try {
        const payload = await readBillingOrder(order.id)
        if (!active) return
        setOrder(payload.order)
        if (payload.order?.status === 'paid' && payload.membership?.isPro && activatedOrderRef.current !== payload.order.id) {
          activatedOrderRef.current = payload.order.id
          onActivate(payload.membership)
          return
        }
        if (payload.order?.status === 'pending') timer = window.setTimeout(pollOrder, 2_000)
      } catch (caughtError) {
        if (active) {
          setError(caughtError.message || '订单状态查询失败。')
          timer = window.setTimeout(pollOrder, 4_000)
        }
      }
    }
    timer = window.setTimeout(pollOrder, 2_000)
    return () => {
      active = false
      if (timer) window.clearTimeout(timer)
    }
  }, [order?.id, order?.status, onActivate])

  const selectedProduct = products.find((item) => item.code === productCode) || products[0]
  const configuredProviders = ['wechat', 'alipay', 'dev'].filter((key) => providers[key]?.configured)

  async function startPayment() {
    if (!account) {
      onRequireLogin()
      return
    }
    if (!provider || !selectedProduct) {
      setError('支付通道尚未配置，暂时无法下单。')
      return
    }
    setBusy(true)
    setError('')
    try {
      const idempotencyKey = window.crypto?.randomUUID?.() || `order-${Date.now()}-${Math.random().toString(16).slice(2)}`
      const payload = await createBillingOrder({ productCode: selectedProduct.code, provider, idempotencyKey })
      setOrder(payload.order)
      onToast('订单已创建，请在有效期内完成支付。')
    } catch (caughtError) {
      setError(caughtError.message || '创建支付订单失败。')
    } finally {
      setBusy(false)
    }
  }

  async function simulateDevelopmentPayment() {
    if (!order?.id || busy) return
    setBusy(true)
    setError('')
    try {
      const payload = await completeDevelopmentOrder(order.id)
      setOrder(payload.order)
      if (payload.membership?.isPro && activatedOrderRef.current !== payload.order.id) {
        activatedOrderRef.current = payload.order.id
        onActivate(payload.membership)
      }
    } catch (caughtError) {
      setError(caughtError.message || '开发测试支付失败。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell onClose={onClose} className="membership-modal">
      <button className="modal-close" onClick={onClose}><X size={20} /></button>
      <div className="membership-visual"><span>🥘</span><i>✨</i><strong>饭桌上的<br />全能队友</strong></div>
      <div className="membership-content"><span className="pro-label"><Sparkles size={14} /> 好吃的今天 PRO</span><h2>让每一顿，都更懂你</h2><p>三种进阶场景、专属营养分析和无限 AI 问答，一顿饭钱照顾整月餐桌。</p>
        <div className="feature-list"><span><CheckCircle2 size={17} /> 家庭、乐龄、健身场景全解锁</span><span><CheckCircle2 size={17} /> 每周食谱与营养报告无限生成</span><span><CheckCircle2 size={17} /> 小饭 AI 专属饮食顾问随时问</span></div>
        {!order ? <>
          <div className="price-options">
            {products.map((item) => {
              const yearly = item.code === 'pro_year'
              return <button key={item.code} className={`${productCode === item.code ? 'selected ' : ''}${yearly ? 'hot' : ''}`} onClick={() => setProductCode(item.code)}>{yearly && <i>🔥 HOT · 年度更划算</i>}<span>{yearly ? '年度饭搭子' : '月度饭搭子'}</span><strong>{formatMoney(item.amountFen)}<small>/{yearly ? '年' : '月'}</small></strong><em>{formatBillingPeriod(item)}</em></button>
            })}
          </div>
          <div className="payment-channel-picker">
            {configuredProviders.length ? configuredProviders.map((key) => <button key={key} className={provider === key ? 'selected' : ''} onClick={() => setProvider(key)}><i className={key}>{key === 'wechat' ? '微' : key === 'alipay' ? '支' : '测'}</i>{providers[key].label}</button>) : <span>支付通道待后台配置</span>}
          </div>
          {error && <p className="payment-error">{error}</p>}
          <button className="pay-button" onClick={startPayment} disabled={busy || (!account ? false : !provider)}>{busy ? '正在创建订单…' : !account ? '登录后购买' : `支付 ${formatMoney(selectedProduct?.amountFen)}`} <ChevronRight size={18} /></button>
          <div className="pay-methods"><span>服务端验签到账后自动开通</span><ShieldCheck size={14} /> 商户密钥不会进入客户端</div>
        </> : <div className="payment-order-panel">
          <div className="payment-order-summary"><span>{order.productName || selectedProduct?.name}</span><strong>{formatMoney(order.amountFen)}</strong></div>
          {order.status === 'pending' && <>
            {qrDataUrl ? <img className="payment-qr" src={qrDataUrl} alt="会员支付二维码" /> : <div className="payment-qr loading">付款码生成中…</div>}
            <p>{order.provider === 'wechat' ? '请使用微信扫码支付' : order.provider === 'alipay' ? '请使用支付宝扫码支付' : '这是开发环境测试订单，不会真实扣款'}</p>
            <small>订单将在 {new Date(order.expiresAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} 失效 · 页面会自动确认到账</small>
            {order.provider === 'dev' && <button className="development-pay-button" onClick={simulateDevelopmentPayment} disabled={busy}>{busy ? '正在确认…' : '模拟支付成功（不扣款）'}</button>}
          </>}
          {order.status !== 'pending' && order.status !== 'paid' && <p className="payment-error">{order.failureMessage || '订单已失效，请重新下单。'}</p>}
          {error && <p className="payment-error">{error}</p>}
          <button className="payment-back-button" onClick={() => { setOrder(null); setQrDataUrl(''); setError('') }}>返回选择方案</button>
        </div>}
      </div>
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

const billingStatusLabels = Object.freeze({
  pending: '待支付',
  paid: '已支付',
  failed: '支付失败',
  closed: '已关闭',
  expired: '已过期',
  refunded: '已退款',
})

function formatMembershipDate(value, includeTime = false) {
  if (!value) return '—'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '—'
  return includeTime
    ? date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('zh-CN')
}

function MembershipSettingsSection({ account, membership, onMembershipChange, onToast }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(Boolean(account))
  const [busyOrderId, setBusyOrderId] = useState('')
  const [error, setError] = useState('')
  const isPro = Boolean(membership?.isPro)

  useEffect(() => {
    let active = true
    if (!account) {
      setOrders([])
      setLoading(false)
      return () => { active = false }
    }
    setLoading(true)
    listBillingOrders(8)
      .then((payload) => { if (active) setOrders(payload?.orders || []) })
      .catch((caughtError) => { if (active) setError(caughtError.message || '会员订单读取失败。') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [account?.id])

  async function reconcile(order) {
    if (!order?.id || busyOrderId) return
    setBusyOrderId(order.id)
    setError('')
    try {
      const payload = await reconcileBillingOrder(order.id)
      if (payload?.membership) onMembershipChange?.(payload.membership)
      setOrders((current) => current.map((item) => item.id === order.id ? payload.order : item))
      onToast?.(payload?.order?.status === 'paid' ? '支付平台已确认到账，会员权益已更新。' : '查单完成，暂未发现新的到账结果。')
    } catch (caughtError) {
      setError(caughtError.message || '支付平台查单失败。')
    } finally {
      setBusyOrderId('')
    }
  }

  return <div className="settings-section membership-settings-section">
    <span className="settings-kicker">MEMBERSHIP</span><h3>会员信息</h3>
    <div className={`membership-status ${isPro ? 'is-pro' : ''}`}><span>{isPro ? '👑' : '🍚'}</span><div><small>当前方案</small><strong>{isPro ? membership.productName || 'Pro 饭搭子' : '普通饭友 · 免费版'}</strong><p>{isPro ? '家庭、乐龄、健身模式均已解锁' : '日常模式永久免费，升级可解锁三种专属场景'}</p></div></div>
    {membership?.reminder && <div className={`membership-reminder ${membership.reminder.level}`}><span>⏰</span><div><strong>续费提醒</strong><small>{membership.reminder.message} 当前不会自动扣款。</small></div></div>}
    <div className="settings-rows membership-detail-rows"><span><em>会员有效期至</em><strong>{formatMembershipDate(membership?.validUntil)}</strong></span><span><em>剩余时间</em><strong>{isPro ? `${membership.daysRemaining || 0} 天` : '—'}</strong></span><span><em>自动续费</em><strong>{membership?.autoRenew ? '已开启' : '未开启 · 不会自动扣款'}</strong></span></div>
    <div className="billing-history-head"><div><strong>最近订单</strong><small>价格和周期均以服务端订单为准</small></div>{loading && <i>读取中…</i>}</div>
    {error && <p className="billing-history-error">{error}</p>}
    {!account ? <div className="billing-history-empty">登录后可查看会员和续费记录。</div> : !loading && !orders.length ? <div className="billing-history-empty">还没有会员订单。</div> : <div className="billing-history-list">{orders.map((order) => {
      const canReconcile = ['pending', 'expired', 'failed'].includes(order.status) && ['wechat', 'alipay'].includes(order.provider)
      return <article key={order.id}><span className={`billing-order-state ${order.status}`}>{billingStatusLabels[order.status] || order.status}</span><div><strong>{order.productName}</strong><small>{formatMembershipDate(order.createdAt, true)} · {order.provider === 'wechat' ? '微信支付' : order.provider === 'alipay' ? '支付宝' : '开发测试'}</small></div><em>{formatMoney(order.amountFen)}</em>{canReconcile && <button type="button" disabled={Boolean(busyOrderId)} onClick={() => reconcile(order)}>{busyOrderId === order.id ? '查单中…' : '向平台查单'}</button>}</article>
    })}</div>}
  </div>
}

function SettingsModal({ account: activeAccount, initialSection = 'account', membership, onMembershipChange, onToast, onClose, onOpenDocument }) {
  const [section, setSection] = useState(initialSection)
  const [aiConfig, setAiConfig] = useState(managedAiDefaults)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiVerified, setAiVerified] = useState(false)
  const [aiFeedback, setAiFeedback] = useState({ type: '', message: '' })

  useEffect(() => {
    let active = true
    async function loadAiConfig() {
      if (!window.mealDesktop?.getAiConfig) {
        if (active) setAiFeedback({ type: 'warning', message: '网页预览不连接小饭 AI，请在 Windows 桌面版中查看。' })
        return
      }
      try {
        const config = await window.mealDesktop.getAiConfig()
        if (active && config) setAiConfig(config)
      } catch {
        if (active) setAiFeedback({ type: 'error', message: '小饭 AI 状态读取失败，请稍后重试。' })
      }
    }
    loadAiConfig()
    return () => { active = false }
  }, [])

  async function testManagedAi() {
    if (!window.mealDesktop?.testAiConfig || aiBusy) return
    setAiBusy(true)
    setAiVerified(false)
    setAiFeedback({ type: '', message: '正在连接小饭 AI 并测试服务…' })
    try {
      const result = await window.mealDesktop.testAiConfig()
      if (!result?.ok) throw new Error(result?.error || '连接测试失败。')
      setAiVerified(true)
      setAiConfig((current) => ({ ...current, configured: true, ready: true, configurationIssue: '' }))
      setAiFeedback({ type: 'success', message: `${result.serviceName || '小饭 AI'} 后台通道正常，可以开聊啦！` })
    } catch (error) {
      setAiFeedback({ type: 'error', message: error instanceof Error ? error.message : '小饭 AI 检测失败。' })
    } finally {
      setAiBusy(false)
    }
  }

  const account = activeAccount || readDemoAccount()
  const accountLabel = account?.displayName || (account?.loginType === 'phone' ? account.phone : account?.loginType === 'email' ? account.email : account?.provider || '尚未登录')
  const settingsSections = [
    { id: 'account', label: '账号信息', icon: UserRound },
    { id: 'membership', label: '会员信息', icon: WalletCards },
    { id: 'ai', label: '小饭 AI', icon: Sparkles },
    { id: 'shortcuts', label: '快捷键说明', icon: Keyboard },
    { id: 'help', label: '帮助中心', icon: MessageCircleMore },
  ]
  return (
    <ModalShell onClose={onClose} className="settings-modal">
      <button className="modal-close" onClick={onClose}><X size={20} /></button>
      <div className="settings-title"><span><Settings size={20} /></span><div><small>SETTINGS & HELP</small><h2>把你的饭碗设置好</h2></div></div>
      <div className="settings-layout"><nav>{settingsSections.map((item) => { const Icon = item.icon; return <button key={item.id} className={section === item.id ? 'active' : ''} onClick={() => setSection(item.id)}><Icon size={17} />{item.label}<ChevronRight size={14} /></button> })}</nav><section>
        {section === 'account' && <div className="settings-section"><span className="settings-kicker">ACCOUNT</span><h3>账号信息</h3><div className="account-summary"><span className="avatar">小</span><div><strong>{account ? '已登录饭友' : '游客饭友'}</strong><small>{accountLabel}</small></div><i>{account ? '已验证' : '未登录'}</i></div><div className="settings-rows"><span><em>登录方式</em><strong>{account?.loginType === 'phone' ? '手机验证码 + 密码' : account?.loginType === 'email' ? '邮箱 + 密码' : account?.provider || '—'}</strong></span><span><em>本地数据</em><strong>保存在当前设备</strong></span><span><em>账号安全</em><strong>滑块验证已开启</strong></span></div></div>}
        {section === 'membership' && <MembershipSettingsSection account={activeAccount} membership={membership} onMembershipChange={onMembershipChange} onToast={onToast} />}
        {section === 'ai' && (
          <div className="settings-section ai-settings-section">
            <span className="settings-kicker">MANAGED MEAL AI</span>
            <h3>小饭 AI 由平台统一托管</h3>
            <div className={`ai-connection-card ${aiVerified ? 'connected' : aiConfig.configured ? 'configured' : ''}`}>
              <span>{aiVerified ? '⚡' : aiConfig.configured ? '🛡️' : '🔌'}</span>
              <div>
                <strong>{aiVerified ? '小饭 AI 后台通道正常' : aiConfig.configured ? '小饭 AI 已就绪' : '小饭 AI 暂未就绪'}</strong>
                <small>{aiConfig.configurationIssue || '系统会为每位用户自动分配后台服务通道，无需填写任何密钥。'}</small>
              </div>
              <i>{aiVerified ? '已验证' : aiConfig.configured ? '托管中' : '待后台配置'}</i>
            </div>
            <div className="ai-managed-grid">
              <span><small>AI 服务</small><strong>小饭 AI</strong></span>
              <span><small>服务模式</small><strong>平台托管</strong></span>
              <span><small>通道来源</small><strong>后台服务池</strong></span>
              <span><small>分配方式</small><strong>按用户自动分配</strong></span>
            </div>
            <div className="ai-security-note"><ShieldCheck size={16} /><span>用户端不会读取、保存或显示上游服务凭证。后台会为匿名用户标识稳定分配一条通道，并在通道限流或失效时自动切换。</span></div>
            {aiFeedback.message && <div className={`ai-feedback ${aiFeedback.type}`}>{aiFeedback.message}</div>}
            <div className="ai-config-actions"><button className="primary-button" onClick={testManagedAi} disabled={aiBusy}>{aiBusy ? '检测中…' : '检测小饭 AI'}</button></div>
          </div>
        )}
        {section === 'shortcuts' && <div className="settings-section help-section"><span className="settings-kicker">KEYBOARD SHORTCUTS</span><h3>键盘快一点，开饭早一点</h3><p>导航、搜索、小饭 AI、场景切换和窗口操作已经整理成独立 PDF，阅读时不会显示代码内容。</p><button className="readme-button" onClick={() => onOpenDocument('keyboard-shortcuts')}><span><Keyboard size={20} /></span><div><strong>打开快捷键说明 PDF</strong><small>导航操作 · 效率工具 · 窗口控制</small></div><ArrowRight size={17} /></button><div className="help-note"><Keyboard size={16} /><span>随时按 Ctrl + / 可以直接打开这份快捷键说明。</span></div></div>}
        {section === 'help' && <div className="settings-section help-section"><span className="settings-kicker">HELP CENTER</span><h3>有问题，别饿着</h3><p>README 已整理为适合阅读的使用说明 PDF，包含主要功能、使用流程、数据安全和常见问题，不再以源码或 Markdown 形式展示。</p><button className="readme-button" onClick={() => onOpenDocument('user-guide')}><span><BookOpen size={20} /></span><div><strong>打开 README 使用说明 PDF</strong><small>快速上手 · 功能说明 · 常见问题</small></div><ArrowRight size={17} /></button><div className="help-note"><ShieldCheck size={16} /><span>营养建议只作生活参考，疾病治疗请咨询专业医生。</span></div></div>}
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
