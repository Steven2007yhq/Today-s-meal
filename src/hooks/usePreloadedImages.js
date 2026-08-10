import { useEffect, useRef, useState } from 'react'

export function usePreloadedImages(urls = []) {
  const [readyMap, setReadyMap] = useState({})
  const cacheRef = useRef(new Map())

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const uniqueUrls = [...new Set(urls.filter(Boolean))]
    const pendingUrls = uniqueUrls.filter((url) => !cacheRef.current.has(url))
    if (!pendingUrls.length) return undefined

    let active = true
    for (const url of pendingUrls) {
      const image = new window.Image()
      image.onload = () => {
        cacheRef.current.set(url, true)
        if (active) setReadyMap((current) => ({ ...current, [url]: true }))
      }
      image.onerror = () => {
        cacheRef.current.set(url, false)
        if (active) setReadyMap((current) => ({ ...current, [url]: true }))
      }
      image.src = url
    }

    return () => {
      active = false
    }
  }, [urls.join('|')])

  return readyMap
}

