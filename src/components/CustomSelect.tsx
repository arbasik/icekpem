import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import clsx from 'clsx'

interface Option {
    value: string | number
    label: string
}

interface CustomSelectProps {
    options: Option[]
    value: string | number | null
    onChange: (value: string | number) => void
    placeholder?: string
    className?: string
    disabled?: boolean
}

export default function CustomSelect({
    options,
    value,
    onChange,
    placeholder = 'Выберите...',
    className,
    disabled = false
}: CustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    const selectedOption = options.find(opt => opt.value === value)

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div className={clsx('relative', className)} ref={containerRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={clsx(
                    'w-full flex items-center justify-between px-4 py-3 bg-white/5 border rounded-lg text-left transition-smooth',
                    'focus:outline-none focus:border-primary',
                    disabled ? 'opacity-50 cursor-not-allowed border-white/5' : 'hover:bg-white/10 border-white/10 cursor-pointer',
                    isOpen && 'border-primary ring-1 ring-primary/50'
                )}
            >
                <span className={clsx('block truncate', !selectedOption && 'text-secondary')}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown className={clsx('w-4 h-4 text-secondary transition-transform', isOpen && 'transform rotate-180')} />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-[#1A1A1A] border border-white/10 rounded-lg shadow-xl max-h-60 overflow-auto focus:outline-none animate-in fade-in zoom-in-95 duration-100">
                    <div className="py-1">
                        {options.map((option) => (
                            <div
                                key={option.value}
                                onClick={() => {
                                    onChange(option.value)
                                    setIsOpen(false)
                                }}
                                className={clsx(
                                    'relative flex items-center justify-between px-4 py-2 cursor-pointer transition-colors',
                                    'hover:bg-primary/20 hover:text-primary',
                                    option.value === value ? 'bg-primary/10 text-primary font-medium' : 'text-gray-300'
                                )}
                            >
                                <span className="block truncate">{option.label}</span>
                                {option.value === value && <Check className="w-4 h-4 ml-2" />}
                            </div>
                        ))}
                        {options.length === 0 && (
                            <div className="px-4 py-2 text-sm text-secondary text-center">
                                Нет данных
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
