import { useRef, useEffect } from 'react'
import { setNextId } from '../utils'

export function useLiveMode(liveMode, setBlocks) {
  const etagRef = useRef(null)
  useEffect(() => {
    if (!liveMode) { etagRef.current = null; return }
    let initialized = false
    const poll = async () => {
      try {
        const res = await fetch('/layouts/live.json', { cache: 'no-store' })
        if (!res.ok) return
        const etag = res.headers.get('etag') + res.headers.get('last-modified')
        if (etag === etagRef.current) return
        etagRef.current = etag
        if (!initialized) { initialized = true; return }
        const data = await res.json()
        setBlocks(data)
        setNextId(data.length ? Math.max(...data.map(b => b.id)) + 1 : 1)
      } catch {}
    }
    poll()
    const id = setInterval(poll, 1000)
    return () => clearInterval(id)
  }, [liveMode, setBlocks])
}
