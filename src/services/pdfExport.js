function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function documentTemplate(title, content) {
  return `<!doctype html>
  <html lang="zh-CN">
    <head>
      <meta charset="UTF-8" />
      <title>${escapeHtml(title)}</title>
      <style>
        @page { size: A4; margin: 14mm; }
        * { box-sizing: border-box; }
        body { margin: 0; color: #403930; font-family: "Microsoft YaHei", "PingFang SC", sans-serif; background: #fffdf8; }
        header { padding: 24px 26px; color: white; border-radius: 18px; background: linear-gradient(135deg, #e86f48, #f2aa54); }
        header small { display: block; margin-bottom: 8px; opacity: .82; font-size: 11px; letter-spacing: .14em; }
        header h1 { margin: 0; font-size: 28px; }
        header p { margin: 8px 0 0; font-size: 12px; opacity: .9; }
        main { padding: 22px 4px 0; }
        h2 { margin: 0 0 12px; font-size: 17px; }
        .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
        .summary span { padding: 13px; border: 1px solid #eadfd3; border-radius: 12px; background: #fff; color: #8b8177; font-size: 10px; }
        .summary strong { display: block; margin-top: 5px; color: #443c34; font-size: 17px; }
        .card { margin-bottom: 16px; padding: 17px; border: 1px solid #eadfd3; border-radius: 14px; background: white; }
        .ingredients { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0 22px; }
        .ingredients span { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #eadfd3; font-size: 12px; }
        .ingredients b { color: #e46d48; }
        table { width: 100%; border-collapse: collapse; overflow: hidden; border-radius: 12px; }
        th, td { padding: 11px 8px; border: 1px solid #eadfd3; text-align: center; font-size: 11px; }
        th { color: #9a6b39; background: #fff2df; }
        footer { margin-top: 22px; padding-top: 12px; border-top: 1px solid #eadfd3; color: #9a9187; font-size: 9px; line-height: 1.7; }
      </style>
    </head>
    <body>${content}</body>
  </html>`
}

async function exportDocument(title, html) {
  if (window.mealDesktop?.exportPdf) {
    const result = await window.mealDesktop.exportPdf({ title, html })
    if (!result?.ok && !result?.canceled) throw new Error(result?.error || 'PDF 导出失败')
    return result
  }

  const printWindow = window.open('', '_blank', 'width=900,height=1100')
  if (!printWindow) throw new Error('浏览器阻止了打印窗口')
  printWindow.opener = null
  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
  window.setTimeout(() => printWindow.print(), 250)
  return { ok: true, browserPrint: true }
}

export function exportRecipeToPdf(dish, portion, mealType) {
  const ingredients = portion.ingredients.map((ingredient) => `<span><em>${escapeHtml(ingredient.name)}</em><b>${escapeHtml(ingredient.grams)}g</b></span>`).join('')
  const nutritionPending = dish.nutritionConfidence === 'unverified'
  const calories = nutritionPending ? '待核验' : `${escapeHtml(portion.nutrition.calories)} kcal`
  const protein = nutritionPending ? '待核验' : `${escapeHtml(portion.nutrition.protein)} g`
  const nutritionNote = nutritionPending ? '本配方营养数据仍待核验，请勿把空缺数值作为饮食依据。' : '营养数据为估算值，只作日常饮食参考。'
  const title = `${dish.name}食谱`
  const content = `
    <header><small>好吃的今天 · PERSONAL RECIPE</small><h1>${escapeHtml(dish.name)}</h1><p>${escapeHtml(dish.cuisine)} · ${escapeHtml(dish.method)} · ${escapeHtml(mealType)}建议份量 ${escapeHtml(portion.multiplier)}×</p></header>
    <main>
      <section class="summary"><span>热量<strong>${calories}</strong></span><span>蛋白质<strong>${protein}</strong></span><span>风味<strong>${escapeHtml((dish.taste || ['经典']).join('、'))}</strong></span></section>
      <section class="card"><h2>食材与用量</h2><div class="ingredients">${ingredients}</div></section>
      <section class="card"><h2>个性化换算说明</h2><p>${escapeHtml(portion.reason)}</p><p>标签：${escapeHtml((dish.tags || ['家常']).join(' · '))}</p></section>
      <footer>由“好吃的今天”按历史饭量生成。${nutritionNote}疾病治疗及特殊医学饮食请咨询医生或注册营养师。</footer>
    </main>`
  return exportDocument(title, documentTemplate(title, content))
}

export function exportWeeklyPlanToPdf(plan, label) {
  const rows = plan.map((day) => `<tr><th>${escapeHtml(day[0])}</th>${day.slice(1).map((meal) => `<td>${escapeHtml(meal)}</td>`).join('')}</tr>`).join('')
  const title = `${label}饮食计划`
  const content = `
    <header><small>好吃的今天 · WEEKLY MEAL PLAN</small><h1>${escapeHtml(label)}饮食计划</h1><p>一周三餐安排，一眼看明白，照着吃不发愁。</p></header>
    <main><section class="card"><table><thead><tr><th>日期</th><th>早餐</th><th>午餐</th><th>晚餐</th></tr></thead><tbody>${rows}</tbody></table></section><footer>饮食计划可根据个人健康状况、过敏和实际饭量调整。营养建议只作生活参考。</footer></main>`
  return exportDocument(title, documentTemplate(title, content))
}
