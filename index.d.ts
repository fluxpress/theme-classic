import { type ThemeConfigBase } from 'fluxpress'

export interface ThemeConfig extends ThemeConfigBase {
  site: {
    lang: string
    title: string
    copyright: string
    author: string
    ipc?: string
  }
  per_page: number
}
