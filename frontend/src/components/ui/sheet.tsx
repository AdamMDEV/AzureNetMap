import * as React from 'react'

interface SheetProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

interface SheetContentProps {
  side?: 'left' | 'right' | 'top' | 'bottom'
  className?: string
  children: React.ReactNode
}

const SheetContext = React.createContext<{ open: boolean; setOpen: (v: boolean) => void }>({
  open: false,
  setOpen: () => undefined,
})

function Sheet({ open = false, onOpenChange, children }: SheetProps) {
  const setOpen = (v: boolean) => onOpenChange?.(v)
  return (
    <SheetContext.Provider value={{ open, setOpen }}>
      {children}
    </SheetContext.Provider>
  )
}

function SheetTrigger({ asChild, children }: { asChild?: boolean; children: React.ReactNode }) {
  const { setOpen } = React.useContext(SheetContext)
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: () => void }>, {
      onClick: () => setOpen(true),
    })
  }
  return <button onClick={() => setOpen(true)}>{children}</button>
}

function SheetContent({ side = 'right', className = '', children }: SheetContentProps) {
  const { open, setOpen } = React.useContext(SheetContext)
  if (!open) return null

  const sideClass =
    side === 'left' ? 'left-0 top-0 h-full' : 'right-0 top-0 h-full'

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div className={`fixed ${sideClass} z-50 ${className}`}>
        {children}
      </div>
    </>
  )
}

export { Sheet, SheetContent, SheetTrigger }
