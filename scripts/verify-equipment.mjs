/**
 * Manual end-to-end check of the equipment parser against the real rules PDF.
 *
 * Unit tests cover the parser with synthetic fixtures; this script exercises it
 * against ds-rules.pdf so layout-specific regressions are caught. The cell-row
 * extraction below mirrors extractEquipmentRegions in
 * src/dungeonslayers/parsing/pdf-text.ts (which can't be imported here because it
 * uses Vite's `?worker` import). The parser is imported from source via jiti.
 *
 * Run with: npm run verify:equipment
 * Exits non-zero if any expectation fails.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createJiti } from 'jiti'

const PDF_PATH = fileURLToPath(new URL('../ds-rules.pdf', import.meta.url))
const PARSER_PATH = fileURLToPath(new URL('../src/dungeonslayers/parsing/parse-equipment.ts', import.meta.url))

const jiti = createJiti(import.meta.url)
const { parseEquipment } = await jiti.import(PARSER_PATH)

// --- Extraction (mirror of extractEquipmentRegions in pdf-text.ts) ---
const LINE_TOLERANCE = 4
const MARGIN_FRACTION = 0.05
const CELL_GAP = 9
const EQUIPMENT_PAGES = [88, 89, 90]
const FULL_WIDTH_PAGES = new Set([90])

function buildCellRows(items) {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const rows = []
  let rowItems = []
  const flush = () => {
    if (!rowItems.length) return
    rowItems.sort((a, b) => a.x - b.x)
    const cells = []
    let cell = []
    for (const item of rowItems) {
      const prev = cell[cell.length - 1]
      if (prev && item.x - (prev.x + prev.w) > CELL_GAP) {
        cells.push(cell.map((i) => i.text).join(' ').replace(/\s+/g, ' ').trim())
        cell = []
      }
      cell.push(item)
    }
    if (cell.length) cells.push(cell.map((i) => i.text).join(' ').replace(/\s+/g, ' ').trim())
    rows.push({ cells: cells.filter((c) => c) })
    rowItems = []
  }
  for (const item of sorted) {
    if (rowItems.length && Math.abs(item.y - rowItems[0].y) > LINE_TOLERANCE) flush()
    rowItems.push(item)
  }
  flush()
  return rows
}

async function extractEquipmentRegions(data) {
  const doc = await getDocument({ data }).promise
  const regions = []
  for (const pageNum of EQUIPMENT_PAGES) {
    if (pageNum > doc.numPages) continue
    const page = await doc.getPage(pageNum)
    const vp = page.getViewport({ scale: 1 })
    const midX = vp.width / 2
    const minY = vp.height * MARGIN_FRACTION
    const maxY = vp.height * (1 - MARGIN_FRACTION)
    const fullWidth = FULL_WIDTH_PAGES.has(pageNum)
    const left = [], right = [], full = []
    for (const it of (await page.getTextContent()).items) {
      if (typeof it.str !== 'string' || !it.str.trim()) continue
      if (it.transform[1] !== 0 || it.transform[2] !== 0) continue
      const x = it.transform[4], y = it.transform[5]
      if (y < minY || y > maxY) continue
      const item = { x, y, w: it.width, text: it.str }
      if (fullWidth) full.push(item)
      else (x + it.width / 2 < midX ? left : right).push(item)
    }
    if (fullWidth) regions.push(buildCellRows(full))
    else { regions.push(buildCellRows(left)); regions.push(buildCellRows(right)) }
    page.cleanup()
  }
  return regions
}

// --- Expectations ---
const eq = parseEquipment(await extractEquipmentRegions(new Uint8Array(readFileSync(PDF_PATH))))

const failures = []
const check = (label, condition) => {
  console.log(`${condition ? '✓' : '✗'} ${label}`)
  if (!condition) failures.push(label)
}
const find = (rows, name) => (rows ?? []).find((r) => r.name === name)

const EXPECTED_TABLES = {
  'Auf Reisen': 16, 'Beim Händler': 19, Beleuchtung: 8, Diverses: 6, Schlösser: 5,
  'Im Gasthaus': 5, Unterbringung: 3, 'Im Tempel': 7, 'Unterkunft errichten': 12,
  'Magische Dienste': 3, Reittiere: 7, Tiere: 10,
}
for (const [name, count] of Object.entries(EXPECTED_TABLES)) {
  check(`table "${name}" has ${count} entries`, (eq.tables[name]?.length ?? 0) === count)
}
check('28 weapons parsed', eq.weapons.length === 28)
check('12 armor pieces parsed', eq.armor.length === 12)
check('no unexpected generic tables', Object.keys(eq.tables).every((k) => k in EXPECTED_TABLES))

const angelhaken = find(eq.tables['Auf Reisen'], 'Angelhaken und Schnur')
check('Angelhaken: location D, price 2SM', angelhaken?.location === 'D' && angelhaken?.price === '2SM')

const zauberdienst = find(eq.tables['Magische Dienste'], 'Zauberdienst (z.B. Teleport)')
check('Zauberdienst: no location, raw price kept', zauberdienst?.location === null && zauberdienst?.price === 'Spruchkosten/2')

const heilkraut = find(eq.tables['Beim Händler'], 'Heilkraut')
check('Heilkraut: name cleaned of marker', !!heilkraut)
check('Heilkraut: wrapped addendum joined', !!heilkraut?.addendums[0]?.includes('Probenwert') && heilkraut.addendums[0].includes('kein Heileffekt'))

const allheilung = find(eq.tables['Im Tempel'], 'Allheilung (Zauberspruch)')
check('Allheilung: marker on price resolved', allheilung?.price === '100GM' && allheilung?.addendums[0]?.includes('Als Spende'))

const schlachtbeil = find(eq.weapons, 'Schlachtbeil (2h)')
check('Schlachtbeil: WB +4, location G, price 20GM', schlachtbeil?.weaponBonus === '+4' && schlachtbeil?.location === 'G' && schlachtbeil?.price === '20GM')

const lanze = find(eq.weapons, 'Lanze')
check('Lanze: weaponBonus "+1/+4" kept as string', lanze?.weaponBonus === '+1/+4')

const speer = find(eq.weapons, 'Speer')
check('Speer: 4-asterisk addendum resolved', speer?.addendums[0]?.includes('Schießen-Patzer'))

const waffenlos = find(eq.weapons, 'Waffenlos')
check('Waffenlos: location null, price "-"', waffenlos?.location === null && waffenlos?.price === '-')

const plattenpanzer = find(eq.armor, 'Plattenpanzer')
check('Plattenpanzer: armorBonus +3', plattenpanzer?.armorBonus === '+3' && plattenpanzer?.addendums[0]?.includes('Reittier'))

const totalGeneric = Object.values(eq.tables).reduce((n, t) => n + t.length, 0)
console.log(`\n${totalGeneric} generic entries + ${eq.weapons.length} weapons + ${eq.armor.length} armor. ${failures.length === 0 ? 'ALL CHECKS PASSED' : `${failures.length} CHECK(S) FAILED`}`)
process.exit(failures.length === 0 ? 0 : 1)
