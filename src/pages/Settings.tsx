import { useState } from 'react'
import { Palette, Check } from 'lucide-react'
import GlassCard from '../components/GlassCard'
import clsx from 'clsx'


const THEMES = [
    { name: 'Киберпанк (Голубой)', color: '34 211 238', hex: '#22d3ee' },
    { name: 'Неон (Оранжевый)', color: '249 115 22', hex: '#f97316' },
    { name: 'Природа (Зеленый)', color: '16 185 129', hex: '#10b981' },
    { name: 'Фиолетовый', color: '139 92 246', hex: '#8b5cf6' },
    { name: 'Розовый', color: '236 72 153', hex: '#ec4899' },
    { name: 'Красный', color: '239 68 68', hex: '#ef4444' },
]



export default function Settings() {
    const [currentTheme, setCurrentTheme] = useState(localStorage.getItem('theme-color') || '34 211 238')

    function handleThemeChange(color: string) {
        setCurrentTheme(color)
        document.documentElement.style.setProperty('--color-primary', color)
        localStorage.setItem('theme-color', color)
    }



    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold mb-8">Настройки</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <GlassCard className="p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-primary/20 rounded-xl text-primary">
                            <Palette className="w-6 h-6" />
                        </div>
                        <h2 className="text-xl font-bold">Оформление</h2>
                    </div>

                    <div className="space-y-4">
                        <p className="text-secondary text-sm">Выберите основной цвет интерфейса</p>

                        <div className="grid grid-cols-3 gap-3">
                            {THEMES.map((theme) => (
                                <button
                                    key={theme.hex}
                                    onClick={() => handleThemeChange(theme.color)}
                                    className={clsx(
                                        "h-12 rounded-lg flex items-center justify-center transition-all relative overflow-hidden group",
                                        "border border-white/10 hover:border-white/30"
                                    )}
                                    style={{ background: `rgba(${theme.color.split(' ').join(',')}, 0.1)` }}
                                >
                                    <div
                                        className="w-4 h-4 rounded-full"
                                        style={{ background: theme.hex }}
                                    />
                                    {currentTheme === theme.color && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
                                            <Check className="w-5 h-5 text-white" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </GlassCard>


            </div>
        </div>
    )
}
