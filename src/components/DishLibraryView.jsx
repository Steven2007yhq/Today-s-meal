import { useEffect, useMemo, useRef, useState } from 'react'
import { FileDown, Heart, Plus, Search, Sparkles, X } from 'lucide-react'
import { relationNodeLayout } from '../data/appContent'
import { cuisineMeta, dishes } from '../data/dishLibrary'
import { useFavoriteCatalog } from '../hooks/useFavoriteCatalog'
import { usePreloadedImages } from '../hooks/usePreloadedImages'
import { listCatalogDishes, readCatalogFacets, readCatalogRelations } from '../services/catalogApi'
import { analyzeDishQuery, calculateDishPortion, getDishGraphStats, getRelatedDishes, searchDishes } from '../services/dishEngine'
import { createLocalDishImageResolver } from '../services/dishImageFallback'
import { scalePortionFromIngredients } from '../services/ingredientScaling'
import { fetchDishImages } from '../services/imageApi'
import { exportRecipeToPdf } from '../services/pdfExport'

const resolveLocalDishImage = createLocalDishImageResolver(dishes)

function catalogPageNumbers(currentPage, totalPages) {
  const visibleCount = Math.min(5, totalPages)
  const start = Math.max(1, Math.min(currentPage - 2, totalPages - visibleCount + 1))
  return Array.from({ length: visibleCount }, (_, index) => start + index)
}

function CatalogPagination({ page, totalPages, loading, placement, onPageChange }) {
  const [jumpPage, setJumpPage] = useState(String(page))

  useEffect(() => setJumpPage(String(page)), [page])

  function moveTo(nextPage) {
    const safePage = Math.max(1, Math.min(totalPages, Math.round(Number(nextPage) || 1)))
    if (safePage !== page) onPageChange(safePage)
  }

  return (
    <nav className={`catalog-pagination ${placement}`} aria-label={`菜品库${placement === 'top' ? '顶部' : '底部'}分页`}>
      <div className="catalog-page-controls">
        <button disabled={page <= 1 || loading} onClick={() => moveTo(1)}>首页</button>
        <button disabled={page <= 1 || loading} onClick={() => moveTo(page - 1)} aria-label="上一页">‹</button>
        <div className="catalog-page-numbers">
          {catalogPageNumbers(page, totalPages).map((pageNumber) => (
            <button
              key={pageNumber}
              className={pageNumber === page ? 'active' : ''}
              aria-current={pageNumber === page ? 'page' : undefined}
              aria-label={`第 ${pageNumber} 页`}
              disabled={loading}
              onClick={() => moveTo(pageNumber)}
            >
              {pageNumber}
            </button>
          ))}
        </div>
        <button disabled={page >= totalPages || loading} onClick={() => moveTo(page + 1)} aria-label="下一页">›</button>
        <button disabled={page >= totalPages || loading} onClick={() => moveTo(totalPages)}>末页</button>
      </div>
      <form className="catalog-page-jump" onSubmit={(event) => { event.preventDefault(); moveTo(event.currentTarget.elements.namedItem('page')?.value) }}>
        <span>第 {page} / {totalPages} 页</span>
        <label><em>跳至</em><input name="page" type="number" min="1" max={totalPages} value={jumpPage} onChange={(event) => setJumpPage(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); moveTo(event.currentTarget.value) } }} aria-label="跳转页码" /><em>页</em></label>
        <button type="submit" disabled={loading}>前往</button>
      </form>
    </nav>
  )
}

export function DishLibraryView({ mealHistory, onUseDish, focusRequest, onToast }) {
  const [query, setQuery] = useState('')
  const [cuisine, setCuisine] = useState('all')
  const [region, setRegion] = useState('all')
  const [dishType, setDishType] = useState('all')
  const [catalogPage, setCatalogPage] = useState(1)
  const [results, setResults] = useState(() => dishes.slice(0, 36))
  const [pageInfo, setPageInfo] = useState({ page: 1, limit: 36, total: dishes.length, totalPages: Math.ceil(dishes.length / 36), hasNextPage: dishes.length > 36 })
  const [facets, setFacets] = useState({ summary: { dishes: dishes.length, relations: getDishGraphStats().edges, sourceBacked: dishes.length }, cuisines: [], regions: [], dishTypes: [] })
  const [catalogState, setCatalogState] = useState('loading')
  const [relatedDishes, setRelatedDishes] = useState([])
  const [selectedDish, setSelectedDish] = useState(null)
  const [mealType, setMealType] = useState('午餐')
  const [ingredientAdjustments, setIngredientAdjustments] = useState([])
  const [remoteImages, setRemoteImages] = useState({})
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const { favoriteByDishId, activeCollection, toggleFavorite } = useFavoriteCatalog()
  const searchInputRef = useRef(null)
  const dishResultsRef = useRef(null)
  const detailRef = useRef(null)
  const previousCatalogPageRef = useRef(1)
  const ingredientAnchorIdRef = useRef(0)
  const searchAnalysis = useMemo(() => analyzeDishQuery(query), [query])
  const recommendedPortion = useMemo(
    () => selectedDish ? calculateDishPortion(selectedDish, mealHistory, mealType) : null,
    [mealHistory, mealType, selectedDish],
  )
  const portion = useMemo(() => {
    if (!recommendedPortion || !ingredientAdjustments.length) return recommendedPortion
    return scalePortionFromIngredients(recommendedPortion, ingredientAdjustments)
  }, [ingredientAdjustments, recommendedPortion])
  const anchoredIngredientIndexes = new Set(ingredientAdjustments.map((adjustment) => adjustment.ingredientIndex))
  const nutritionPending = selectedDish?.nutritionConfidence === 'unverified'
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
    setIngredientAdjustments([])
  }, [mealType, selectedDish?.id])

  useEffect(() => {
    if (!focusRequest) return undefined
    const frame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [focusRequest])

  useEffect(() => {
    if (selectedDish && !results.some((dish) => dish.id === selectedDish.id)) setSelectedDish(null)
  }, [results, selectedDish?.id])

  useEffect(() => {
    if (!selectedDish) return undefined
    const previousFocus = document.activeElement
    const frame = window.requestAnimationFrame(() => detailRef.current?.focus({ preventScroll: true }))
    function closeOnEscape(event) {
      if (event.key === 'Escape') setSelectedDish(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('keydown', closeOnEscape)
      if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true })
    }
  }, [selectedDish?.id])

  useEffect(() => {
    if (previousCatalogPageRef.current === catalogPage) return
    previousCatalogPageRef.current = catalogPage
    const frame = window.requestAnimationFrame(() => dishResultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    return () => window.cancelAnimationFrame(frame)
  }, [catalogPage])

  function dishImage(dish, thumbnail = true) {
    const image = dishImageMetadata(dish)
    return (thumbnail ? image?.thumbnailUrl : image?.url) || dish.image
  }

  function dishImageMetadata(dish) {
    const remoteImage = remoteImages[dish.id]
    if (remoteImage && !remoteImage.reused) return remoteImage
    if (dish.image) return null
    return remoteImage || resolveLocalDishImage(dish)
  }

  function addIngredientAnchor() {
    if (!recommendedPortion) return
    setIngredientAdjustments((current) => {
      const usedIndexes = new Set(current.map((adjustment) => adjustment.ingredientIndex))
      const ingredientIndex = recommendedPortion.ingredients.findIndex((_ingredient, index) => !usedIndexes.has(index))
      if (ingredientIndex < 0) return current
      ingredientAnchorIdRef.current += 1
      return [...current, {
        id: ingredientAnchorIdRef.current,
        ingredientIndex,
        grams: String(recommendedPortion.ingredients[ingredientIndex].grams),
      }]
    })
  }

  function selectIngredientAnchor(anchorId, value) {
    if (!recommendedPortion) return
    const ingredientIndex = Number(value)
    const ingredient = recommendedPortion.ingredients[ingredientIndex]
    if (!ingredient) return
    setIngredientAdjustments((current) => current.map((adjustment) => adjustment.id === anchorId
      ? { ...adjustment, ingredientIndex, grams: String(ingredient.grams) }
      : adjustment))
  }

  function updateIngredientTarget(anchorId, grams) {
    setIngredientAdjustments((current) => current.map((adjustment) => adjustment.id === anchorId ? { ...adjustment, grams } : adjustment))
  }

  function normalizeIngredientTarget(anchorId) {
    setIngredientAdjustments((current) => current.map((adjustment) => {
      if (adjustment.id !== anchorId || !recommendedPortion) return adjustment
      const scaled = scalePortionFromIngredients(recommendedPortion, [adjustment])
      const fallbackGrams = recommendedPortion.ingredients[adjustment.ingredientIndex]?.grams
      return { ...adjustment, grams: String(scaled?.adjustment?.targetGrams || fallbackGrams || '') }
    }))
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
          <div className="library-result-head" ref={dishResultsRef}><span>找到 {pageInfo.total.toLocaleString('zh-CN')} 道好菜 <i className={`catalog-state ${catalogState}`}>{catalogState === 'online' ? '服务端目录' : catalogState === 'offline' ? '离线基础库' : '正在检索'}</i></span><button onClick={() => { setQuery(''); setCuisine('all'); setRegion('all'); setDishType('all'); setCatalogPage(1) }}>清空筛选</button></div>
          {pageInfo.totalPages > 1 && <CatalogPagination page={catalogPage} totalPages={pageInfo.totalPages} loading={catalogState === 'loading'} placement="top" onPageChange={setCatalogPage} />}
          <div className="dish-card-grid">
            {results.map((dish) => {
              const imageUrl = dishImage(dish)
              const imageMetadata = dishImageMetadata(dish)
              const imageReady = !imageUrl || Boolean(imageReadyMap[imageUrl])
              const isFavorited = favoriteByDishId.has(dish.id)
              return (
                <article
                  key={dish.id}
                  className={`dish-card ${selectedDish?.id === dish.id ? 'selected' : ''} ${isFavorited ? 'is-favorited' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-haspopup="dialog"
                  aria-expanded={selectedDish?.id === dish.id}
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
                    <i title={imageMetadata?.reused ? `${imageMetadata.sourceDishName}：${imageMetadata.matchReason}` : undefined}>{imageMetadata?.reused ? '同类示意图' : imageMetadata ? '☁ 云端' : dish.method}</i>
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
          {pageInfo.totalPages > 1 && <CatalogPagination page={catalogPage} totalPages={pageInfo.totalPages} loading={catalogState === 'loading'} placement="bottom" onPageChange={setCatalogPage} />}
          {!results.length && <div className="empty-library"><span>🍜</span><strong>这道菜还在后厨备菜</strong><small>换个关键词，或者等爬虫把它带回来。</small></div>}
        </section>
        {selectedDish && portion && <>
          <button className="dish-detail-backdrop" type="button" onClick={() => setSelectedDish(null)} aria-label="关闭菜品详情" />
          <aside className="dish-detail panel-card" ref={detailRef} role="dialog" aria-modal="true" aria-labelledby="dish-detail-title" tabIndex={-1}>
          <div
            className={`dish-detail-image ${!dishImage(selectedDish, false) || imageReadyMap[dishImage(selectedDish, false)] ? 'is-ready' : 'is-loading'}`}
            style={imageReadyMap[dishImage(selectedDish, false)] ? { backgroundImage: `url(${dishImage(selectedDish, false)})` } : undefined}
          >
            {dishImage(selectedDish, false) && !imageReadyMap[dishImage(selectedDish, false)] && <span className="image-skeleton-mark" />}
            {!dishImage(selectedDish, false) && <b className="dish-detail-fallback">🥘</b>}
            <span>{selectedDish.cuisine} · {selectedDish.method}{dishImageMetadata(selectedDish)?.reused ? ` · 同类示意图（${dishImageMetadata(selectedDish).sourceDishName}）` : dishImageMetadata(selectedDish) ? ' · MinIO' : ''}</span>
            <button
              className={`favorite-pin ${favoriteByDishId.has(selectedDish.id) ? 'active' : ''}`}
              onClick={(event) => handleToggleFavorite(selectedDish, event)}
              title={favoriteByDishId.has(selectedDish.id) ? '从收藏中移出' : `收藏到${activeCollection?.name || '默认收藏'}`}
            >
              <Heart size={15} fill={favoriteByDishId.has(selectedDish.id) ? 'currentColor' : 'none'} />
            </button>
            <button onClick={() => setSelectedDish(null)} aria-label="关闭菜品详情"><X size={18} /></button>
          </div>
          <div className="dish-detail-copy">
            <span className="section-kicker">PORTION ENGINE</span>
            <h3 id="dish-detail-title">{selectedDish.name}</h3>
            <p>这份菜是 <strong>{(selectedDish.taste || ['经典']).join('、')}</strong> 风味，系统会按你过去的饭量动态换算，也可以按手头的一种或多种食材反推整份配方。</p>
            <div className={`dish-evidence ${selectedDish.reviewStatus || 'candidate'}`}>
              {selectedDish.reviewStatus === 'generated' ? '家常搭配 · 组合规则生成' : selectedDish.source === 'howtocook' ? '开源配方 · 来源可追溯' : selectedDish.reviewStatus === 'candidate' || !selectedDish.reviewStatus ? '候选配方 · 待人工复核' : '项目配方 · 已审阅'}
              <small>{nutritionPending ? '营养数据待核验' : selectedDish.nutritionConfidence === 'verified' || selectedDish.nutritionConfidence === 'source_estimate' ? '营养数据来自可信来源' : '营养数据为估算值'}</small>
              {selectedDish.sourceUrl && <a href={selectedDish.sourceUrl} target="_blank" rel="noreferrer">查看配方来源 ↗</a>}
            </div>
            <div className="meal-type-switch">{['早餐', '午餐', '晚餐'].map((type) => <button className={mealType === type ? 'active' : ''} key={type} onClick={() => setMealType(type)}>{type}</button>)}</div>
            <div className="portion-highlight">
              <span>{portion.adjustment ? '配方系数' : '建议系数'}<strong>{portion.multiplier}×</strong></span>
              <span>{portion.adjustment ? '换算热量' : '单人热量'}<strong>{nutritionPending ? '待核验' : portion.nutrition.calories}{!nutritionPending && <small> kcal</small>}</strong></span>
              <span>蛋白质<strong>{nutritionPending ? '待核验' : portion.nutrition.protein}{!nutritionPending && <small> g</small>}</strong></span>
            </div>
            <div className="ingredient-scaler">
              <div className="ingredient-scaler-head">
                <span><strong>按现有食材反推整份用量</strong><small>{ingredientAdjustments.length >= 2 ? '多食材最小二乘拟合' : '添加已知克数，自动补齐其余食材'}</small></span>
                <button type="button" onClick={addIngredientAnchor} disabled={ingredientAdjustments.length >= recommendedPortion.ingredients.length}><Plus size={12} /> 添加食材</button>
              </div>
              {!ingredientAdjustments.length && <div className="ingredient-scaler-empty">至少添加一种食材；添加两种以上会自动拟合最一致的配方比例。</div>}
              <div className="ingredient-anchor-list">
                {ingredientAdjustments.map((adjustment) => {
                  const anchorIngredient = recommendedPortion.ingredients[adjustment.ingredientIndex]
                  return (
                    <div className="ingredient-anchor-row" key={adjustment.id}>
                      <select value={adjustment.ingredientIndex} onChange={(event) => selectIngredientAnchor(adjustment.id, event.target.value)} aria-label="选择已知食材">
                        {recommendedPortion.ingredients.map((ingredient, index) => <option disabled={index !== adjustment.ingredientIndex && anchoredIngredientIndexes.has(index)} key={`${ingredient.name}-${index}`} value={index}>{ingredient.name}</option>)}
                      </select>
                      <label>
                        <input
                          type="number"
                          min={Math.max(0.5, anchorIngredient.grams * 0.1)}
                          max={anchorIngredient.grams * 10}
                          step={anchorIngredient.grams < 10 ? 0.5 : 1}
                          value={adjustment.grams}
                          onChange={(event) => updateIngredientTarget(adjustment.id, event.target.value)}
                          onBlur={() => normalizeIngredientTarget(adjustment.id)}
                          aria-label={`${anchorIngredient.name}克数`}
                        />
                        <span>g</span>
                      </label>
                      <button type="button" onClick={() => setIngredientAdjustments((current) => current.filter((item) => item.id !== adjustment.id))} aria-label={`移除${anchorIngredient.name}`}><X size={12} /></button>
                    </div>
                  )
                })}
              </div>
              {portion.adjustment?.mode === 'regression' && <div className={`ingredient-fit-quality quality-${portion.adjustment.fitQuality === '高' ? 'high' : portion.adjustment.fitQuality === '中' ? 'medium' : 'low'}`}><strong>拟合系数 {portion.adjustment.scale}×</strong><span>输入一致性 {portion.adjustment.fitQuality} · 平均偏差 {portion.adjustment.meanErrorPercent}%</span></div>}
              {portion.adjustment?.constrained && <small>为避免异常比例，已限制为原建议的 0.1-10 倍。</small>}
              {ingredientAdjustments.length > 0 && <button className="ingredient-scaler-reset" type="button" onClick={() => setIngredientAdjustments([])}>清空并恢复系统建议</button>}
            </div>
            <div className="ingredient-list">
              <strong>这顿要准备</strong>
              {portion.ingredients.slice(0, 8).map((ingredient, index) => <span className={portion.adjustment?.anchors?.some((anchor) => anchor.ingredientIndex === index) ? 'is-anchor' : ''} key={`${ingredient.name}-${index}`}><em>{ingredient.name}</em><b>{ingredient.grams}g</b></span>)}
            </div>
            <small className="portion-reason"><Sparkles size={13} /> {portion.reason}</small>
            <div className="dish-detail-actions">
              <button className="primary-full" onClick={() => onUseDish({ ...selectedDish, image: dishImage(selectedDish, false) }, mealType, portion)}>{portion.adjustment ? '按当前配比' : '按我的饭量'}加入{mealType} <Plus size={16} /></button>
              <button className="outline-full" onClick={exportSelectedRecipe} disabled={isExportingPdf}><FileDown size={15} /> {isExportingPdf ? '正在生成 PDF…' : '导出这份食谱 PDF'}</button>
            </div>
          </div>
          <div className="relation-map"><div className="relation-map-head"><strong>这道菜和谁有关系？</strong><small>食材 · 做法 · 风味 · 菜系</small></div><div className="relation-canvas"><svg className="relation-lines" viewBox="0 0 320 210" preserveAspectRatio="none" aria-hidden="true">{relatedDishes.map((relatedDish, index) => { const point = relationNodeLayout[index]; return <g key={relatedDish.id}><line x1="160" y1="105" x2={point.x} y2={point.y} /><circle cx={point.x} cy={point.y} r="3" /><text x={(160 + point.x) / 2} y={(105 + point.y) / 2 - 4}>{relatedDish.relationScore}</text></g> })}</svg><span className="relation-center">{selectedDish.name}</span>{relatedDishes.map((relatedDish, index) => { const point = relationNodeLayout[index]; return <button key={relatedDish.id} className="relation-node" style={{ left: `${point.x / 3.2}%`, top: `${point.y / 2.1}%` }} onClick={() => setSelectedDish(relatedDish)} title={`关系强度 ${relatedDish.relationScore}`}><i>{relatedDish.name}</i><small>{relatedDish.relationReason}</small></button> })}{!relatedDishes.length && <small className="relation-empty">暂时没有达到阈值的关系</small>}</div></div>
          </aside>
        </>}
      </div>
    </div>
  )
}
