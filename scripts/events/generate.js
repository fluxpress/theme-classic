import {
  DATA_PATH__ISSUES,
  loadDataFromFile,
  OUTPUT_PATH,
  readFluxPressThemeConfig,
  readThemePath,
} from '@fluxpress/core'
import ejs from 'ejs'
import fs from 'fs-extra'
import { marked } from 'marked'
import path from 'node:path'

const THEME_PATH = await readThemePath()
const THEME_LAYOUT_PATH = path.join(THEME_PATH, 'layout')
const THEME_SOURCE_PATH = path.join(THEME_PATH, 'source')

export default function (fluxpress) {
  fluxpress.on('generate', async () => {
    /** @type import('@fluxpress/core').DataIssues */
    const dataIssues = await loadDataFromFile(DATA_PATH__ISSUES)

    await generatePosts(dataIssues)
    await generatePage(dataIssues)
    await generateArchives(dataIssues)
    await generateCategories(dataIssues)
    await generateTags(dataIssues)
    await generateAbout()
    await generate404()

    await fs.copy(THEME_SOURCE_PATH, OUTPUT_PATH)
  })
}

/** @type import('../../index.d.ts').ThemeConfig */
const themeConfig = await readFluxPressThemeConfig()

async function generateHtmlFromTemplate(
  templatePath,
  outputPath,
  data,
  headTitle,
) {
  const htmlContent = await ejs.renderFile(templatePath, data)
  const html = await ejs.renderFile(
    path.join(THEME_LAYOUT_PATH, 'html-container.ejs'),
    {
      title: headTitle,
      content: htmlContent,
    },
    {
      escape: null,
    },
  )
  await fs.outputFile(outputPath, html)
}

async function generatePosts(dataIssues) {
  const { issues } = dataIssues

  for (const issue of issues) {
    await generateHtmlFromTemplate(
      path.join(THEME_LAYOUT_PATH, 'posts', 'index.ejs'),
      path.join(OUTPUT_PATH, 'posts', `${issue.id}`, 'index.html'),
      {
        title: issue.title,
        content: marked(issue.body ?? ''),
        comments: issue.comments_list.map((comment) => ({
          avatar: comment.user.avatar_url,
          username: comment.user.login,
          content: marked(comment.body ?? ''),
        })),
      },
      issue.title,
    )
  }
}

async function generatePage(dataIssues) {
  const { issues } = dataIssues

  const pageCount = Math.ceil(issues.length / themeConfig.per_page)
  for (let i = 0; i < pageCount; i++) {
    await generateHtmlFromTemplate(
      path.join(THEME_LAYOUT_PATH, 'page', 'index.ejs'),
      i === 0
        ? path.join(OUTPUT_PATH, 'index.html')
        : path.join(OUTPUT_PATH, 'page', `${i + 1}`, 'index.html'),
      {
        posts: issues.slice(
          themeConfig.per_page * i,
          themeConfig.per_page * (i + 1),
        ),
        pageCount,
        currentPage: i + 1,
      },
      `首页${i === 0 ? '' : ' - ' + (i + 1)}`,
    )
  }
}

async function generateArchives(dataIssues) {
  const { issues } = dataIssues

  const postsByMonthMap = new Map()
  issues.forEach((issue) => {
    const date = new Date(issue.created_at)
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    if (postsByMonthMap.has(month)) {
      postsByMonthMap.get(month).push(issue)
    } else {
      postsByMonthMap.set(month, [issue])
    }
  })

  await generateHtmlFromTemplate(
    path.join(THEME_LAYOUT_PATH, 'archives', 'index.ejs'),
    path.join(OUTPUT_PATH, 'archives', 'index.html'),
    {
      postsByMonthMap,
    },
    '归档',
  )
}

async function generateCategories(dataIssues) {
  const { issues, milestones } = dataIssues
  const milestonesOfExistIssues = []

  for (const milestone of milestones) {
    const issuesOfMilestone = issues.filter(
      (issue) => issue.milestone?.id === milestone.id,
    )
    if (!issuesOfMilestone.length) continue

    milestonesOfExistIssues.push(milestone)
    const pageCount = Math.ceil(issuesOfMilestone.length / themeConfig.per_page)
    for (let i = 0; i < pageCount; i++) {
      await generateHtmlFromTemplate(
        path.join(THEME_LAYOUT_PATH, 'categories', 'page.ejs'),
        i === 0
          ? path.join(
              OUTPUT_PATH,
              'categories',
              `${milestone.id}`,
              'index.html',
            )
          : path.join(
              OUTPUT_PATH,
              'categories',
              `${milestone.id}`,
              'page',
              `${i + 1}`,
              'index.html',
            ),
        {
          posts: issuesOfMilestone.slice(
            themeConfig.per_page * i,
            themeConfig.per_page * (i + 1),
          ),
          category: milestone,
          pageCount,
          currentPage: i + 1,
        },
        `分类 - ${milestone.title}`,
      )
    }
  }

  await generateHtmlFromTemplate(
    path.join(THEME_LAYOUT_PATH, 'categories', 'index.ejs'),
    path.join(OUTPUT_PATH, 'categories', 'index.html'),
    {
      categories: milestonesOfExistIssues,
    },
    '分类',
  )
}

async function generateTags(dataIssues) {
  const { issues, labels } = dataIssues
  const labelsOfExistIssues = []

  for (const label of labels) {
    const issuesOfLabel = issues.filter((issue) =>
      issue.labels.map((label) => label.id).includes(label.id),
    )
    if (!issuesOfLabel.length) continue

    labelsOfExistIssues.push(label)
    const pageCount = Math.ceil(issuesOfLabel.length / themeConfig.per_page)
    for (let i = 0; i < pageCount; i++) {
      await generateHtmlFromTemplate(
        path.join(THEME_LAYOUT_PATH, 'tags', 'page.ejs'),
        i === 0
          ? path.join(OUTPUT_PATH, 'tags', `${label.id}`, 'index.html')
          : path.join(
              OUTPUT_PATH,
              'tags',
              `${label.id}`,
              'page',
              `${i + 1}`,
              'index.html',
            ),
        {
          posts: issuesOfLabel.slice(
            themeConfig.per_page * i,
            themeConfig.per_page * (i + 1),
          ),
          tag: label,
          pageCount,
          currentPage: i + 1,
        },
        `标签 - ${label.title}`,
      )
    }
  }

  await generateHtmlFromTemplate(
    path.join(THEME_LAYOUT_PATH, 'tags', 'index.ejs'),
    path.join(OUTPUT_PATH, 'tags', 'index.html'),
    {
      tags: labelsOfExistIssues,
    },
    '标签',
  )
}

async function generateAbout() {
  await generateHtmlFromTemplate(
    path.join(THEME_LAYOUT_PATH, 'about', 'index.ejs'),
    path.join(OUTPUT_PATH, 'about', 'index.html'),
    {},
    '关于',
  )
}

async function generate404() {
  await generateHtmlFromTemplate(
    path.join(THEME_LAYOUT_PATH, '404.ejs'),
    path.join(OUTPUT_PATH, '404.html'),
    {},
    '404 Not Fount',
  )
}
