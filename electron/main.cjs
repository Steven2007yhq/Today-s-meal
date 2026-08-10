const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const dotenv = require('dotenv')
const { createAiService } = require('./ai-service.cjs')

const isDevelopment = !app.isPackaged
dotenv.config({ path: path.join(__dirname, '../.env.desktop'), quiet: true })
let aiService = null

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1120,
    minHeight: 720,
    backgroundColor: '#F7F4EC',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#f7f4ec',
      symbolColor: '#493f34',
      height: 38,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDevelopment) {
    window.loadURL('http://localhost:5173')
  } else {
    window.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  registerWindowShortcuts(window)
}

// titleBarStyle: 'hidden' removes the menu bar, and with it Electron's built-in
// reload and zoom accelerators. Re-bind them directly on the web contents.
function registerWindowShortcuts(window) {
  const zoomStep = 0.5
  const minZoomLevel = -3
  const maxZoomLevel = 4

  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    const key = String(input.key).toLowerCase()
    const withModifier = input.control || input.meta

    if (key === 'f5' || (withModifier && (key === 'r' || key === 'n'))) {
      event.preventDefault()
      window.webContents.reload()
      return
    }
    if (!withModifier) return

    const zoomLevel = window.webContents.getZoomLevel()
    if (key === '=' || key === '+' || key === 'add') {
      event.preventDefault()
      window.webContents.setZoomLevel(Math.min(zoomLevel + zoomStep, maxZoomLevel))
    } else if (key === '-' || key === '_' || key === 'subtract') {
      event.preventDefault()
      window.webContents.setZoomLevel(Math.max(zoomLevel - zoomStep, minZoomLevel))
    } else if (key === '0') {
      event.preventDefault()
      window.webContents.setZoomLevel(0)
    }
  })
}

ipcMain.handle('ai:chat', async (_event, payload) => {
  try {
    return await aiService.chat(payload)
  } catch (error) {
    return { demo: true, apiError: error instanceof Error ? error.message : 'unknown error' }
  }
})

ipcMain.handle('ai:get-config', () => aiService.getPublicConfiguration())
ipcMain.handle('ai:test', () => aiService.testConnection())

ipcMain.handle('app:open-readme', async () => {
  const readmePath = app.isPackaged
    ? path.join(process.resourcesPath, 'README.md')
    : path.join(app.getAppPath(), 'README.md')
  const errorMessage = await shell.openPath(readmePath)
  return { ok: !errorMessage, error: errorMessage }
})

ipcMain.handle('pdf:export', async (event, payload) => {
  const title = String(payload?.title || '饮食计划').slice(0, 80)
  const html = String(payload?.html || '')
  if (!html || html.length > 600_000) return { ok: false, error: 'PDF 内容无效或过大' }

  const safeTitle = title.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-').trim() || '饮食计划'
  const parentWindow = BrowserWindow.fromWebContents(event.sender)
  const saveResult = await dialog.showSaveDialog(parentWindow, {
    title: '导出食谱 PDF',
    defaultPath: path.join(app.getPath('documents'), `${safeTitle}.pdf`),
    filters: [{ name: 'PDF 文档', extensions: ['pdf'] }],
  })
  if (saveResult.canceled || !saveResult.filePath) return { ok: false, canceled: true }

  let printWindow
  try {
    printWindow = new BrowserWindow({
      show: false,
      width: 900,
      height: 1200,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
    })
    await printWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(html)}`)
    const pdfBuffer = await printWindow.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      landscape: false,
      margins: { top: 0.35, bottom: 0.35, left: 0.35, right: 0.35 },
    })
    await fs.promises.writeFile(saveResult.filePath, pdfBuffer)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'PDF 导出失败' }
  } finally {
    if (printWindow && !printWindow.isDestroyed()) printWindow.destroy()
  }
})

app.whenReady().then(() => {
  aiService = createAiService({
    app,
  })
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
