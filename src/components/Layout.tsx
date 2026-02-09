import { useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import {
    LayoutDashboard,
    Warehouse as WarehouseIcon,
    BookOpen,
    Factory,
    Truck,
    DollarSign,
    Receipt,
    Users,
    Trash2,
    Settings,
    HelpCircle,
    ShoppingBag,
    ChevronDown,
    ChevronRight,
    Circle
} from 'lucide-react'
import clsx from 'clsx'
import { supabase } from '../lib/supabase'
import GlassCard from './GlassCard'
import UserGuideModal from './UserGuideModal'
import { useLocation } from 'react-router-dom'

interface NavItem {
    name: string
    path?: string
    icon: any
    children?: NavItem[]
    end?: boolean
}

const navigation: NavItem[] = [
    { name: 'Панель управления', path: '/dashboard', icon: LayoutDashboard },

    { name: 'Cклад', path: '/warehouse', icon: WarehouseIcon },
    {
        name: 'Производство', icon: Factory, children: [
            { name: 'Обзор', path: '/production', icon: Circle, end: true },
            { name: 'Рецепты', path: '/recipes', icon: BookOpen },
            { name: 'Операции', path: '/production/operations', icon: Receipt },
        ]
    },
    {
        name: 'Продажи', icon: ShoppingBag, children: [
            { name: 'Распределение', path: '/distribution', icon: Truck },
            { name: 'Клиенты', path: '/clients', icon: Users },
        ]
    },
    { name: 'Финансы', path: '/finance', icon: DollarSign },
    { name: 'Настройки', path: '/settings', icon: Settings },
]

export default function Layout() {
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [deleteLog, setDeleteLog] = useState<string[]>([])
    const [isDeleting, setIsDeleting] = useState(false)
    const [deleteComplete, setDeleteComplete] = useState(false)

    // Guide State
    const [showGuide, setShowGuide] = useState(false)

    // Navigation State
    const location = useLocation()
    const [expandedItems, setExpandedItems] = useState<string[]>(() => {
        // Auto-expand based on current URL
        const open: string[] = []
        if (location.pathname.startsWith('/production') || location.pathname.startsWith('/recipes')) open.push('Производство')
        if (location.pathname.startsWith('/distribution') || location.pathname.startsWith('/clients')) open.push('Продажи')
        return open
    })

    const toggleExpand = (name: string) => {
        setExpandedItems(prev =>
            prev.includes(name)
                ? prev.filter(n => n !== name)
                : [...prev, name]
        )
    }

    async function handleDeleteConfirm() {
        // ... (keep existing implementation)
        setIsDeleting(true)
        setDeleteLog([])

        try {
            const addLog = (msg: string) => setDeleteLog(prev => [...prev, msg])
            addLog('🚀 Начинаем удаление...')

            // Удаляем последовательно
            const r1 = await supabase.from('production_queue').delete().not('id', 'is', null)
            addLog(`Очередь производства: ${r1.error ? '❌ ' + r1.error.message : '✅ OK'}`)

            const r_trans = await supabase.from('transactions').delete().not('id', 'is', null)
            addLog(`Транзакции (Касса): ${r_trans.error ? '❌ ' + r_trans.error.message : '✅ OK'}`)

            const r_bal = await supabase.from('balance').update({ current_balance: 0 }).neq('id', 0)
            addLog(`Баланс обнулен: ${r_bal.error ? '❌ ' + r_bal.error.message : '✅ OK'}`)

            const r2 = await supabase.from('inventory_moves').delete().not('id', 'is', null)
            addLog(`История движения: ${r2.error ? '❌ ' + r2.error.message : '✅ OK'}`)

            const r4 = await supabase.from('recipes').delete().not('finished_good_id', 'is', null)
            addLog(`Рецепты: ${r4.error ? '❌ ' + r4.error.message : '✅ OK'}`)

            const r3 = await supabase.from('inventory').delete().not('id', 'is', null)
            addLog(`Инвентарь: ${r3.error ? '❌ ' + r3.error.message : '✅ OK'}`)

            const r6 = await supabase.from('locations').delete().eq('type', 'client')
            addLog(`Клиенты: ${r6.error ? '❌ ' + r6.error.message : '✅ OK'}`)

            const rAssets = await supabase.from('assets').delete().not('id', 'is', null)
            addLog(`Активы: ${rAssets.error ? '❌ ' + rAssets.error.message : '✅ OK'}`)

            const r5 = await supabase.from('items').delete().not('id', 'is', null)
            addLog(`Товары: ${r5.error ? '❌ ' + r5.error.message : '✅ OK'}`)

            addLog('✨ Готово! Можно перезагрузить программу.')
            setDeleteComplete(true)

        } catch (err: any) {
            setDeleteLog(prev => [...prev, `❌ Критическая ошибка: ${err.message}`])
            console.error('Ошибка:', err)
        } finally {
            setIsDeleting(false)
        }
    }

    function handleReload() {
        window.location.reload()
    }

    return (
        <div className="flex h-screen bg-void overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 bg-glass/80 backdrop-blur-md border-r border-white/10 flex flex-col">
                {/* Logo */}
                <div className="h-16 flex items-center px-6 border-b border-white/10">
                    <h1 className="text-xl font-bold text-primary">Antigravity ERP</h1>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                    {navigation.map((item) => {
                        const isExpanded = expandedItems.includes(item.name)
                        // Check if any child is active
                        const isChildActive = item.children?.some(child =>
                            child.path && location.pathname === child.path // Exact match looks better for highlighted children
                        )
                        // Parent is "active" if it's expanded or child is active? Mostly just if child active.
                        const isParentActive = isChildActive

                        return (
                            <div key={item.name}>
                                {item.children ? (
                                    <div className="space-y-1">
                                        {/* Collapsible Header Info */}
                                        <button
                                            onClick={() => toggleExpand(item.name)}
                                            className={clsx(
                                                'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer',
                                                isParentActive
                                                    ? 'bg-white/5 text-white'
                                                    : 'text-secondary hover:text-white hover:bg-white/5'
                                            )}
                                        >
                                            <item.icon className={clsx("w-5 h-5 transition-colors", isParentActive ? "text-primary" : "")} />
                                            <span className="flex-1 text-left font-medium">{item.name}</span>
                                            {isExpanded ? (
                                                <ChevronDown className="w-4 h-4 opacity-50" />
                                            ) : (
                                                <ChevronRight className="w-4 h-4 opacity-50" />
                                            )}
                                        </button>

                                        {/* Sub Items */}
                                        {isExpanded && (
                                            <div className="ml-5 pl-4 border-l border-white/10 space-y-0.5 pb-2 animation-fade-in">
                                                {item.children.map(child => (
                                                    <NavLink
                                                        key={child.name} // Use name as key since multiple might have same path eventually (though not here)
                                                        to={child.path || '#'}
                                                        end={child.end}
                                                        className={({ isActive }) =>
                                                            clsx(
                                                                'flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm',
                                                                isActive
                                                                    ? 'text-primary bg-primary/10 font-medium'
                                                                    : 'text-secondary/70 hover:text-white hover:bg-white/5'
                                                            )
                                                        }
                                                    >
                                                        {child.icon === Circle ? (
                                                            <div className={clsx("w-1.5 h-1.5 rounded-full transition-colors", location.pathname === child.path ? "bg-primary" : "bg-current opacity-50")} />
                                                        ) : (
                                                            <child.icon className="w-4 h-4 opacity-70" />
                                                        )}
                                                        <span>{child.name}</span>
                                                    </NavLink>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <NavLink
                                        to={item.path || '#'}
                                        className={({ isActive }) =>
                                            clsx(
                                                'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group',
                                                isActive
                                                    ? 'bg-primary/10 text-primary font-semibold'
                                                    : 'text-secondary hover:text-white hover:bg-white/5'
                                            )
                                        }
                                    >
                                        {({ isActive }) => (
                                            <>
                                                <item.icon className={clsx("w-5 h-5 transition-colors", isActive && "text-primary")} />
                                                <span>{item.name}</span>
                                            </>
                                        )}
                                    </NavLink>
                                )}
                            </div>
                        )
                    })}
                </nav>

                {/* Bottom Actions */}
                <div className="px-3 pb-4 space-y-2">
                    {/* User Guide Button */}
                    <button
                        onClick={() => setShowGuide(true)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-secondary hover:text-white hover:bg-white/5 transition-all group"
                    >
                        <div className="relative">
                            <HelpCircle className="w-5 h-5 group-hover:text-primary transition-colors" />
                            <div className="absolute inset-0 bg-primary/20 blur-md rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <span className="font-medium group-hover:text-primary transition-colors">Инструкция</span>
                    </button>

                    {/* Delete All Data Button - FOR TESTING */}
                    <div>
                        <button
                            onClick={() => setShowDeleteModal(true)}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-all"
                        >
                            <Trash2 className="w-5 h-5" />
                            <span className="text-sm font-medium">Удалить все данные</span>
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10">
                    <p className="text-xs text-secondary text-center">v1.1.0 (Guide)</p>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                <Outlet />
            </main>

            {/* User Guide Modal */}
            <UserGuideModal
                isOpen={showGuide}
                onClose={() => setShowGuide(false)}
            />

            {/* Custom Delete Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100000]">
                    <GlassCard className="w-full max-w-lg border-red-500/30">
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-red-500 mb-2">⚠️ Удаление всех данных</h2>
                            <p className="text-secondary">Это действие необратимо. Будут удалены все товары, транзакции, клиенты и история.</p>
                        </div>

                        {deleteLog.length > 0 && (
                            <div className="mb-6 p-4 bg-black/40 rounded-lg border border-white/10 font-mono text-sm max-h-60 overflow-y-auto space-y-1">
                                {deleteLog.map((line, i) => (
                                    <div key={i} className={line.includes('❌') ? 'text-red-400' : 'text-green-400'}>{line}</div>
                                ))}
                            </div>
                        )}

                        <div className="flex gap-4">
                            {!deleteComplete ? (
                                <>
                                    <button
                                        onClick={() => setShowDeleteModal(false)}
                                        disabled={isDeleting}
                                        className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-lg font-medium transition-smooth"
                                    >
                                        Отмена
                                    </button>
                                    <button
                                        onClick={handleDeleteConfirm}
                                        disabled={isDeleting}
                                        className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold transition-smooth"
                                    >
                                        {isDeleting ? 'Удаление...' : 'УДАЛИТЬ ВСЁ'}
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={handleReload}
                                    className="w-full py-3 bg-primary hover:bg-primary/90 text-white rounded-lg font-bold transition-smooth"
                                >
                                    Перезагрузить программу
                                </button>
                            )}
                        </div>
                    </GlassCard>
                </div>
            )}
        </div >
    )
}
