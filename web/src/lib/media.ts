// Browser-side helpers for the mic and photo buttons.

export const MAX_RECORD_MS = 30_000
const MAX_AUDIO = 10 * 1024 * 1024
const MAX_IMAGE = 8 * 1024 * 1024
const MAX_SIDE = 2000
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export class MediaProblem extends Error {
  kind: 'badImage' | 'tooLarge'
  constructor(kind: 'badImage' | 'tooLarge') {
    super(kind)
    this.kind = kind
  }
}

export const canRecord = () => typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

/** webm for Chrome/Firefox, mp4 for iOS Safari; '' lets the browser choose. */
export function pickMime(): string {
  const supported = (m: string) => typeof MediaRecorder.isTypeSupported !== 'function' || MediaRecorder.isTypeSupported(m)
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(supported) ?? ''
}

export function checkAudio(blob: Blob) {
  if (blob.size > MAX_AUDIO) throw new MediaProblem('tooLarge')
}

/** Re-encodes HEIC and other formats, and anything over ~2000 px, to JPEG. Otherwise returns the file as is. */
export async function prepareImage(file: File): Promise<Blob> {
  const accepted = OK_TYPES.includes(file.type)
  let bmp: ImageBitmap
  try {
    bmp = await createImageBitmap(file)
  } catch {
    // Cannot decode: an accepted type still goes to the server as is; HEIC and friends cannot.
    if (accepted && file.size <= MAX_IMAGE) return file
    throw new MediaProblem(accepted ? 'tooLarge' : 'badImage')
  }
  try {
    const big = Math.max(bmp.width, bmp.height) > MAX_SIDE
    if (accepted && !big && file.size <= MAX_IMAGE) return file
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bmp.width * scale))
    canvas.height = Math.max(1, Math.round(bmp.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new MediaProblem('badImage')
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    const out = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.85))
    if (!out) throw new MediaProblem('badImage')
    if (out.size > MAX_IMAGE) throw new MediaProblem('tooLarge')
    return out
  } finally {
    bmp.close()
  }
}
