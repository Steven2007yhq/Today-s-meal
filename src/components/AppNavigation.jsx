import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Heart,
  Home,
  LockKeyhole,
  Search,
  Settings,
  Sparkles,
  Zap,
} from 'lucide-react'
import { publishedNotifications } from '../data/appContent'
import { readJsonStorage, STORAGE_KEYS, writeJsonStorage } from '../services/browserStorage'
import { formatChinaHeader } from '../utils/chinaTime'

const primaryNavigation = [
  { id: 'today', label: '好吃的今天', icon: Home },
  { id: 'calendar', label: '餐食日历', icon: CalendarDays },
  { id: 'library', label: '中华菜品库', icon: Search },
  { id: 'report', label: '营养报告', icon: BarChart3 },
  { id: 'favorites', label: '我的收藏', icon: Heart },
]

export function Sidebar({ activePage, onNavigate, modules, activeModule, onChooseModule, isPro, onOpenMembership, onOpenSettings }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><span>吃</span><i /></div>
        <div><strong>好吃的今天</strong><small>一日三餐 · 不再为难</small></div>
      </div>

      <nav className="primary-nav">
        <div className="nav-caption">我的餐桌</div>
        {primaryNavigation.map((item) => {
          const Icon = item.icon
          return (
            <button key={item.id} className={activePage === item.id ? 'active' : ''} onClick={() => onNavigate(item.id)}>
              <Icon size={19} strokeWidth={2.1} />
              <span>{item.label}</span>
              {item.id === 'report' && <em>NEW</em>}
            </button>
          )
        })}
      </nav>

      <div className="module-nav">
        <div className="nav-caption">场景模式 <span>换个口味</span></div>
        {modules.map((item) => {
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
      {isPro && <div className="pro-active-card"><span>👑</span><div><strong>Pro 饭搭子</strong><small>所有场景已解锁</small></div></div>}
      <button className="settings-link" onClick={onOpenSettings}><Settings size={17} /> 设置与帮助</button>
    </aside>
  )
}

export function Topbar({ module, canGoBack, canGoForward, onBack, onForward, onProfile, onLogin, onLogout, account, onSearch, onToast }) {
  const [clock, setClock] = useState(() => new Date())
  const dateText = formatChinaHeader(clock)
  const notificationRef = useRef(null)
  const [showNotifications, setShowNotifications] = useState(false)
  const [readNotificationIds, setReadNotificationIds] = useState(() => (
    readJsonStorage(STORAGE_KEYS.notificationReadIds, [], Array.isArray)
  ))
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
    writeJsonStorage(STORAGE_KEYS.notificationReadIds, ids)
  }

  function openNotification(notification) {
    if (!readNotificationIds.includes(notification.id)) saveReadNotifications([...readNotificationIds, notification.id])
    setShowNotifications(false)
    onToast(`${notification.title}：${notification.description}`)
  }

  return (
    <header className="topbar">
      <div className="drag-area" />
      <nav className="history-navigation" aria-label="页面历史导航">
        <button type="button" onClick={onBack} disabled={!canGoBack} aria-label="返回上一界面" title="返回上一界面（Alt + ←）">
          <ArrowLeft size={18} strokeWidth={2.2} />
        </button>
        <button type="button" onClick={onForward} disabled={!canGoForward} aria-label="前往下一界面" title="前往下一界面（Alt + →）">
          <ArrowRight size={18} strokeWidth={2.2} />
        </button>
      </nav>
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
