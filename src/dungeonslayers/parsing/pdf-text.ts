import * as pdfjs from 'pdfjs-dist'
import { OPS } from 'pdfjs-dist'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
// Vite bundles the worker; `?worker` gives us a Worker constructor.
import PdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?worker'

pdfjs.GlobalWorkerOptions.workerPort = new PdfWorker()

/**
 * A single line of text recovered from the PDF, tagged with the page it came
 * from and which body column it belongs to. The section parsers consume these
 * in reading order (left column fully, then right column, per page).
 */
export interface TextLine {
  page: number
  column: 0 | 1
  /** PDF user-space y of the line (origin bottom-left, larger = higher). */
  y: number
  text: string
}

/** Items whose y differ by less than this belong to the same visual line. */
const LINE_TOLERANCE = 4
/** Fraction of page height trimmed top and bottom to drop headers/footers/folios. */
const MARGIN_FRACTION = 0.05

function isTextItem(item: unknown): item is TextItem {
  return typeof (item as TextItem).str === 'string' && Array.isArray((item as TextItem).transform)
}

/** A rotated item (non-zero skew) is a side-tab running header, not body text. */
function isRotated(item: TextItem): boolean {
  return item.transform[1] !== 0 || item.transform[2] !== 0
}

interface PositionedItem {
  x: number
  y: number
  text: string
}

function groupColumn(items: PositionedItem[], page: number, column: 0 | 1): TextLine[] {
  // Sort top-to-bottom (descending y), then left-to-right within a line.
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const lines: TextLine[] = []
  let current: PositionedItem[] = []

  const flush = () => {
    if (current.length === 0) return
    const text = current
      .map((i) => i.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (text) lines.push({ page, column, y: current[0]!.y, text })
    current = []
  }

  for (const item of sorted) {
    if (current.length > 0 && Math.abs(item.y - current[0]!.y) > LINE_TOLERANCE) flush()
    current.push(item)
  }
  flush()
  return lines
}

/**
 * Extracts the document as column-corrected lines in reading order.
 *
 * The rules PDF is two-column; raw extraction interleaves the columns, so we
 * split each page's text items by x and emit the left column fully before the
 * right. `onProgress` is called with a 0..1 fraction after each page.
 */
export async function extractLines(
  data: ArrayBuffer,
): Promise<TextLine[]> {
  const loadingTask = pdfjs.getDocument({ data })
  const doc = await loadingTask.promise
  const lines: TextLine[] = []

  try {
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum)
      const viewport = page.getViewport({ scale: 1 })
      const midX = viewport.width / 2
      const minY = viewport.height * MARGIN_FRACTION
      const maxY = viewport.height * (1 - MARGIN_FRACTION)

      const content = await page.getTextContent()
      const left: PositionedItem[] = []
      const right: PositionedItem[] = []

      for (const raw of content.items) {
        if (!isTextItem(raw) || isRotated(raw) || !raw.str.trim()) continue
        const x = raw.transform[4]
        const y = raw.transform[5]
        if (y < minY || y > maxY) continue // header / footer / page folio
        const centerX = x + raw.width / 2
        ;(centerX < midX ? left : right).push({ x, y, text: raw.str })
      }

      lines.push(...groupColumn(left, pageNum, 0))
      lines.push(...groupColumn(right, pageNum, 1))

      page.cleanup()
    }
  } finally {
    await loadingTask.destroy()
  }

  return lines
}

/** One row of a PDF table, split into cells (left → right). */
export interface CellRow {
  cells: string[]
}

/** Equipment lives on these PDF pages; page 90 (Waffen/Rüstungen) spans the full width. */
const EQUIPMENT_PAGES = [88, 89, 90]
const FULL_WIDTH_PAGES = new Set([90])
/** A horizontal gap wider than this between item boxes starts a new table cell. */
const CELL_GAP = 9

interface SizedItem extends PositionedItem {
  w: number
}

/** Groups items into visual rows by y, then splits each row into cells by x-gaps. */
function buildCellRows(items: SizedItem[]): CellRow[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const rows: CellRow[] = []
  let rowItems: SizedItem[] = []

  const flush = () => {
    if (rowItems.length === 0) return
    rowItems.sort((a, b) => a.x - b.x)
    const cells: string[] = []
    let cell: SizedItem[] = []
    for (const item of rowItems) {
      const prev = cell[cell.length - 1]
      if (prev && item.x - (prev.x + prev.w) > CELL_GAP) {
        cells.push(cell.map((i) => i.text).join(' ').replace(/\s+/g, ' ').trim())
        cell = []
      }
      cell.push(item)
    }
    if (cell.length > 0) cells.push(cell.map((i) => i.text).join(' ').replace(/\s+/g, ' ').trim())
    rows.push({ cells: cells.filter((c) => c) })
    rowItems = []
  }

  for (const item of sorted) {
    if (rowItems.length > 0 && Math.abs(item.y - rowItems[0]!.y) > LINE_TOLERANCE) flush()
    rowItems.push(item)
  }
  flush()
  return rows
}

/**
 * Extracts the equipment pages as table regions of cell-rows. Pages 88/89 hold
 * paired narrow tables, so each is split at mid-x into a left and a right region;
 * page 90 (Waffen/Rüstungen) is full-width and emitted as a single region. The
 * parser processes each region independently (resetting its current table), which
 * keeps trailing notes/rows from bleeding across columns or pages.
 */
export async function extractEquipmentRegions(data: ArrayBuffer): Promise<CellRow[][]> {
  const loadingTask = pdfjs.getDocument({ data })
  const doc = await loadingTask.promise
  const regions: CellRow[][] = []

  try {
    for (const pageNum of EQUIPMENT_PAGES) {
      if (pageNum > doc.numPages) continue
      const page = await doc.getPage(pageNum)
      const viewport = page.getViewport({ scale: 1 })
      const midX = viewport.width / 2
      const minY = viewport.height * MARGIN_FRACTION
      const maxY = viewport.height * (1 - MARGIN_FRACTION)

      const content = await page.getTextContent()
      const left: SizedItem[] = []
      const right: SizedItem[] = []
      const full: SizedItem[] = []
      const fullWidth = FULL_WIDTH_PAGES.has(pageNum)

      for (const raw of content.items) {
        if (!isTextItem(raw) || isRotated(raw) || !raw.str.trim()) continue
        const x = raw.transform[4]
        const y = raw.transform[5]
        if (y < minY || y > maxY) continue
        const item: SizedItem = { x, y, w: raw.width, text: raw.str }
        if (fullWidth) full.push(item)
        else (x + raw.width / 2 < midX ? left : right).push(item)
      }

      if (fullWidth) {
        regions.push(buildCellRows(full))
      } else {
        regions.push(buildCellRows(left))
        regions.push(buildCellRows(right))
      }

      page.cleanup()
    }
  } finally {
    await loadingTask.destroy()
  }

  return regions
}

/** A spell-type icon recovered from a spell page, located and identified by pixel hash. */
export interface SpellIcon {
  page: number
  /** PDF user-space coordinates of the icon's placement (bottom-left). */
  x: number
  y: number
  /** Stable hash of the icon's decoded pixels; equal hashes are the same visual icon. */
  hash: string
}

/** Spell detail entries live on these PDF pages. */
const SPELL_PAGES: number[] = Array.from({ length: 87 - 60 + 1 }, (_, i) => 60 + i)
/** The spell-type icons render at ~16 user-space units; ignore larger background art. */
const ICON_MIN_SCALE = 5
const ICON_MAX_SCALE = 40

/** 6-element PDF transform matrix multiply (m ∘ n). */
function matMul(m: number[], n: number[]): number[] {
  return [
    m[0]! * n[0]! + m[2]! * n[1]!,
    m[1]! * n[0]! + m[3]! * n[1]!,
    m[0]! * n[2]! + m[2]! * n[3]!,
    m[1]! * n[2]! + m[3]! * n[3]!,
    m[0]! * n[4]! + m[2]! * n[5]! + m[4]!,
    m[1]! * n[4]! + m[3]! * n[5]! + m[5]!,
  ]
}

/** FNV-1a hash over a byte buffer; used to fingerprint icon pixels. */
function fnv1a(bytes: ArrayLike<number>): string {
  let h = 0x811c9dc5
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i]!
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16)
}

/** Resolves a (possibly async) image XObject by id, picking the right object store. */
function resolveImage(page: pdfjs.PDFPageProxy, name: string): Promise<unknown> {
  const store = name.startsWith('g_') ? page.commonObjs : page.objs
  return new Promise((resolve) => {
    let settled = false
    const finish = (obj: unknown) => {
      if (!settled) {
        settled = true
        resolve(obj)
      }
    }
    try {
      ;(store as { get(id: string, cb: (o: unknown) => void): void }).get(name, finish)
    } catch {
      finish(null)
    }
  })
}

/** Fingerprints an image object's pixels; falls back to its dimensions if data is absent. */
function hashImageObject(obj: unknown): string {
  const o = obj as { data?: ArrayLike<number>; width?: number; height?: number } | null
  if (o?.data && o.data.length) return `${o.width}x${o.height}:${fnv1a(o.data)}`
  return `dim:${o?.width ?? 0}x${o?.height ?? 0}`
}

/**
 * Extracts the spell-type icons from the spell pages (60–87). The same visual icon
 * is stored under several XObject names, so each drawn icon is identified by hashing
 * its decoded pixels (offscreen-canvas decoding is disabled so raw `data` is available).
 * The CTM is tracked through the operator list to recover each icon's position; the
 * spell parser maps a hash to ZAUBER/ZIELZAUBER and matches icons to spell headings.
 */
export async function extractSpellIcons(data: ArrayBuffer): Promise<SpellIcon[]> {
  const loadingTask = pdfjs.getDocument({ data, isOffscreenCanvasSupported: false })
  const doc = await loadingTask.promise
  const icons: SpellIcon[] = []

  try {
    for (const pageNum of SPELL_PAGES) {
      if (pageNum > doc.numPages) continue
      const page = await doc.getPage(pageNum)
      const opList = await page.getOperatorList()

      let ctm = [1, 0, 0, 1, 0, 0]
      const stack: number[][] = []
      const draws: { name: string; x: number; y: number }[] = []

      for (let i = 0; i < opList.fnArray.length; i++) {
        const fn = opList.fnArray[i]
        const args = opList.argsArray[i] as unknown[]
        if (fn === OPS.save) stack.push(ctm.slice())
        else if (fn === OPS.restore) ctm = stack.pop() ?? ctm
        else if (fn === OPS.transform) ctm = matMul(ctm, args as number[])
        else if (fn === OPS.paintImageXObject) {
          const scale = Math.abs(ctm[0]!)
          if (scale >= ICON_MIN_SCALE && scale <= ICON_MAX_SCALE) {
            draws.push({ name: args[0] as string, x: ctm[4]!, y: ctm[5]! })
          }
        }
      }

      // Resolve and hash each drawn icon (cache by name; the same id repeats per page).
      const hashByName = new Map<string, string>()
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
  } finally {
    await loadingTask.destroy()
  }

  return icons
}
