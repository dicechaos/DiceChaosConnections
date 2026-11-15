import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      saveCampaign: (
        data: string,
        suggestedTitle?: string,
        options?: { saveAs?: boolean }
      ) => Promise<{ success: boolean; filePath?: string; error?: string; canceled?: boolean }>
      loadCampaign: () => Promise<{
        success: boolean
        data?: string
        filePath?: string
        error?: string
        canceled?: boolean
      }>
      autoSaveCampaign: (
        data: string,
        campaignTitle?: string
      ) => Promise<{
        success: boolean
        filePath?: string
        noActiveFile?: boolean
        recoverySaved?: boolean
        error?: string
      }>
      clearActiveCampaign: (campaignTitle?: string) => Promise<{ success: boolean }>
      askSaveNewMap: () => Promise<number>
      setDirtyState: (dirty: boolean) => void

      savePlayerJson: (
        data: string,
        suggestedTitle?: string
      ) => Promise<{ success: boolean; filePath?: string; error?: string; canceled?: boolean }>
      importPartyNotesFile: () => Promise<{
        success: boolean
        data?: string
        filePath?: string
        error?: string
        canceled?: boolean
      }>

      savePng: (
        dataUrl: string,
        suggestedName?: string
      ) => Promise<{ success: boolean; filePath?: string; error?: string; canceled?: boolean }>
      saveMarkdownDossier: (
        markdown: string,
        suggestedName?: string
      ) => Promise<{ success: boolean; filePath?: string; error?: string; canceled?: boolean }>
      exportObsidianVault: (
        vaultFolderName: string,
        entries: Array<{ relativePath: string; content: string; encoding?: 'utf8' | 'base64' }>
      ) => Promise<{
        success: boolean
        folderPath?: string
        fileCount?: number
        error?: string
        canceled?: boolean
      }>
      savePdfDossier: (
        htmlContent: string,
        suggestedName?: string
      ) => Promise<{ success: boolean; filePath?: string; error?: string; canceled?: boolean }>

      openPlayerWindow: () => Promise<{ isOpen: boolean; alreadyLoaded: boolean }>
      closePlayerWindow: () => Promise<{ isOpen: boolean }>
      isPlayerWindowOpen: () => Promise<boolean>
      notifyPlayerWindowMounted: () => void
      pushPlayerWindowState: (payload: unknown) => void
      pushPlayerWindowCommand: (command: unknown) => void
      toggleWindowFullscreen: () => Promise<{ isFullScreen: boolean }>

      onPlayerWindowReady: (callback: () => void) => () => void
      onPlayerWindowClosed: (callback: () => void) => () => void
      onPlayerWindowState: (callback: (payload: any) => void) => () => void
      onPlayerWindowCommand: (callback: (command: any) => void) => () => void

      onSaveAndQuit: (callback: () => void) => () => void
      confirmQuit: () => void
    }
  }
}
