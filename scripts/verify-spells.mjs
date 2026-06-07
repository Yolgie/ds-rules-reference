/**
 * Manual end-to-end check of the spell parser against the real rules PDF.
 *
 * Unit tests cover the parsers with synthetic fixtures; this script exercises them
 * against ds-rules.pdf so layout-specific regressions are caught. The text and icon
 * extraction below mirror src/dungeonslayers/parsing/pdf-text.ts (which can't be
 * imported here because it uses Vite's `?worker` import). The parsers themselves are
 * imported from source via jiti, so this verifies the real logic.
 *
 * Run with: npm run verify:spells
 * Exits non-zero if any expectation fails.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createJiti } from 'jiti'

const PDF_PATH = fileURLToPath(new URL('../ds-rules.pdf', import.meta.url))
const SPELLS_PATH = fileURLToPath(new URL('../src/dungeonslayers/parsing/parse-spells.ts', import.meta.url))
const TABLES_PATH = fileURLToPath(new URL('../src/dungeonslayers/parsing/parse-spell-tables.ts', import.meta.url))

const jiti = createJiti(import.meta.url)
const { parseSpells } = await jiti.import(SPELLS_PATH)
const { parseSpellTables } = await jiti.import(TABLES_PATH)

// --- Text extraction (mirror of extractLines in pdf-text.ts) ---
const LINE_TOLERANCE = 4
const MARGIN_FRACTION = 0.05

function groupColumn(items, page, column) {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const lines = []
  let current = []
  const flush = () => {
    if (!current.length) return
    const text = current.map((i) => i.text).join(' ').replace(/\s+/g, ' ').trim()
    if (text) lines.push({ page, column, y: current[0].y, text })
    current = []
  }
  for (const item of sorted) {
    if (current.length && Math.abs(item.y - current[0].y) > LINE_TOLERANCE) flush()
    current.push(item)
  }
  flush()
  return lines
}

async function extractLines(doc) {
  const lines = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const vp = page.getViewport({ scale: 1 })
    const midX = vp.width / 2
    const minY = vp.height * MARGIN_FRACTION
    const maxY = vp.height * (1 - MARGIN_FRACTION)
    const content = await page.getTextContent()
    const left = [], right = []
    for (const it of content.items) {
      if (typeof it.str !== 'string' || !Array.isArray(it.transform)) continue
      if (it.transform[1] !== 0 || it.transform[2] !== 0) continue
      if (!it.str.trim()) continue
      const x = it.transform[4], y = it.transform[5]
      if (y < minY || y > maxY) continue
      ;(x + it.width / 2 < midX ? left : right).push({ x, y, text: it.str })
    }
    lines.push(...groupColumn(left, p, 0), ...groupColumn(right, p, 1))
    page.cleanup()
  }
  return lines
}

// --- Icon extraction (mirror of extractSpellIcons in pdf-text.ts) ---
const SPELL_PAGES = Array.from({ length: 87 - 60 + 1 }, (_, i) => 60 + i)
const ICON_MIN_SCALE = 5
const ICON_MAX_SCALE = 40

function matMul(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
  ]
}

function fnv1a(bytes) {
  let h = 0x811c9dc5
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i]
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16)
}

function resolveImage(page, name) {
  const store = name.startsWith('g_') ? page.commonObjs : page.objs
  return new Promise((resolve) => {
    let settled = false
    const finish = (o) => { if (!settled) { settled = true; resolve(o) } }
    try { store.get(name, finish) } catch { finish(null) }
  })
}

function hashImageObject(o) {
  if (o?.data && o.data.length) return `${o.width}x${o.height}:${fnv1a(o.data)}`
  return `dim:${o?.width ?? 0}x${o?.height ?? 0}`
}

async function extractSpellIcons(doc) {
  const icons = []
  for (const pageNum of SPELL_PAGES) {
    if (pageNum > doc.numPages) continue
    const page = await doc.getPage(pageNum)
    const opList = await page.getOperatorList()
    let ctm = [1, 0, 0, 1, 0, 0]
    const stack = []
    const draws = []
    for (let i = 0; i < opList.fnArray.length; i++) {
      const fn = opList.fnArray[i]
      const args = opList.argsArray[i]
      if (fn === OPS.save) stack.push(ctm.slice())
      else if (fn === OPS.restore) ctm = stack.pop() ?? ctm
      else if (fn === OPS.transform) ctm = matMul(ctm, args)
      else if (fn === OPS.paintImageXObject) {
        const scale = Math.abs(ctm[0])
        if (scale >= ICON_MIN_SCALE && scale <= ICON_MAX_SCALE) {
          draws.push({ name: args[0], x: ctm[4], y: ctm[5] })
        }
      }
    }
    const hashByName = new Map()
    for (const draw of draws) {
      let hash = hashByName.get(draw.name)
      if (hash === undefined) {
        hash = hashImageObject(await resolveImage(page, draw.name))
        hashByName.set(draw.name, hash)
      }
      icons.push({ page: pageNum, x: draw.x, y: draw.y, hash })
    }
    page.cleanup()
  }
  return icons
}

// --- Run parsers ---
const doc = await getDocument({ data: new Uint8Array(readFileSync(PDF_PATH)) }).promise
const lines = await extractLines(doc)
const icons = await extractSpellIcons(doc)
const classMap = parseSpellTables(lines)
const spells = parseSpells(lines, icons, classMap)
const byName = (n) => spells.find((s) => s.name === n)
const reqStr = (s) => (s?.classRequirements ?? []).map((r) => `${r.dsClass}@${r.level}`).sort().join(',')

const failures = []
const check = (label, condition) => {
  console.log(`${condition ? '✓' : '✗'} ${label}`)
  if (!condition) failures.push(label)
}

const names = spells.map((s) => s.name)
check(`parsed a healthy number of spells (got ${spells.length})`, spells.length >= 125)
check('no duplicate spell names', new Set(names).size === names.length)
check('all spells have a non-empty effect', spells.every((s) => s.effect.length > 0))
check(`spell tables mapped a healthy number of names (got ${classMap.size})`, classMap.size >= 130)

const all = byName('ALLHEILUNG')
check('ALLHEILUNG exists', !!all)
check('ALLHEILUNG price 650GM', all?.price === '650GM')
check('ALLHEILUNG ZB +0', all?.spellBonus === '+0')
check('ALLHEILUNG learnable by Hei@10', reqStr(all) === 'Hei@10')
check('ALLHEILUNG is ZAUBER', all?.spellType === 'ZAUBER')
check('ALLHEILUNG effect parsed', !!all?.effect.includes('heilt sämtliche'))

const bal = byName('BALANCIEREN')
check('BALANCIEREN price 45GM, ZB -2', bal?.price === '45GM' && bal?.spellBonus === '-2')
check('BALANCIEREN distance Berühren', bal?.distance === 'Berühren')
check('BALANCIEREN learnable by Hei@2, Zau@3, Sch@6', reqStr(bal) === 'Hei@2,Sch@6,Zau@3')

const ark = byName('ARKANES SCHWERT')
check('ARKANES SCHWERT learnable by Zau@10, Sch@8', reqStr(ark) === 'Sch@8,Zau@10')

const blenden = byName('BLENDEN')
check('BLENDEN is ZIELZAUBER', blenden?.spellType === 'ZIELZAUBER')
const blitz = byName('BLITZ')
check('BLITZ is ZIELZAUBER', blitz?.spellType === 'ZIELZAUBER')
const bannen = byName('BANNEN')
check('BANNEN is ZAUBER (despite a target-resistance ZB)', bannen?.spellType === 'ZAUBER')

const typed = spells.filter((s) => s.spellType !== null).length
check(`most spells have a detected type (${typed}/${spells.length})`, typed >= spells.length * 0.8)

console.log(`\n${spells.length} spells parsed (${typed} typed). ${failures.length === 0 ? 'ALL CHECKS PASSED' : `${failures.length} CHECK(S) FAILED`}`)
process.exit(failures.length === 0 ? 0 : 1)
