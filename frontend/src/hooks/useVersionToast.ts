import { useEffect } from 'react'
import { toast } from 'sonner'
import { APP_VERSION, VERSION_SEEN_KEY } from '@/components/TopNav'

export function useVersionToast(onViewChangelog: () => void) {
  useEffect(() => {
    const seen = localStorage.getItem(VERSION_SEEN_KEY)
    if (seen === APP_VERSION) return

    const t = toast.info(`Updated to v${APP_VERSION}`, {
      description: 'Persistent nav, focus mode fix, rule planner (WIP), and more.',
      duration: 8000,
      action: {
        label: 'View changelog',
        onClick: () => {
          localStorage.setItem(VERSION_SEEN_KEY, APP_VERSION)
          onViewChangelog()
        },
      },
      onDismiss: () => localStorage.setItem(VERSION_SEEN_KEY, APP_VERSION),
      onAutoClose: () => localStorage.setItem(VERSION_SEEN_KEY, APP_VERSION),
    })
    return () => {
      if (t) toast.dismiss(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
