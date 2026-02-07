import { useState, useEffect } from 'react'
import {
    X,
    ChevronRight,
    ChevronLeft,
    Warehouse,
    Factory,
    Truck,
    Droplets,
    Package,
    Snowflake,
    ArrowRight
} from 'lucide-react'
import GlassCard from './GlassCard'
import clsx from 'clsx'

// --- Custom CSS for Animations ---
const customStyles = `
@keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
}
@keyframes merge-in {
    0% { transform: scale(0.8); opacity: 0; }
    50% { transform: scale(1.1); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
}
@keyframes slide-right {
    0% { transform: translateX(-20px); opacity: 0; }
    100% { transform: translateX(0); opacity: 1; }
}
@keyframes pulse-ring {
    0% { transform: scale(0.8); box-shadow: 0 0 0 0 rgba(34, 211, 238, 0.7); }
    70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(34, 211, 238, 0); }
    100% { transform: scale(0.8); box-shadow: 0 0 0 0 rgba(34, 211, 238, 0); }
}
.anim-float { animation: float 3s ease-in-out infinite; }
.anim-merge { animation: merge-in 0.5s ease-out forwards; }
.anim-slide { animation: slide-right 0.5s ease-out forwards; }
.anim-pulse { animation: pulse-ring 2s infinite; }
`

interface GuideStep {
    id: string
    title: string
    description: string
    renderVisual: () => JSX.Element
}

export default function UserGuideModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const [currentStep, setCurrentStep] = useState(0)

    useEffect(() => {
        if (isOpen) setCurrentStep(0)
    }, [isOpen])

    if (!isOpen) return null

    const steps: GuideStep[] = [
        {
            id: 'intro',
            title: "Как работает ваш бизнес?",
            description: "Давайте представим, что у нас есть **Фабрика Льда**.\n\nЧтобы заработать деньги, нам нужно пройти простой цикл: купить воду, заморозить её и продать лёд.\n\nAntigravity ERP помогает на каждом этапе.",
            renderVisual: () => (
                <div className="relative w-full h-40 flex items-center justify-center">
                    <style>{customStyles}</style>
                    <div className="flex gap-4 items-center">
                        <Warehouse className="w-12 h-12 text-blue-300 anim-float" style={{ animationDelay: '0s' }} />
                        <ArrowRight className="w-6 h-6 text-white/30" />
                        <Factory className="w-12 h-12 text-primary anim-float" style={{ animationDelay: '0.5s' }} />
                        <ArrowRight className="w-6 h-6 text-white/30" />
                        <Truck className="w-12 h-12 text-green-300 anim-float" style={{ animationDelay: '1s' }} />
                    </div>
                </div>
            )
        },
        {
            id: 'warehouse',
            title: "1. Склад: Закупка",
            description: "Сначала нам нужно сырьё. \n\nМы покупаем **Воду** и **Пакеты**. \nВ разделе **Склад** мы нажимаем «Приход».\n\nСистема запоминает, что у нас есть запасы, и записывает **Расход денег** в кассе.",
            renderVisual: () => (
                <div className="relative w-full h-40 flex items-center justify-center gap-8 bg-blue-500/10 rounded-xl border border-blue-500/20 overflow-hidden">
                    <div className="flex flex-col items-center gap-2 anim-slide" style={{ animationDelay: '0.1s' }}>
                        <Droplets className="w-10 h-10 text-blue-400" />
                        <span className="text-xs text-blue-200">Вода</span>
                    </div>
                    <div className="flex flex-col items-center gap-2 anim-slide" style={{ animationDelay: '0.3s' }}>
                        <Package className="w-10 h-10 text-white/80" />
                        <span className="text-xs text-white/70">Пакеты</span>
                    </div>
                    <div className="absolute bottom-2 right-2 text-red-400 text-xs font-mono bg-red-500/10 px-2 py-1 rounded">
                        - 1000 ₽ (Расход)
                    </div>
                </div>
            )
        },
        {
            id: 'recipes',
            title: "2. Рецепты: План",
            description: "Как сделать лёд? \n\nМы создаем **Рецепт**: \n`1 Пакет Льда = 1 литр Воды + 1 Пакет`.\n\nТеперь система знает: когда мы произведем лёд, нужно автоматически списать воду и пакеты со склада.",
            renderVisual: () => (
                <div className="relative w-full h-40 flex flex-col items-center justify-center bg-white/5 rounded-xl border border-white/10">
                    <div className="flex items-center gap-4 text-2xl font-bold text-white/50 mb-2">
                        <Droplets className="w-6 h-6" /> + <Package className="w-6 h-6" /> = <span className="text-primary">?</span>
                    </div>
                    <div className="bg-black/40 px-4 py-2 rounded-lg border border-primary/30 text-primary text-sm font-mono mt-2 flex items-center gap-2 anim-pulse">
                        <Snowflake className="w-4 h-4" />
                        Рецепт "Лёд 5кг" готов
                    </div>
                </div>
            )
        },
        {
            id: 'production',
            title: "3. Производство: Магия",
            description: "Мы запускаем станок!\n\nЗаходим в **Производство**, выбираем «Лёд» и пишем «100 штук».\n\n**Магия**: Вода и пакеты исчезают со склада, а Лёд появляется. Себестоимость (сколько стоила вода + пакет) считается сама.",
            renderVisual: () => (
                <div className="relative w-full h-40 flex items-center justify-center bg-gradient-to-br from-indigo-900/20 to-purple-900/20 rounded-xl border border-indigo-500/20">
                    <div className="flex items-center gap-2 absolute left-4 opacity-50">
                        <Droplets className="w-6 h-6 text-blue-300" />
                        <Package className="w-6 h-6 text-white" />
                    </div>

                    <ArrowRight className="w-8 h-8 text-white/20 animate-pulse" />

                    <div className="w-20 h-20 bg-primary/20 rounded-xl flex items-center justify-center border border-primary anim-merge shadow-[0_0_30px_rgba(34,211,238,0.3)] ml-4">
                        <Snowflake className="w-10 h-10 text-primary animate-spin-slow" style={{ animationDuration: '10s' }} />
                    </div>
                </div>
            )
        },
        {
            id: 'distribution',
            title: "4. Продажа: Прибыль",
            description: "Грузим лёд в машину.\n\nВ разделе **Распределение** мы отправляем товар Клиенту. \n\nЕсли клиент платит сразу — мы получаем **Доход**. Если берет «под реализацию» — система напомнит забрать деньги позже.",
            renderVisual: () => (
                <div className="relative w-full h-40 flex items-center justify-between px-8 bg-green-900/10 rounded-xl border border-green-500/20">

                    <div className="flex flex-col items-center">
                        <Snowflake className="w-8 h-8 text-primary mb-1" />
                        <span className="text-[10px] text-white/50">Товар</span>
                    </div>

                    <div className="relative w-full h-0.5 bg-white/10 mx-4 overflow-hidden">
                        <div className="absolute w-1/3 h-full bg-green-400/50 anim-slide" style={{ animationDuration: '1.5s', animationIterationCount: 'infinite' }}></div>
                    </div>

                    <div className="flex flex-col items-center">
                        <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-black font-bold text-xl shadow-[0_0_20px_rgba(34,197,94,0.4)] anim-merge delay-500">
                            ₽
                        </div>
                        <span className="text-[10px] text-green-400 mt-2">Касса</span>
                    </div>
                </div>
            )
        }
    ]

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1)
        } else {
            onClose()
        }
    }

    const handlePrev = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1)
        }
    }

    const step = steps[currentStep]

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity"
                onClick={onClose}
            />

            <div className="relative w-full max-w-4xl transform transition-all">
                <GlassCard className="border-primary/20 shadow-[0_0_60px_-15px_rgba(34,211,238,0.15)] p-0 overflow-hidden">

                    <div className="flex flex-col md:flex-row min-h-[500px]">

                        {/* LEFT: Text Content */}
                        <div className="w-full md:w-1/2 p-8 flex flex-col justify-center border-b md:border-b-0 md:border-r border-white/10">
                            <h2 className="text-3xl font-bold text-white mb-6 animate-in slide-in-from-left-4 duration-500">
                                {step.title}
                            </h2>
                            <div className="text-lg text-secondary/90 leading-relaxed whitespace-pre-wrap animate-in slide-in-from-left-4 duration-500 delay-100 mb-8">
                                {step.description}
                            </div>

                            {/* Desktop Controls (Hidden on mobile) */}
                            <div className="hidden md:flex items-center gap-4 mt-auto">
                                <div className="flex gap-2 mr-auto">
                                    {steps.map((_, idx) => (
                                        <div
                                            key={idx}
                                            className={clsx(
                                                "h-1.5 rounded-full transition-all duration-300",
                                                idx === currentStep
                                                    ? "bg-primary w-8"
                                                    : "bg-white/20 w-2"
                                            )}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* RIGHT: Visual & Controls */}
                        <div className="w-full md:w-1/2 p-8 bg-black/20 flex flex-col items-center justify-center relative">
                            {/* Close Button */}
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-secondary hover:text-white transition-colors z-10"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            {/* Animation Stage */}
                            <div className="w-full flex-1 flex items-center justify-center animate-in zoom-in duration-500">
                                {step.renderVisual()}
                            </div>

                            {/* Mobile/Bottom Controls */}
                            <div className="w-full flex items-center justify-between mt-8 pt-6 border-t border-white/10">
                                <button
                                    onClick={handlePrev}
                                    disabled={currentStep === 0}
                                    className={clsx(
                                        "flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-medium",
                                        currentStep === 0
                                            ? "opacity-0 cursor-default"
                                            : "hover:bg-white/10 text-secondary hover:text-white"
                                    )}
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    Назад
                                </button>

                                <button
                                    onClick={handleNext}
                                    className="flex items-center gap-2 px-8 py-3 bg-primary hover:bg-primary/90 text-black font-bold rounded-lg shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95"
                                >
                                    {currentStep === steps.length - 1 ? "Всё понятно!" : "Далее"}
                                    {currentStep !== steps.length - 1 && <ChevronRight className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                    </div>
                </GlassCard>
            </div>
        </div>
    )
}
