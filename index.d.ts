import { type ThemeConfigBase } from '@fluxpress/core'

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
