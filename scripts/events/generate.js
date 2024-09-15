import {
  loadDataFromFile,
  OUTPUT_PATH,
  readFluxPressThemeConfig,
  readThemePath,
} from '@fluxpress/core'
import path from 'node:path'
import ejs from 'ejs'
import fs from 'fs-extra'
import markdownIt from 'markdown-it'
import markdownItFootnote from 'markdown-it-footnote'
import markdownItHighlightJs from 'markdown-it-highlightjs'
import markdownItTaskLists from 'markdown-it-task-lists'
import markdownItCollapsible from 'markdown-it-collapsible'
import markdownItFrontMatter from 'markdown-it-front-matter'
import markdownItAnchor from 'markdown-it-anchor'
import markdownItTableOfContents from 'markdown-it-table-of-contents'

const md = markdownIt()
  .use(markdownItFootnote)
  .use(markdownItHighlightJs, { inline: true })
  .use(markdownItTaskLists)
  .use(markdownItCollapsible)
  .use(markdownItFrontMatter, (fm) => {
    // console.log(fm)
  })
  .use(markdownItAnchor)
  .use(markdownItTableOfContents)

const THEME_PATH = await readThemePath()
const THEME_LAYOUT_PATH = path.join(THEME_PATH, 'layout')
const THEME_SOURCE_PATH = path.join(THEME_PATH, 'source')

export default function (fluxpress) {
  fluxpress.on('generate', async () => {
    const data_issues = await loadDataFromFile('issues')
    await generatePosts(data_issues)
    await generatePage(data_issues)
    await generateArchives(data_issues)
    await generateCategories(data_issues)
    await generateTags(data_issues)

    await generateAbout()
    await generate404()

    await fs.copy(THEME_SOURCE_PATH, OUTPUT_PATH)
  })
}

/**
 * @type import('../../index.d.ts').ThemeConfig
 */
const themeConfig = await readFluxPressThemeConfig()

async function generateHtmlFromTemplate(
  templatePath,
  outputPath,
  data,
  headTitle,
) {
  const bodyContent = await ejs.renderFile(templatePath, data)
  const html = await ejs.renderFile(
    path.join(THEME_LAYOUT_PATH, 'html-container.ejs'),
    {
      site: { ...themeConfig.site },
      headTitle,
      bodyContent,
    },
    {
      escape: null,
    },
  )
  await fs.outputFile(outputPath, html)
}

async function generatePosts(data_issues) {
  const { issues } = data_issues

  for (const issue of issues) {
    await generateHtmlFromTemplate(
      path.join(THEME_LAYOUT_PATH, 'posts', 'index.ejs'),
      path.join(OUTPUT_PATH, 'posts', `${issue.id}`, 'index.html'),
      {
        siteTitle: themeConfig.site.title,
        title: issue.title,
        content: md.render(issue.body ?? ''),
        comments: issue.comments_list.map((comment) => ({
          avatar: comment.user.avatar_url,
          username: comment.user.login,
          content: md.render(comment.body ?? ''),
        })),
        category: issue.milestone,
        tags: issue.labels,
        createdAt: issue.created_at,
      },
      issue.title,
    )
  }
}

async function generatePage(data_issues) {
  const { issues } = data_issues

  const pageCount = Math.ceil(issues.length / themeConfig.per_page)
  for (let i = 0; i < pageCount; i++) {
    await generateHtmlFromTemplate(
      path.join(THEME_LAYOUT_PATH, 'page', 'index.ejs'),
      i === 0
        ? path.join(OUTPUT_PATH, 'index.html')
        : path.join(OUTPUT_PATH, 'page', `${i + 1}`, 'index.html'),
      {
        siteTitle: themeConfig.site.title,
        posts: issues.slice(
          themeConfig.per_page * i,
          themeConfig.per_page * (i + 1),
        ),
        pagination: {
          pageCount,
          currentPage: i + 1,
          urlPath: '/',
        },
      },
      `首页${i === 0 ? '' : ' - ' + (i + 1)}`,
    )
  }
}

async function generateArchives(data_issues) {
  const { issues } = data_issues

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
      siteTitle: themeConfig.site.title,
      postsByMonthMap,
    },
    '归档',
  )
}

async function generateCategories(data_issues) {
  const { issues, milestones } = data_issues
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
          siteTitle: themeConfig.site.title,
          posts: issuesOfMilestone.slice(
            themeConfig.per_page * i,
            themeConfig.per_page * (i + 1),
          ),
          category: milestone,
          pagination: {
            pageCount,
            currentPage: i + 1,
            urlPath: `/categories/${milestone.id}/`,
          },
        },
        `分类 - ${milestone.title}`,
      )
    }
  }

  await generateHtmlFromTemplate(
    path.join(THEME_LAYOUT_PATH, 'categories', 'index.ejs'),
    path.join(OUTPUT_PATH, 'categories', 'index.html'),
    {
      siteTitle: themeConfig.site.title,
      categories: milestonesOfExistIssues,
    },
    '分类',
  )
}

async function generateTags(data_issues) {
  const { issues, labels } = data_issues
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
          siteTitle: themeConfig.site.title,
          posts: issuesOfLabel.slice(
            themeConfig.per_page * i,
            themeConfig.per_page * (i + 1),
          ),
          tag: label,
          pagination: {
            pageCount,
            currentPage: i + 1,
            urlPath: `/tags/${label.id}/`,
          },
        },
        `标签 - ${label.title}`,
      )
    }
  }

  await generateHtmlFromTemplate(
    path.join(THEME_LAYOUT_PATH, 'tags', 'index.ejs'),
    path.join(OUTPUT_PATH, 'tags', 'index.html'),
    {
      siteTitle: themeConfig.site.title,
      tags: labelsOfExistIssues,
    },
    '标签',
  )
}

async function generateAbout() {
  await generateHtmlFromTemplate(
    path.join(THEME_LAYOUT_PATH, 'about', 'index.ejs'),
    path.join(OUTPUT_PATH, 'about', 'index.html'),
    {
      siteTitle: themeConfig.site.title,
      siteAuthor: themeConfig.site.author,
    },
    '关于',
  )
}

async function generate404() {
  await generateHtmlFromTemplate(
    path.join(THEME_LAYOUT_PATH, '404.ejs'),
    path.join(OUTPUT_PATH, '404.html'),
    {
      siteTitle: themeConfig.site.title,
    },
    '404 Not Fount',
  )
}
