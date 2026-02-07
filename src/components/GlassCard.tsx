import { ReactNode } from 'react'
import clsx from 'clsx'

interface GlassCardProps {
    children: ReactNode
    className?: string
}

export default function GlassCard({ children, className }: GlassCardProps) {
    return (
        <div
            className={clsx(
                'glass-panel bg-glass/80 backdrop-blur-md border border-white/10 rounded-xl p-6',
                className
            )}
        >
            {children}
        </div>
    )
}
