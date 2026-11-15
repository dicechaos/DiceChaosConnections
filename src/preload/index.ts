import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  // Campaign File Lifecycle
  saveCampaign: (data: string, suggestedTitle?: string, options?: { saveAs?: boolean }) =>
    ipcRenderer.invoke('dialog:saveCampaign', data, suggestedTitle, options),
  loadCampaign: () => ipcRenderer.invoke('dialog:loadCampaign'),
  autoSaveCampaign: (data: string, campaignTitle?: string) =>
    ipcRenderer.invoke('dialog:autoSaveCampaign', data, campaignTitle),
  clearActiveCampaign: (campaignTitle?: string) =>
    ipcRenderer.invoke('dialog:clearActiveCampaign', campaignTitle),
  askSaveNewMap: () => ipcRenderer.invoke('dialog:askSaveNewMap'),
  setDirtyState: (dirty: boolean) => ipcRenderer.send('campaign:setDirtyState', dirty),

  // Player Handout .json & Party Notes Merge
  savePlayerJson: (data: string, suggestedTitle?: string) =>
    ipcRenderer.invoke('dialog:savePlayerJson', data, suggestedTitle),
  importPartyNotesFile: () => ipcRenderer.invoke('dialog:importPartyNotesFile'),

  // PNG & Campaign Dossiers (.md, Obsidian Vault, .pdf)
  savePng: (dataUrl: string, suggestedName?: string) =>
    ipcRenderer.invoke('dialog:savePng', dataUrl, suggestedName),
  saveMarkdownDossier: (markdown: string, suggestedName?: string) =>
    ipcRenderer.invoke('dialog:saveMarkdownDossier', markdown, suggestedName),
  exportObsidianVault: (
    vaultFolderName: string,
    entries: Array<{ relativePath: string; content: string; encoding?: 'utf8' | 'base64' }>
  ) => ipcRenderer.invoke('dialog:exportObsidianVault', vaultFolderName, entries),
  savePdfDossier: (htmlContent: string, suggestedName?: string) =>
    ipcRenderer.invoke('dialog:savePdfDossier', htmlContent, suggestedName),

  // 2nd-Screen Player Window
  openPlayerWindow: () => ipcRenderer.invoke('playerWindow:open'),
  closePlayerWindow: () => ipcRenderer.invoke('playerWindow:close'),
  isPlayerWindowOpen: () => ipcRenderer.invoke('playerWindow:isOpen'),
  notifyPlayerWindowMounted: () => ipcRenderer.send('playerWindow:mounted'),
  pushPlayerWindowState: (payload: unknown) =>
    ipcRenderer.send('playerWindow:pushState', payload),
  pushPlayerWindowCommand: (command: unknown) =>
    ipcRenderer.send('playerWindow:pushCommand', command),
  toggleWindowFullscreen: () => ipcRenderer.invoke('window:toggleFullscreen'),

  onPlayerWindowReady: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('playerWindow:ready', handler)
    return () => ipcRenderer.removeListener('playerWindow:ready', handler)
  },
  onPlayerWindowClosed: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('playerWindow:closed', handler)
    return () => ipcRenderer.removeListener('playerWindow:closed', handler)
  },
  onPlayerWindowState: (callback: (payload: any) => void) => {
    const handler = (_: unknown, payload: any) => callback(payload)
    ipcRenderer.on('playerWindow:stateUpdate', handler)
    return () => ipcRenderer.removeListener('playerWindow:stateUpdate', handler)
  },
  onPlayerWindowCommand: (callback: (command: any) => void) => {
    const handler = (_: unknown, command: any) => callback(command)
    ipcRenderer.on('playerWindow:command', handler)
    return () => ipcRenderer.removeListener('playerWindow:command', handler)
  },

  // Quit lifecycle
  onSaveAndQuit: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('trigger-save-and-quit', handler)
    return () => {
      ipcRenderer.removeListener('trigger-save-and-quit', handler)
    }
  },
  confirmQuit: () => ipcRenderer.send('confirm-quit')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
