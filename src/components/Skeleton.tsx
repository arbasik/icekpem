import clsx from 'clsx'
import GlassCard from './GlassCard'

interface SkeletonProps {
    className?: string
    variant?: 'text' | 'rectangular' | 'circular' | 'card'
}

export default function Skeleton({ className, variant = 'rectangular' }: SkeletonProps) {
    if (variant === 'card') {
        return (
            <GlassCard className={clsx('relative overflow-hidden w-full h-full p-6', className)}>
                <div className="absolute inset-0 bg-white/5 animate-pulse" />
                <div className="space-y-4 relative z-10 opacity-50">
                    <div className="h-4 bg-white/10 rounded w-1/3 animate-pulse" />
                    <div className="h-8 bg-white/10 rounded w-2/3 animate-pulse" />
                    <div className="h-3 bg-white/10 rounded w-1/2 animate-pulse mt-4" />
                </div>
            </GlassCard>
        )
    }

    return (
        <div
            className={clsx(
                'bg-white/10 animate-pulse',
                variant === 'circular' ? 'rounded-full' : 'rounded-md',
                className
            )}
        />
    )
}
