export function getGroupedColumnRowSpans(
  rows: Array<{ id: string; getValue: (columnId: string) => unknown }>,
  columnId: string
) {
  const spans = new Map<string, number>()
  let index = 0

  while (index < rows.length) {
    const value = rows[index]?.getValue(columnId)
    let count = 1

    while (
      index + count < rows.length &&
      rows[index + count]?.getValue(columnId) === value
    ) {
      count += 1
    }

    const first = rows[index]
    spans.set(first.id, count)
    for (let offset = 1; offset < count; offset += 1) {
      const row = rows[index + offset]
      spans.set(row.id, 0)
    }

    index += count
  }

  return spans
}
