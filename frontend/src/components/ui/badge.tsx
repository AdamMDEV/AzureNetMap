import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80',
        secondary:
          'border-transparent bg-[#1f2937] text-slate-300 hover:bg-[#374151]',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80',
        outline: 'border-[#374151] text-slate-400',
        prod: 'border-blue-800/60 bg-blue-950/40 text-blue-300',
        dev: 'border-amber-800/60 bg-amber-950/40 text-amber-300',
        hub: 'border-purple-800/60 bg-purple-950/40 text-purple-300',
        external: 'border-slate-700 bg-slate-900/40 text-slate-400',
        allowed: 'border-emerald-800/60 bg-emerald-950/40 text-emerald-300',
        denied: 'border-red-800/60 bg-red-950/40 text-red-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
