import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const INSIGHTS = path.join(ROOT, 'insights')
const TODAY = '2026-08-22'
const UPDATED = `${TODAY}T00:00:00+05:30`

const SOURCES = {
  nabh: ['https://nabh.co/explore-nabh-standards/', 'NABH — hospital accreditation standards and current editions'],
  qci: ['https://pmjay.qcin.org/guide-book', 'Quality Council of India and NHA — hospital quality-certification guidebook'],
  abdm: ['https://abdm.gov.in/abdm', 'National Health Authority — ABDM vision, standards and interoperability objectives'],
  abdmFaq: ['https://abdm.gov.in/FAQ', 'National Health Authority — ABDM implementation FAQs for hospitals and HMIS/HIS'],
  irdai: ['https://irdai.gov.in/web/guest/circulars?filterDepartment=HLT&filtersApplied=true', 'IRDAI — current health-insurance circulars and master circular'],
  meity: ['https://www.meity.gov.in/content/digital-personal-data-protection-act-2023-dpdp-act', 'MeitY — Digital Personal Data Protection Act, 2023'],
  gst: ['https://tutorial.gst.gov.in/downloads/news/pamphlet_e_invoicing_glossary_updated_17_08_2023_approved_final.pdf', 'GSTN — official e-invoicing glossary and process reference'],
}

const PAGE_SOURCES = {
  'compliant-by-design.html': ['nabh', 'abdm', 'meity', 'gst'],
  'credit-note-reconciliation-where-hospital-finance-quietly-leaks.html': ['gst', 'irdai'],
  'hms-timelines-why-they-stretch-into-years-and-how-to-shorten-them.html': ['abdmFaq', 'nabh'],
  'how-to-govern-ai-agents-in-a-hospital-like-new-hires.html': ['abdm', 'meity'],
  'migration-without-the-horror.html': ['abdm', 'meity'],
  'nabh-software-requirements-a-plain-language-explainer-for-medical-dire.html': ['nabh', 'qci'],
  'stop-buying-hms.html': ['abdmFaq', 'nabh'],
  'stop-the-leakage.html': ['irdai', 'gst'],
  'the-real-cost-components-of-hospital-software-in-india.html': ['gst', 'abdmFaq', 'nabh'],
  'three-questions.html': ['abdm', 'meity'],
  'tpa-claim-rejection-reasons.html': ['irdai', 'abdmFaq'],
  'weeks-not-years.html': ['nabh', 'abdmFaq'],
  'what-is-a-hospital-operating-system-the-short-version.html': ['abdm', 'abdmFaq', 'nabh'],
  'what-nabh-actually-requires-from-your-software-clause-by-clause.html': ['nabh', 'qci'],
}

const CATEGORY = {
  'credit-note-reconciliation-where-hospital-finance-quietly-leaks.html': 'Revenue & leakage',
  'how-to-govern-ai-agents-in-a-hospital-like-new-hires.html': 'AI governance',
  'nabh-software-requirements-a-plain-language-explainer-for-medical-dire.html': 'Accreditation',
}

const escapeHtml = (value) => value.replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[c])
const escapeXml = (value) => value.replace(/[<>&'"]/g, (c) => ({
  '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
})[c])
const match = (html, re) => re.exec(html)?.[1]?.trim() ?? ''

function sourceSection(keys) {
  const rows = keys.map((key) => {
    const [url, label] = SOURCES[key]
    return `          <li><a href="${escapeHtml(url)}" rel="noopener">${escapeHtml(label)}</a></li>`
  }).join('\n')
  return `\n        <!-- primary-sources -->\n        <section class="primary-sources" aria-labelledby="primary-sources-heading">\n          <h2 id="primary-sources-heading">Primary sources</h2>\n          <p>This resource is grounded in the following official standards, laws and regulator guidance. Links were checked on 22 August 2026.</p>\n          <ul>\n${rows}\n          </ul>\n        </section>\n`
}

function addSources(html, keys) {
  html = html
    .replaceAll('https://qcin.org/accreditations/', SOURCES.qci[0])
    .replaceAll('Quality Council of India — NABH accreditation schemes', SOURCES.qci[1])
    .replaceAll('https://www.meity.gov.in/writereaddata/files/Digital%20Personal%20Data%20Protection%20Act%202023.pdf', SOURCES.meity[0])
  if (html.includes('<!-- primary-sources -->')) return html
  const section = sourceSection(keys)
  if (html.includes('    <aside class="cta-block">')) {
    return html.replace('    <aside class="cta-block">', `${section}\n    <aside class="cta-block">`)
  }
  return html.replace(/\s*<\/article>/, `${section}      </article>`)
}

const files = (await readdir(INSIGHTS)).filter((file) => file.endsWith('.html')).sort()
if (files.length !== Object.keys(PAGE_SOURCES).length) {
  throw new Error(`source map covers ${Object.keys(PAGE_SOURCES).length} pages, but ${files.length} exist`)
}

const pages = []
for (const file of files) {
  const full = path.join(INSIGHTS, file)
  let html = await readFile(full, 'utf8')
  const keys = PAGE_SOURCES[file]
  if (!keys) throw new Error(`no primary-source mapping for ${file}`)
  html = addSources(html, keys)
  await writeFile(full, html)
  pages.push({
    file,
    title: match(html, /<title>([\s\S]*?)<\/title>/i).replace(/\s*[|—]\s*Ospia\s*$/i, ''),
    description: match(html, /<meta\s+name="description"\s+content="([^"]*)"/i),
  })
}

// Rebuild the Atom feed from every published insight, not a hand-maintained subset.
const entries = pages.map((page) => {
  const url = `https://ospia.in/insights/${page.file}`
  return `  <entry>\n    <title>${escapeXml(page.title)}</title>\n    <link href="${url}"/>\n    <id>${url}</id>\n    <updated>${UPDATED}</updated>\n    <summary>${escapeXml(page.description)}</summary>\n  </entry>`
}).join('\n')
await writeFile(path.join(INSIGHTS, 'feed.xml'), `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Ospia Insights</title>
  <subtitle>On running hospitals, and the software that gets in the way.</subtitle>
  <link href="https://ospia.in/insights/feed.xml" rel="self"/>
  <link href="https://ospia.in/insights.html"/>
  <id>https://ospia.in/insights.html</id>
  <updated>${UPDATED}</updated>
  <author><name>Ospia</name></author>
${entries}
</feed>
`)

// Replace only the Insights section in llms.txt; preserve the curated entity context.
const llmsPath = path.join(ROOT, 'llms.txt')
const llms = await readFile(llmsPath, 'utf8')
const llmRows = pages.map((page) =>
  `- [${page.title}](https://ospia.in/insights/${page.file}): ${page.description}`,
).join('\n')
await writeFile(llmsPath, `${llms.split('## Insights')[0].trimEnd()}\n\n## Insights\n\n${llmRows}\n`)

// Replace all insight URL entries so the sitemap cannot retain stale omissions.
const sitemapPath = path.join(ROOT, 'sitemap.xml')
let sitemap = await readFile(sitemapPath, 'utf8')
sitemap = sitemap.replace(/\s*<url>\s*<loc>https:\/\/ospia\.in\/insights\/[^<]+<\/loc>[\s\S]*?<\/url>/g, '')
const sitemapRows = pages.map((page) => `  <url>
    <loc>https://ospia.in/insights/${page.file}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`).join('\n')
sitemap = sitemap.replace('\n</urlset>', `\n${sitemapRows}\n</urlset>`)
await writeFile(sitemapPath, sitemap)

// Add cards for every missing published page to the visible internal-link hub.
const indexPath = path.join(ROOT, 'insights.html')
let index = await readFile(indexPath, 'utf8')
const marker = '      <div class="doc-grid">'
for (const page of [...pages].reverse()) {
  const href = `/insights/${page.file}`
  if (index.includes(`href="${href}"`)) continue
  const card = `\n        <div class="doc">\n          <span class="k">${escapeHtml(CATEGORY[page.file] ?? 'Insight')}</span>\n          <h3>${escapeHtml(page.title)}</h3>\n          <p>${escapeHtml(page.description)}</p>\n          <a href="${href}">Read the article &rarr;</a>\n        </div>`
  index = index.replace(marker, `${marker}${card}`)
}
await writeFile(indexPath, index)

console.log(`Backfilled ${pages.length} published insights and rebuilt sitemap, feed, llms.txt and insights.html.`)
