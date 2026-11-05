import { useEffect, useState } from 'react'

export function useStoredState<T>(key: string, fallback: T, validate: (value: unknown) => T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? validate(JSON.parse(raw)) : fallback
    } catch { return fallback }
  })
  const [storageAvailable, setStorageAvailable] = useState(true)
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)) }
    catch {
      // This effect synchronizes external storage and must report an actual write failure.
      // oxlint-disable-next-line react/set-state-in-effect
      setStorageAvailable(false)
    }
  }, [key, value])
  return [value, setValue, storageAvailable] as const
}
