import type { ArchivedLog } from './archive';
import { designDiameter, rootEndDiameter, logVolumeM3 } from './taper';

/**
 * Serialise the archive to a single CSV blob, one row per log + header.
 *
 * Shape:
 *  - Fixed columns first: completedAt (ISO), root Ø cm, top Ø cm, length
 *    m, volume m³, strategy, cuts, produced count, end-view yield %.
 *  - Then one column per UNIQUE produced plank label across the whole
 *    archive (e.g. "50×150", "25×100"), containing the count of that
 *    size produced in that log. Missing sizes render as 0 (not blank)
 *    so a spreadsheet's SUM() across a size-column just works.
 *
 * Values are CSV-escaped with double quotes when they contain a comma,
 * double-quote, or newline. Numbers use `.` decimal separator (locale-
 * agnostic — matches how Excel / Google Sheets interpret CSV when the
 * host locale uses `,` as decimal, they still accept `.` when opening
 * `text/csv` via Import).
 */

export function archiveToCsv(archive: ArchivedLog[]): string {
  // Discover every plank-size label used across the archive. Sorted
  // lexicographically so the column order is stable between exports
  // (a user re-exporting next month shouldn't see columns shuffle).
  const sizeLabels = new Set<string>();
  for (const entry of archive) {
    for (const p of entry.plan.produced) {
      sizeLabels.add(p.label);
    }
  }
  const sizeColumns = [...sizeLabels].sort();

  const header = [
    'completedAt',
    'rootDiameterCm',
    'topDiameterCm',
    'lengthM',
    'volumeM3',
    'strategy',
    'cuts',
    'producedCount',
    'endViewYieldPct',
    ...sizeColumns
  ];

  const rows: string[][] = [header];
  for (const entry of archive) {
    const { plan } = entry;
    const root = rootEndDiameter(plan.log);
    const top = designDiameter(plan.log);
    const vol = logVolumeM3(plan.log);
    const totalPlankArea = plan.planks.reduce((a, p) => a + p.width * p.thickness, 0);
    const circleArea = Math.PI * Math.pow(top / 2, 2);
    const yieldPct = circleArea > 0 ? (totalPlankArea / circleArea) * 100 : 0;

    // Build a lookup once per log so a log with many produced planks
    // isn't O(n × m) in the main inner loop below.
    const produced: Record<string, number> = {};
    for (const p of plan.produced) {
      produced[p.label] = (produced[p.label] ?? 0) + 1;
    }

    const row = [
      new Date(entry.completedAt).toISOString(),
      (root / 10).toFixed(1),
      (top / 10).toFixed(1),
      (plan.log.length / 1000).toFixed(3),
      vol.toFixed(4),
      plan.settings.strategy,
      String(plan.cuts.length),
      String(plan.produced.length),
      yieldPct.toFixed(1),
      ...sizeColumns.map((label) => String(produced[label] ?? 0))
    ];
    rows.push(row);
  }

  return rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');
}

/** RFC-4180-ish CSV field escape. */
function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Trigger a browser download of the CSV text as `sawmill-logs-<date>.csv`.
 * No-op on the server (SSR) — caller should only invoke from a user
 * gesture inside the browser.
 */
export function downloadCsv(text: string, filename = defaultCsvFilename()): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' });
  // Leading BOM (\ufeff) nudges Excel to interpret the file as UTF-8
  // when double-clicked — otherwise it falls back to ANSI and mangles
  // Nordic characters in species names / custom labels.
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Release the object URL on the next tick so the click has a chance
  // to consume it first in some Safari builds.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function defaultCsvFilename(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `sawmill-logs-${yyyy}-${mm}-${dd}.csv`;
}
