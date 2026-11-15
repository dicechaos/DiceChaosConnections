/**
 * Compresses and resizes an uploaded image into a compact, self-contained data URI
 * so campaign .json files remain small, fast, and 100% offline-shareable.
 */
export async function compressImageFile(
  file: File,
  maxDimension = 320,
  quality = 0.82
): Promise<string> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read image file'))
    reader.readAsDataURL(file)
  })

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Invalid image format'))
    image.src = rawDataUrl
  })

  let targetWidth = img.naturalWidth || img.width
  let targetHeight = img.naturalHeight || img.height

  if (targetWidth > maxDimension || targetHeight > maxDimension) {
    if (targetWidth >= targetHeight) {
      targetHeight = Math.max(1, Math.round((targetHeight * maxDimension) / targetWidth))
      targetWidth = maxDimension
    } else {
      targetWidth = Math.max(1, Math.round((targetWidth * maxDimension) / targetHeight))
      targetHeight = maxDimension
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) return rawDataUrl

  ctx.clearRect(0, 0, targetWidth, targetHeight)
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight)

  const webp = canvas.toDataURL('image/webp', quality)
  if (webp.startsWith('data:image/webp')) {
    return webp
  }
  return canvas.toDataURL('image/png')
}
