import { useState } from 'react'
import { Activity, Check, X, AlertTriangle, RefreshCw, Database, Server, Play, Factory } from 'lucide-react'
import GlassCard from '../components/GlassCard'
import { supabase } from '../lib/supabase'
import clsx from 'clsx'

export default function Diagnostics() {
    const [running, setRunning] = useState(false)
    const [logs, setLogs] = useState<string[]>([])
    const [results, setResults] = useState<{ [key: string]: 'pending' | 'success' | 'error' | 'warning' }>({
        connection: 'pending',
        locations: 'pending',
        consistency: 'pending',
        writeTest: 'pending',
        productionTest: 'pending'
    })

    function log(msg: string) {
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`])
    }

    async function runScenario(scenario: 'health' | 'integrity' | 'write' | 'production') {
        setRunning(true)
        log(`--- STARTING SCENARIO: ${scenario.toUpperCase()} ---`)

        try {
            if (scenario === 'health') {
                // TEST 1: Connection
                log('Testing Supabase Connection...')
                const { count, error: connError } = await supabase.from('items').select('*', { count: 'exact', head: true })
                if (connError) throw connError
                log(`SUCCESS: Connected. Items table check OK.`)
                setResults(prev => ({ ...prev, connection: 'success' }))

                // TEST 2: Locations
                log('Checking Locations configuration...')
                const { data: locs, error: locError } = await supabase.from('locations').select('*')
                if (locError) throw locError
                const warehouses = locs?.filter(l => l.type === 'warehouse') || []

                if (warehouses.length === 0) {
                    log('CRITICAL: No warehouse location found!')
                    setResults(prev => ({ ...prev, locations: 'error' }))
                } else {
                    log(`SUCCESS: Main Warehouse found: ${warehouses[0].name} (${warehouses[0].id})`)
                    setResults(prev => ({ ...prev, locations: 'success' }))
                }
            }

            if (scenario === 'integrity') {
                log('=== SYSTEM AUDIT ===')
                const { data: locs } = await supabase.from('locations').select('id').eq('type', 'warehouse')
                const warehouseId = locs?.[0]?.id
                if (!warehouseId) throw new Error('No warehouse found')

                const { data: moves } = await supabase.from('inventory_moves').select('*').order('created_at', { ascending: false })
                const { data: inventory } = await supabase.from('inventory').select('*')

                log(`Total History Moves: ${moves?.length || 0}`)
                log(`Total Inventory Records: ${inventory?.length || 0}`)

                // Check for duplicate triggers effect (Double Counting)
                let calculatedInv: Record<string, number> = {}
                moves?.forEach(m => {
                    if (m.to_location_id === warehouseId) calculatedInv[m.item_id] = (calculatedInv[m.item_id] || 0) + m.quantity
                    if (m.from_location_id === warehouseId) calculatedInv[m.item_id] = (calculatedInv[m.item_id] || 0) - m.quantity
                })

                let discrepancies = 0
                Object.entries(calculatedInv).forEach(([itemId, qty]) => {
                    if (Math.abs(qty) < 0.01) return
                    const actual = inventory?.find(i => i.item_id == itemId && i.location_id == warehouseId)
                    const actualQty = actual?.quantity || 0

                    if (Math.abs(actualQty - qty) > 0.01) {
                        discrepancies++
                        if (discrepancies <= 5) log(`MISMATCH Item ${itemId}: History=${qty.toFixed(2)}, DB=${actualQty.toFixed(2)}`)
                    }
                })

                if (discrepancies > 0) {
                    log(`FAILURE: Found ${discrepancies} items with mismatches.`)
                    setResults(prev => ({ ...prev, consistency: 'error' }))
                } else {
                    log('SUCCESS: All inventory matches history perfectly.')
                    setResults(prev => ({ ...prev, consistency: 'success' }))
                }
            }

            if (scenario === 'write') {
                log('Running Basic Write Test...')
                const { data: newItem } = await supabase.from('items').insert({
                    name: 'TEST_' + Date.now(), type: 'raw_material', unit_cost: 100
                }).select().single()
                if (!newItem) throw new Error('Failed to create item')
                log(`Created item ${newItem.id}`)

                const { data: locs } = await supabase.from('locations').select('id').eq('type', 'warehouse')
                const testLoc = locs?.[0]?.id
                const testQty = 50

                await supabase.from('inventory_moves').insert({
                    item_id: newItem.id, to_location_id: testLoc, quantity: testQty, type: 'purchase', unit_price: 100
                })
                log('Inserted Move (+50)')
                await new Promise(r => setTimeout(r, 1000))

                const { data: checkInv } = await supabase.from('inventory').select('*').eq('item_id', newItem.id).eq('location_id', testLoc).single()

                if (!checkInv) {
                    log('FAILURE: No inventory record created!')
                    setResults(prev => ({ ...prev, writeTest: 'error' }))
                } else if (checkInv.quantity === testQty) {
                    log(`SUCCESS: Quantity is ${testQty}.`)
                    setResults(prev => ({ ...prev, writeTest: 'success' }))
                } else {
                    log(`FAILURE: Quantity mismatch. Got ${checkInv.quantity}, expected ${testQty}.`)
                    setResults(prev => ({ ...prev, writeTest: 'error' }))
                }

                // Cleanup
                await supabase.from('inventory_moves').delete().eq('item_id', newItem.id)
                await supabase.from('inventory').delete().eq('item_id', newItem.id)
                await supabase.from('items').delete().eq('id', newItem.id)
            }

            if (scenario === 'production') {
                log('=== PRODUCTION SIMULATION ===')

                // 1. Setup
                log('1. Creating Test Items...')
                const { data: rawItem } = await supabase.from('items').insert({ name: 'TEST_RAW_' + Date.now(), type: 'raw_material', unit_cost: 10 }).select().single()
                const { data: prodItem } = await supabase.from('items').insert({ name: 'TEST_PROD_' + Date.now(), type: 'finished_good', unit_cost: 0 }).select().single()

                if (!rawItem || !prodItem) throw new Error('Failed to create items')
                log(`RAW: ${rawItem.id}, PROD: ${prodItem.id}`)

                const { data: locs } = await supabase.from('locations').select('id').eq('type', 'warehouse')
                const whId = locs?.[0]?.id

                // 2. Add Stock
                log('2. Adding Stock (RAW +100)...')
                await supabase.from('inventory_moves').insert({
                    item_id: rawItem.id, to_location_id: whId, quantity: 100, type: 'purchase', unit_price: 10
                })
                await new Promise(r => setTimeout(r, 500))

                // Verify Stock
                const { data: rawInv } = await supabase.from('inventory').select('quantity').eq('item_id', rawItem.id).single()
                if (rawInv?.quantity !== 100) {
                    log(`FAILURE: Initial stock failed. Got ${rawInv?.quantity}`)
                    throw new Error('Initial stock failed')
                }
                log('Stock Verified (100).')

                // 3. Create Recipe (1 PROD = 10 RAW)
                log('3. Creating Recipe...')
                await supabase.from('recipes').insert({
                    finished_good_id: prodItem.id, ingredient_id: rawItem.id, quantity: 10
                })

                // 4. Run Production (Produce 1 PROD)
                log('4. Running Production (1 Unit)...')
                // Simulate what the app does:
                // A. Deduct RAW (10)
                await supabase.from('inventory_moves').insert({
                    item_id: rawItem.id, from_location_id: whId, to_location_id: null, quantity: 10, type: 'production', unit_price: 0
                })
                // B. Add PROD (1)
                await supabase.from('inventory_moves').insert({
                    item_id: prodItem.id, from_location_id: null, to_location_id: whId, quantity: 1, type: 'production', unit_price: 100
                })

                log('Moves inserted. Waiting for triggers...')
                await new Promise(r => setTimeout(r, 1000))

                // 5. Final Verification
                log('5. Verifying Final Balances...')
                const { data: finalRaw } = await supabase.from('inventory').select('quantity').eq('item_id', rawItem.id).single()
                const { data: finalProd } = await supabase.from('inventory').select('quantity').eq('item_id', prodItem.id).single()

                log(`RAW Balance: ${finalRaw?.quantity} (Expected 90)`)
                log(`PROD Balance: ${finalProd?.quantity} (Expected 1)`)

                let passed = true
                if (finalRaw?.quantity !== 90) {
                    log('FAILURE: Raw material did not deduct correctly!')
                    passed = false
                }
                if (finalProd?.quantity !== 1) {
                    log('FAILURE: Product did not add correctly!')
                    passed = false
                }

                if (passed) {
                    log('SUCCESS: Production flow worked perfectly.')
                    setResults(prev => ({ ...prev, productionTest: 'success' }))
                } else {
                    setResults(prev => ({ ...prev, productionTest: 'error' }))
                }

                // Cleanup
                log('Cleaning up...')
                await supabase.from('recipes').delete().eq('finished_good_id', prodItem.id)
                await supabase.from('inventory_moves').delete().eq('item_id', rawItem.id)
                await supabase.from('inventory_moves').delete().eq('item_id', prodItem.id)
                await supabase.from('inventory').delete().eq('item_id', rawItem.id)
                await supabase.from('inventory').delete().eq('item_id', prodItem.id)
                await supabase.from('items').delete().eq('id', rawItem.id)
                await supabase.from('items').delete().eq('id', prodItem.id)
            }

        } catch (err: any) {
            log(`ERROR: ${err.message}`)
        } finally {
            setRunning(false)
        }
    }

    return (
        <div className="p-8 space-y-6 max-w-5xl mx-auto">
            <h1 className="text-3xl font-bold flex items-center gap-3">
                <Activity className="w-8 h-8 text-primary" />
                Диагностика и Тесты
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <button onClick={() => runScenario('health')} disabled={running} className="p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 text-left transition-colors">
                    <div className="flex items-center gap-3 mb-2">
                        <Server className="w-5 h-5 text-blue-400" /> <span className="font-bold">1. Здоровье</span>
                    </div>
                    <p className="text-xs text-secondary">База и Локации</p>
                </button>

                <button onClick={() => runScenario('integrity')} disabled={running} className="p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 text-left transition-colors">
                    <div className="flex items-center gap-3 mb-2">
                        <Database className="w-5 h-5 text-purple-400" /> <span className="font-bold">2. Аудит</span>
                    </div>
                    <p className="text-xs text-secondary">Сверка остатков</p>
                </button>

                <button onClick={() => runScenario('write')} disabled={running} className="p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 text-left transition-colors">
                    <div className="flex items-center gap-3 mb-2">
                        <Play className="w-5 h-5 text-emerald-400" /> <span className="font-bold">3. Тест Записи</span>
                    </div>
                    <p className="text-xs text-secondary">Проверка триггеров</p>
                </button>

                <button onClick={() => runScenario('production')} disabled={running} className="p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 text-left transition-colors">
                    <div className="flex items-center gap-3 mb-2">
                        <Factory className="w-5 h-5 text-orange-400" /> <span className="font-bold">4. Производство</span>
                    </div>
                    <p className="text-xs text-secondary">Симуляция цикла</p>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <ResultCard title="Связь" icon={Server} status={results.connection} />
                <ResultCard title="Склад" icon={Database} status={results.locations} />
                <ResultCard title="Аудит" icon={Activity} status={results.consistency} />
                <ResultCard title="Производство" icon={Factory} status={results.productionTest} />
            </div>

            <GlassCard className="p-0 overflow-hidden font-mono text-sm">
                <div className="bg-black/40 p-3 border-b border-white/10 flex items-center justify-between">
                    <span className="text-secondary">Лог операций</span>
                    <span className="text-xs text-white/30">{logs.length} events</span>
                </div>
                <div className="p-4 h-96 overflow-y-auto space-y-2 bg-black/20">
                    {logs.length === 0 ? <div className="text-white/20 text-center py-20">Выберите сценарий...</div> :
                        logs.map((L, i) => (
                            <div key={i} className={clsx("border-b border-white/5 pb-1 last:border-0",
                                L.includes("FAILURE") || L.includes("CRITICAL") ? "text-red-400" :
                                    L.includes("SUCCESS") ? "text-emerald-400" : "text-white/70")}>
                                {L}
                            </div>
                        ))
                    }
                </div>
            </GlassCard>
        </div>
    )
}

function ResultCard({ title, icon: Icon, status }: { title: string, icon: any, status: string }) {
    const colors = {
        pending: 'bg-white/5 border-white/10 text-secondary',
        success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
        error: 'bg-red-500/10 border-red-500/30 text-red-400',
        warning: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
    }
    const StatusIcon = status === 'success' ? Check : status === 'error' ? X : Activity
    return (
        <div className={clsx("p-4 rounded-xl border flex items-center gap-4", colors[status as keyof typeof colors])}>
            <div className={clsx("p-2 rounded-lg", status === 'pending' ? 'bg-white/5' : 'bg-black/20')}>
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <div className="text-xs opacity-70 uppercase mb-1">{title}</div>
                <div className="font-bold flex items-center gap-2">
                    {status === 'pending' ? '...' : status.toUpperCase()}
                    {status !== 'pending' && <StatusIcon className="w-4 h-4" />}
                </div>
            </div>
        </div>
    )
}
