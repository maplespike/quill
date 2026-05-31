/**
 * Pretext text layout hook for computed heights and text reflow.
 * Uses @chenglou/pretext for production-quality text layout.
 */
import { useEffect, useRef, useState, useCallback } from 'react'

interface PretextOptions {
  font?: string
  maxWidth?: number
  lineHeight?: number
}

export function usePretext(options: PretextOptions = {}) {
  const ref = useRef<HTMLElement | null>(null)
  const [height, setHeight] = useState(0)

  const measure = useCallback(async () => {
    if (!ref.current) return
    await document.fonts.ready
    const { prepare, layout } = await import('@chenglou/pretext')
    const text = ref.current.textContent || ''
    const font = options.font || '16px Inter'
    const maxW = options.maxWidth || ref.current.offsetWidth || 300
    const lh = options.lineHeight || 24
    try {
      const handle = prepare(text, font)
      const result = layout(handle, maxW, lh)
      setHeight(result.height)
      ref.current.style.height = `${result.height}px`
    } catch {
      // fallback: let CSS handle it
    }
  }, [options.font, options.maxWidth, options.lineHeight])

  useEffect(() => { measure() }, [measure])
  useEffect(() => {
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  return { ref, height, measure }
}
