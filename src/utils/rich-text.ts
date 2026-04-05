export function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, '').trim()
}

export function normalizeRichTextHtml(value: string) {
  return value
    .replace(/<div><br><\/div>/gi, '')
    .replace(/<div>/gi, '<br>')
    .replace(/<\/div>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .trim()
}
