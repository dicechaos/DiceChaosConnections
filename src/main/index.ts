import { app, shell, BrowserWindow, ipcMain, dialog, nativeImage } from 'electron'
import { join, basename, resolve, sep } from 'path'
import * as fs from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import iconPng from '../../resources/icon.png?asset'
import iconIco from '../../resources/icon.ico?asset'

if (process.platform === 'win32') {
  app.setAppUserModelId('com.dicechaos.connections')
}

function getWindowIcon(): Electron.NativeImage | undefined {
  if (process.platform === 'darwin') return undefined
  const rawPath = process.platform === 'win32' ? iconIco : iconPng
  const unpackedPath = rawPath.replace('app.asar', 'app.asar.unpacked')
  const resolvedPath = fs.existsSync(unpackedPath) ? unpackedPath : rawPath
  const img = nativeImage.createFromPath(resolvedPath)
  return img.isEmpty() ? undefined : img
}

let isQuitting = false
let hasUnsavedChanges = false
let activeCampaignPath: string | null = null
let mainWindow: BrowserWindow | null = null
let playerWindow: BrowserWindow | null = null

function writeFileAtomicSync(filePath: string, content: string): void {
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`
  try {
    fs.writeFileSync(tmpPath, content, 'utf-8')
    fs.renameSync(tmpPath, filePath)
  } catch {
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath)
    } catch {
      // Ignore temporary cleanup failure
    }
    fs.writeFileSync(filePath, content, 'utf-8')
  }
}

function sanitizeFileStem(name?: string, fallback = 'campaign'): string {
  const cleaned = (name || '')
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^\.+|\.+$/g, '')
    .trim()
  return cleaned || fallback
}

function updateWindowTitle(win: BrowserWindow | null, campaignTitle?: string): void {
  if (!win || win.isDestroyed()) return
  const fileLabel = activeCampaignPath ? basename(activeCampaignPath) : 'Untitled Map'
  const prefix = campaignTitle?.trim() ? `${campaignTitle.trim()} (${fileLabel})` : fileLabel
  win.setTitle(`Dice Chaos Connections — ${prefix}`)
}

function closePlayerWindow(): void {
  if (playerWindow && !playerWindow.isDestroyed()) {
    playerWindow.destroy()
  }
  playerWindow = null
}

ipcMain.on('confirm-quit', () => {
  isQuitting = true
  hasUnsavedChanges = false
  closePlayerWindow()
  app.quit()
})

ipcMain.on('campaign:setDirtyState', (_event, dirty: boolean) => {
  hasUnsavedChanges = Boolean(dirty)
})

function createPlayerWindow(): { alreadyLoaded: boolean } {
  if (playerWindow && !playerWindow.isDestroyed()) {
    if (playerWindow.isMinimized()) playerWindow.restore()
    playerWindow.focus()
    return { alreadyLoaded: !playerWindow.webContents.isLoading() }
  }

  const windowIcon = getWindowIcon()
  playerWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 760,
    minHeight: 520,
    show: false,
    autoHideMenuBar: true,
    title: 'Dice Chaos Connections — Player Screen',
    ...(windowIcon ? { icon: windowIcon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (windowIcon && process.platform !== 'darwin') {
    playerWindow.setIcon(windowIcon)
  }

  playerWindow.on('ready-to-show', () => {
    playerWindow?.show()
  })

  playerWindow.webContents.on('did-finish-load', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('playerWindow:ready')
    }
  })

  playerWindow.on('closed', () => {
    playerWindow = null
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('playerWindow:closed')
    }
  })

  playerWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const sepChar = process.env['ELECTRON_RENDERER_URL'].includes('?') ? '&' : '?'
    playerWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}${sepChar}windowMode=playerScreen`)
  } else {
    playerWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { windowMode: 'playerScreen' }
    })
  }

  return { alreadyLoaded: false }
}

function createWindow(): void {
  const windowIcon = getWindowIcon()
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    title: 'Dice Chaos Connections — The Hobbit: Eve of Five Armies',
    ...(windowIcon ? { icon: windowIcon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (windowIcon && process.platform !== 'darwin') {
    mainWindow.setIcon(windowIcon)
  }

  mainWindow.on('close', async (e) => {
    if (isQuitting || !hasUnsavedChanges) {
      isQuitting = true
      closePlayerWindow()
      return
    }
    e.preventDefault()

    const { response } = await dialog.showMessageBox(mainWindow!, {
      type: 'question',
      buttons: ['Save and Quit', 'Quit Without Saving', 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      title: 'Unsaved Campaign Changes',
      message: 'You have unsaved changes. Do you want to save your campaign before quitting?'
    })

    if (response === 1) {
      isQuitting = true
      hasUnsavedChanges = false
      closePlayerWindow()
      app.quit()
    } else if (response === 0) {
      mainWindow?.webContents.send('trigger-save-and-quit')
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
    closePlayerWindow()
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.dicechaos.connections')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // ==================== CAMPAIGN FILE LIFECYCLE ====================
  ipcMain.handle(
    'dialog:saveCampaign',
    async (
      event,
      data: string,
      suggestedTitle?: string,
      options?: { saveAs?: boolean }
    ) => {
      const window = BrowserWindow.fromWebContents(event.sender)
      if (activeCampaignPath && !options?.saveAs) {
        try {
          writeFileAtomicSync(activeCampaignPath, data)
          hasUnsavedChanges = false
          updateWindowTitle(window, suggestedTitle)
          return { success: true, filePath: activeCampaignPath }
        } catch (e: any) {
          return { success: false, error: e.message }
        }
      }

      const fallbackName = `${sanitizeFileStem(suggestedTitle, 'campaign')}.json`
      const result = await dialog.showSaveDialog(window!, {
        title: options?.saveAs ? 'Save Campaign Map As' : 'Save Campaign Map',
        defaultPath: activeCampaignPath || fallbackName,
        filters: [{ name: 'Campaign JSON Files', extensions: ['json'] }]
      })

      if (!result.canceled && result.filePath) {
        try {
          activeCampaignPath = result.filePath
          writeFileAtomicSync(result.filePath, data)
          hasUnsavedChanges = false
          updateWindowTitle(window, suggestedTitle)
          return { success: true, filePath: result.filePath }
        } catch (e: any) {
          return { success: false, error: e.message }
        }
      }
      return { success: false, canceled: true }
    }
  )

  ipcMain.handle('dialog:loadCampaign', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showOpenDialog(window!, {
      title: 'Load Campaign Map',
      filters: [{ name: 'Campaign JSON Files', extensions: ['json'] }],
      properties: ['openFile']
    })

    if (!result.canceled && result.filePaths.length > 0) {
      try {
        const filePath = result.filePaths[0]
        activeCampaignPath = filePath
        hasUnsavedChanges = false
        const data = fs.readFileSync(filePath, 'utf-8')
        updateWindowTitle(window)
        return { success: true, data, filePath }
      } catch (e: any) {
        return { success: false, error: e.message }
      }
    }
    return { success: false, canceled: true }
  })

  ipcMain.handle('dialog:autoSaveCampaign', async (event, data: string, campaignTitle?: string) => {
    if (activeCampaignPath) {
      try {
        writeFileAtomicSync(activeCampaignPath, data)
        hasUnsavedChanges = false
        const window = BrowserWindow.fromWebContents(event.sender)
        updateWindowTitle(window, campaignTitle)
        return { success: true, filePath: activeCampaignPath }
      } catch (e: any) {
        return { success: false, error: e.message }
      }
    }
    try {
      const recoveryPath = join(app.getPath('userData'), 'autosave-recovery.json')
      writeFileAtomicSync(recoveryPath, data)
      return { success: false, noActiveFile: true, recoverySaved: true }
    } catch (e: any) {
      return { success: false, noActiveFile: true, recoverySaved: false, error: e.message }
    }
  })

  ipcMain.handle('dialog:clearActiveCampaign', async (event, campaignTitle?: string) => {
    activeCampaignPath = null
    hasUnsavedChanges = false
    const window = BrowserWindow.fromWebContents(event.sender)
    updateWindowTitle(window, campaignTitle)
    return { success: true }
  })

  ipcMain.handle('dialog:askSaveNewMap', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showMessageBox(window!, {
      type: 'question',
      buttons: ['Save', "Don't Save", 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      title: 'New Map',
      message: 'Do you want to save your current map before creating a new one?'
    })
    return result.response
  })

  // ==================== PLAYER HANDOUT .JSON & PARTY NOTES MERGE ====================
  // Note: Neither handler mutates `activeCampaignPath`, keeping the DM's master file safe!
  ipcMain.handle('dialog:savePlayerJson', async (event, data: string, suggestedTitle?: string) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const defaultFile = `${sanitizeFileStem(suggestedTitle, 'campaign')} - Player Handout.json`
    const result = await dialog.showSaveDialog(window!, {
      title: 'Export Spoiler-Free Player Campaign (.json)',
      defaultPath: defaultFile,
      filters: [{ name: 'Player Campaign JSON', extensions: ['json'] }]
    })

    if (!result.canceled && result.filePath) {
      try {
        fs.writeFileSync(result.filePath, data, 'utf-8')
        return { success: true, filePath: result.filePath }
      } catch (e: any) {
        return { success: false, error: e.message }
      }
    }
    return { success: false, canceled: true }
  })

  ipcMain.handle('dialog:importPartyNotesFile', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showOpenDialog(window!, {
      title: 'Select Player Campaign (.json) to Merge Party Notes & Theories',
      filters: [{ name: 'Campaign JSON Files', extensions: ['json'] }],
      properties: ['openFile']
    })

    if (!result.canceled && result.filePaths.length > 0) {
      try {
        const filePath = result.filePaths[0]
        const data = fs.readFileSync(filePath, 'utf-8')
        return { success: true, data, filePath }
      } catch (e: any) {
        return { success: false, error: e.message }
      }
    }
    return { success: false, canceled: true }
  })

  // ==================== PNG, MARKDOWN, OBSIDIAN VAULT & PDF EXPORTS ====================
  ipcMain.handle('dialog:savePng', async (event, dataUrl: string, suggestedName?: string) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const cleanBase = sanitizeFileStem(suggestedName, 'campaign-map')
    const result = await dialog.showSaveDialog(window!, {
      title: 'Export Map as PNG',
      defaultPath: `${cleanBase}.png`,
      filters: [{ name: 'PNG Image', extensions: ['png'] }]
    })

    if (!result.canceled && result.filePath) {
      try {
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '')
        fs.writeFileSync(result.filePath, Buffer.from(base64Data, 'base64'))
        return { success: true, filePath: result.filePath }
      } catch (e: any) {
        return { success: false, error: e.message }
      }
    }
    return { success: false, canceled: true }
  })

  ipcMain.handle(
    'dialog:saveMarkdownDossier',
    async (event, markdown: string, suggestedName?: string) => {
      const window = BrowserWindow.fromWebContents(event.sender)
      const cleanBase = sanitizeFileStem(suggestedName, 'campaign-dossier')
      const result = await dialog.showSaveDialog(window!, {
        title: 'Export Campaign Dossier (.md)',
        defaultPath: `${cleanBase}.md`,
        filters: [{ name: 'Markdown Document', extensions: ['md'] }]
      })

      if (!result.canceled && result.filePath) {
        try {
          fs.writeFileSync(result.filePath, markdown, 'utf-8')
          return { success: true, filePath: result.filePath }
        } catch (e: any) {
          return { success: false, error: e.message }
        }
      }
      return { success: false, canceled: true }
    }
  )

  ipcMain.handle(
    'dialog:exportObsidianVault',
    async (
      event,
      vaultFolderName: string,
      entries: Array<{ relativePath: string; content: string; encoding?: 'utf8' | 'base64' }>
    ) => {
      const window = BrowserWindow.fromWebContents(event.sender)
      const result = await dialog.showOpenDialog(window!, {
        title: 'Choose Folder to Export Obsidian Vault Into',
        buttonLabel: 'Export Here',
        properties: ['openDirectory', 'createDirectory']
      })

      if (!result.canceled && result.filePaths.length > 0) {
        try {
          const parentDir = result.filePaths[0]
          const safeVaultName = sanitizeFileStem(vaultFolderName, 'Campaign Vault')
          const vaultRoot = resolve(parentDir, safeVaultName)
          fs.mkdirSync(vaultRoot, { recursive: true })

          let written = 0
          for (const entry of entries) {
            const targetPath = resolve(vaultRoot, entry.relativePath)
            // Guard against path traversal outside vaultRoot
            if (targetPath !== vaultRoot && !targetPath.startsWith(vaultRoot + sep)) {
              continue
            }
            fs.mkdirSync(resolve(targetPath, '..'), { recursive: true })
            if (entry.encoding === 'base64') {
              fs.writeFileSync(targetPath, Buffer.from(entry.content, 'base64'))
            } else {
              fs.writeFileSync(targetPath, entry.content, 'utf-8')
            }
            written++
          }

          return { success: true, folderPath: vaultRoot, fileCount: written }
        } catch (e: any) {
          return { success: false, error: e.message }
        }
      }
      return { success: false, canceled: true }
    }
  )

  ipcMain.handle(
    'dialog:savePdfDossier',
    async (event, htmlContent: string, suggestedName?: string) => {
      const window = BrowserWindow.fromWebContents(event.sender)
      const cleanBase = sanitizeFileStem(suggestedName, 'campaign-dossier')
      const result = await dialog.showSaveDialog(window!, {
        title: 'Export Formatted Campaign Handout (.pdf)',
        defaultPath: `${cleanBase}.pdf`,
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
      })

      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true }
      }

      const tempHtmlPath = join(
        app.getPath('temp'),
        `dcc-dossier-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.html`
      )
      let pdfWin: BrowserWindow | null = null

      try {
        fs.writeFileSync(tempHtmlPath, htmlContent, 'utf-8')
        pdfWin = new BrowserWindow({
          width: 960,
          height: 1240,
          show: false,
          webPreferences: {
            sandbox: true,
            javascript: false
          }
        })

        await pdfWin.loadFile(tempHtmlPath)
        await new Promise((r) => setTimeout(r, 180))

        const pdfBuffer = await pdfWin.webContents.printToPDF({
          printBackground: true,
          pageSize: 'Letter',
          margins: {
            top: 0.45,
            bottom: 0.45,
            left: 0.45,
            right: 0.45
          }
        })

        fs.writeFileSync(result.filePath, pdfBuffer)
        return { success: true, filePath: result.filePath }
      } catch (e: any) {
        return { success: false, error: e.message }
      } finally {
        try {
          if (pdfWin && !pdfWin.isDestroyed()) pdfWin.destroy()
        } catch {
          // ignore
        }
        try {
          if (fs.existsSync(tempHtmlPath)) fs.unlinkSync(tempHtmlPath)
        } catch {
          // ignore
        }
      }
    }
  )

  // ==================== 2ND-SCREEN PLAYER WINDOW IPC ====================
  ipcMain.handle('playerWindow:open', () => {
    const res = createPlayerWindow()
    return { isOpen: true, alreadyLoaded: res.alreadyLoaded }
  })

  ipcMain.handle('playerWindow:close', () => {
    closePlayerWindow()
    return { isOpen: false }
  })

  ipcMain.handle('playerWindow:isOpen', () => {
    return Boolean(playerWindow && !playerWindow.isDestroyed())
  })

  ipcMain.on('playerWindow:mounted', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('playerWindow:ready')
    }
  })

  ipcMain.on('playerWindow:pushState', (_, payload) => {
    if (playerWindow && !playerWindow.isDestroyed()) {
      const titleSuffix = payload?.campaignTitle?.trim()
        ? ` — ${payload.campaignTitle.trim()}`
        : ''
      playerWindow.setTitle(`Player Screen${titleSuffix}`)
      playerWindow.webContents.send('playerWindow:stateUpdate', payload)
    }
  })

  ipcMain.on('playerWindow:pushCommand', (_, command) => {
    if (playerWindow && !playerWindow.isDestroyed()) {
      playerWindow.webContents.send('playerWindow:command', command)
    }
  })

  ipcMain.handle('window:toggleFullscreen', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win || win.isDestroyed()) return { isFullScreen: false }
    const next = !win.isFullScreen()
    win.setFullScreen(next)
    return { isFullScreen: next }
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
