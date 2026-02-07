import { useState, useEffect, useRef } from 'react'
import { BookOpen, Plus, Trash2, X, ArrowRight, Pencil, Check } from 'lucide-react'
import GlassCard from '../components/GlassCard'
import CustomSelect from '../components/CustomSelect'
import IconPicker, { iconMap } from '../components/IconPicker'
import { supabase, Item, Recipe } from '../lib/supabase'
import clsx from 'clsx'

interface RecipeWithNames extends Recipe {
    ingredient_name?: string
    unit_cost?: number
}

export default function Recipes() {
    const nameInputRef = useRef<HTMLInputElement>(null)
    const [finishedGoods, setFinishedGoods] = useState<Item[]>([])
    const [rawMaterials, setRawMaterials] = useState<Item[]>([])
    const [selectedProduct, setSelectedProduct] = useState<number | string | null>(null)
    const [recipes, setRecipes] = useState<RecipeWithNames[]>([])
    const [allRecipes, setAllRecipes] = useState<{ finished_good_id: number | string }[]>([])
    const [newIngredient, setNewIngredient] = useState<number | string | null>(null)
    const [newQuantity, setNewQuantity] = useState('')
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [recipeCost, setRecipeCost] = useState(0)
    const [initialReturnsToRaw, setInitialReturnsToRaw] = useState(false)

    useEffect(() => { loadData() }, [])
    useEffect(() => {
        if (selectedProduct) {
            loadRecipes(selectedProduct)
            setIsEditing(false)
        }
    }, [selectedProduct])

    async function loadData() {
        const [fgResult, rmResult, allRecResult] = await Promise.all([
            supabase.from('items').select('*').eq('type', 'finished_good').order('name'),
            supabase.from('items').select('*').eq('type', 'raw_material').order('name'),
            supabase.from('recipes').select('finished_good_id')
        ])
        setFinishedGoods(fgResult.data || [])
        setRawMaterials(rmResult.data || [])
        setAllRecipes(allRecResult.data || [])
        if (fgResult.data && fgResult.data.length > 0) setSelectedProduct(fgResult.data[0].id)
    }

    async function loadRecipes(productId: number | string) {
        try {
            const { data, error } = await supabase
                .from('recipes')
                .select(`
                    *,
                    item:items!recipes_ingredient_id_fkey(name, unit_cost)
                `)
                .eq('finished_good_id', productId)

            if (error) throw error

            const formatted = data?.map(r => ({
                ...r,
                ingredient_name: (r.item as any)?.name,
                unit_cost: Number((r.item as any)?.unit_cost) || 0
            })) || []

            setRecipes(formatted)

            // Calculate theoretical cost
            const total = formatted.reduce((sum, r) => sum + (Number(r.quantity || 0) * (Number(r.unit_cost) || 0)), 0)
            setRecipeCost(isNaN(total) ? 0 : total)
        } catch (err) {
            console.error('Error loading recipes:', err)
        }
    }

    async function handleAddIngredient() {
        if (!selectedProduct || !newIngredient || !newQuantity) return
        await supabase.from('recipes').insert({
            finished_good_id: selectedProduct,
            ingredient_id: newIngredient,
            quantity: parseFloat(newQuantity),
            // Inherit the returns_to_raw setting from existing items, or use the initial choice
            returns_to_raw: recipes.length > 0 ? recipes[0].returns_to_raw : initialReturnsToRaw
        })
        setNewIngredient(null)
        setNewQuantity('')
        loadRecipes(selectedProduct)
    }

    async function handleDeleteIngredient(ingredientId: number | string) {
        if (!selectedProduct) return
        await supabase.from('recipes').delete().eq('finished_good_id', selectedProduct).eq('ingredient_id', ingredientId)
        loadRecipes(selectedProduct)
    }

    const [newItemName, setNewItemName] = useState('')
    const [newItemIsWeighted, setNewItemIsWeighted] = useState(false)
    const [newItemReturnsToRaw, setNewItemReturnsToRaw] = useState(false)
    const [newItemIcon, setNewItemIcon] = useState('package')

    async function handleCreateItem() {
        if (!newItemName) return

        const payload: any = {
            name: newItemName,
            type: newItemReturnsToRaw ? 'raw_material' : 'finished_good',
            unit_cost: 0,
            sale_price: 0,
            is_weighted: newItemIsWeighted,
            icon: newItemIcon
        }

        const { data } = await supabase.from('items').insert(payload).select().single()

        if (data) {
            if (newItemReturnsToRaw) {
                setRawMaterials(prev => [...prev, data])
            } else {
                setFinishedGoods(prev => [...prev, data])
            }
            setSelectedProduct(data.id)
            setInitialReturnsToRaw(newItemReturnsToRaw) // Save user choice for the new recipe
        }

        setShowCreateModal(false)
        setNewItemName('')
        setIsEditing(true) // Сразу переходим к редактированию состава
    }



    async function handleUpdateReturnsToRaw(isReturnsToRaw: boolean) {
        if (!selectedProduct) return

        if (!selectedProduct) return

        // Update local state for immediate feedback
        setRecipes(prev => prev.map(r => ({ ...r, returns_to_raw: isReturnsToRaw })))
        setInitialReturnsToRaw(isReturnsToRaw) // Update fallback as well

        // Update all recipe items for this product
        await supabase
            .from('recipes')
            .update({ returns_to_raw: isReturnsToRaw })
            .eq('finished_good_id', selectedProduct)
    }

    async function handleDeleteProduct() {
        if (!selectedProduct) return
        const confirmDelete = window.confirm('Вы уверены, что хотите удалить этот продукт и его рецепт?')
        if (!confirmDelete) return

        try {
            // Удаляем рецепты (ингредиенты)
            await supabase.from('recipes').delete().eq('finished_good_id', selectedProduct)
            // Удаляем сам товар
            await supabase.from('items').delete().eq('id', selectedProduct)

            loadData()
            setSelectedProduct(null)
            setRecipes([])
        } catch (err) {
            console.error('Ошибка удаления:', err)
            alert('Ошибка удаления')
        }
    }

    return (
        <div className="p-8 space-y-6">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center"><BookOpen className="w-6 h-6 text-primary" /></div>
                <div><h1 className="text-3xl font-bold">Рецепты</h1><p className="text-secondary">Редактор состава продукции (BOM)</p></div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <GlassCard className="lg:col-span-1">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold">Продукты с рецептами</h2>
                        <button
                            onClick={() => {
                                setNewItemIsWeighted(false);
                                setShowCreateModal(true)
                            }}
                            className="p-2 hover:bg-white/10 rounded-lg transition-smooth"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="space-y-2">
                        {/* Показываем только товары, у которых ЕСТЬ рецепты */}
                        {finishedGoods
                            .filter(item => {
                                // Проверяем, есть ли у товара рецепты
                                return allRecipes.some(r => r.finished_good_id === item.id) || selectedProduct === item.id
                            })
                            .map(item => (
                                <button key={item.id} onClick={() => setSelectedProduct(item.id)} className={clsx('w-full p-3 rounded-lg border transition-smooth text-left', selectedProduct === item.id ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/10 hover:bg-white/10 text-white')}>
                                    <div className="font-medium">{item.name}</div>
                                    <div className="text-xs text-secondary">{item.type === 'finished_good' ? 'Готовая продукция' : 'Сырьё'}</div>
                                </button>
                            ))
                        }
                        {/* Показываем сырьё с рецептами */}
                        {rawMaterials
                            .filter(item => {
                                return allRecipes.some(r => r.finished_good_id === item.id) || selectedProduct === item.id
                            })
                            .map(item => (
                                <button key={item.id} onClick={() => setSelectedProduct(item.id)} className={clsx('w-full p-3 rounded-lg border transition-smooth text-left', selectedProduct === item.id ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/10 hover:bg-white/10 text-white')}>
                                    <div className="font-medium">{item.name}</div>
                                    <div className="text-xs text-secondary">{item.type === 'finished_good' ? 'Готовая продукция' : 'Сырьё'}</div>
                                </button>
                            ))
                        }
                    </div>
                </GlassCard>
                <GlassCard className="lg:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-xl font-semibold">Состав: {[...finishedGoods, ...rawMaterials].find(p => p.id === selectedProduct)?.name || '—'}</h2>
                            {selectedProduct && recipes.length > 0 && ![...finishedGoods, ...rawMaterials].find(p => p.id === selectedProduct && p.type === 'raw_material') && (
                                <p className="text-sm text-secondary mt-1">
                                    Теоретическая себестоимость: <span className="text-primary font-bold">{recipeCost.toFixed(2)} ₽</span>
                                </p>
                            )}

                        </div>
                        {selectedProduct && (
                            <button onClick={handleDeleteProduct} className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-smooth" title="Удалить продукт">
                                <Trash2 className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                    {/* Editable Sales Price for Finished Goods */}
                    {selectedProduct && ![...finishedGoods, ...rawMaterials].find(p => p.id === selectedProduct && p.type === 'raw_material') && (
                        <div className="mb-4 flex items-center gap-2">
                            <span className="text-sm text-secondary">Цена продажи:</span>
                            <input
                                type="number"
                                className="bg-transparent border-b border-white/20 text-green-400 font-bold w-24 focus:outline-none focus:border-primary text-right"
                                placeholder="0.00"
                                onBlur={async (e) => {
                                    const val = parseFloat(e.target.value);
                                    if (isNaN(val)) return;
                                    await supabase.from('items').update({ sale_price: val }).eq('id', selectedProduct);
                                    loadData(); // Reload to refresh data
                                }}
                                defaultValue={[...finishedGoods, ...rawMaterials].find(p => p.id === selectedProduct)?.sale_price || ''}
                                key={selectedProduct} // Re-render on product change
                            />
                            <span className="text-sm text-secondary">₽</span>
                        </div>
                    )}

                    {!isEditing ? (
                        // Визуальный режим
                        <div className="flex flex-col items-center justify-center py-10 space-y-8 animate-in fade-in duration-300">
                            <div className="flex items-center gap-4 lg:gap-12 overflow-x-auto p-4 w-full justify-center">
                                {/* Ingredients Column */}
                                <div className="flex flex-col gap-4">
                                    {recipes.length > 0 ? recipes.map(r => (
                                        <div key={r.ingredient_id} className="p-4 bg-white/5 rounded-xl border border-white/10 min-w-[160px] text-center shadow-lg relative group transition-smooth hover:bg-white/10">
                                            <div className="absolute right-0 top-1/2 -mr-6 w-6 h-[2px] bg-white/10 lg:hidden block"></div> {/* Mobile connector? */}
                                            <div className="font-bold text-white">{r.ingredient_name}</div>
                                            <div className="text-sm text-secondary mt-1">{r.quantity} ед.</div>
                                        </div>
                                    )) : (
                                        <div className="p-4 bg-white/5 rounded-xl border border-white/10 min-w-[160px] text-center text-secondary border-dashed">
                                            Нет ингредиентов
                                        </div>
                                    )}
                                </div>

                                {/* Arrow */}
                                <div className="flex flex-col items-center justify-center text-secondary">
                                    <ArrowRight className="w-8 h-8 lg:w-12 lg:h-12 text-primary/50" />
                                </div>

                                {/* Product Column */}
                                <div className="p-6 bg-primary/20 rounded-xl border border-primary/50 min-w-[160px] text-center shadow-xl shadow-primary/10 transform scale-105 flex flex-col items-center">
                                    <div className="w-12 h-12 bg-black/20 rounded-lg flex items-center justify-center mb-2 text-white">
                                        {(() => {
                                            const item = [...finishedGoods, ...rawMaterials].find(p => p.id === selectedProduct)
                                            if (!item) return <div className="w-6 h-6 bg-gray-500 rounded-full" />

                                            // Safer icon resolution
                                            const iconName = item.icon || 'package'
                                            const IconComponent = (iconMap && iconMap[iconName]) ? iconMap[iconName] : (iconMap?.['package'] || null)

                                            if (!IconComponent) return <div className="w-6 h-6 bg-gray-500 rounded-full" />
                                            return <IconComponent className="w-6 h-6" />
                                        })()}
                                    </div>
                                    <div className="font-bold text-lg text-white">
                                        {[...finishedGoods, ...rawMaterials].find(p => p.id === selectedProduct)?.name || 'Неизвестно'}
                                    </div>
                                    <div className="text-sm text-primary mt-1">1 ед.</div>
                                </div>
                            </div>

                            <button
                                onClick={() => setIsEditing(true)}
                                className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-smooth text-secondary hover:text-white"
                            >
                                <Pencil className="w-4 h-4" />
                                Редактировать рецепт
                            </button>
                        </div>
                    ) : (
                        // Режим редактирования
                        <div className="animate-in fade-in duration-300">
                            {/* Настройки типа продукта */}
                            <div className="mb-6 bg-white/5 p-4 rounded-lg border border-white/10">
                                <label className="block text-sm font-medium mb-3 text-secondary">Тип продукта (как учитывается на складе)</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => handleUpdateReturnsToRaw(false)} // Set to FALSE (Finished Good)
                                        className={clsx(
                                            'p-3 rounded-lg border transition-smooth text-left relative overflow-hidden',
                                            recipes.length > 0 ? !recipes[0].returns_to_raw : !initialReturnsToRaw
                                                ? 'bg-primary/20 border-primary shadow-[0_0_15px_-3px_rgba(34,211,238,0.3)]'
                                                : 'bg-white/5 border-white/10 hover:bg-white/10 opacity-60 hover:opacity-100'
                                        )}
                                    >
                                        {/* Marker for active state */}
                                        {(recipes.length > 0 ? !recipes[0].returns_to_raw : !initialReturnsToRaw) && (
                                            <div className="absolute top-2 right-2 text-primary">
                                                <Check className="w-4 h-4" />
                                            </div>
                                        )}
                                        <div className={clsx("font-bold text-sm", (recipes.length > 0 ? !recipes[0].returns_to_raw : !initialReturnsToRaw) ? "text-white" : "text-secondary")}>Готовая продукция</div>
                                        <p className="text-xs text-secondary mt-1">Продается клиентам (шт)</p>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleUpdateReturnsToRaw(true)} // Set to TRUE (Raw from Raw)
                                        className={clsx(
                                            'p-3 rounded-lg border transition-smooth text-left relative overflow-hidden',
                                            recipes.length > 0 ? recipes[0].returns_to_raw : initialReturnsToRaw
                                                ? 'bg-primary/20 border-primary shadow-[0_0_15px_-3px_rgba(34,211,238,0.3)]'
                                                : 'bg-white/5 border-white/10 hover:bg-white/10 opacity-60 hover:opacity-100'
                                        )}
                                    >
                                        {(recipes.length > 0 ? recipes[0].returns_to_raw : initialReturnsToRaw) && (
                                            <div className="absolute top-2 right-2 text-primary">
                                                <Check className="w-4 h-4" />
                                            </div>
                                        )}
                                        <div className={clsx("font-bold text-sm", (recipes.length > 0 ? recipes[0].returns_to_raw : initialReturnsToRaw) ? "text-white" : "text-secondary")}>Полуфабрикат</div>
                                        <p className="text-xs text-secondary mt-1">Используется в других рецептах (г)</p>
                                    </button>
                                </div>
                            </div>

                            <h3 className="font-semibold mb-3 px-1">Список ингредиентов</h3>
                            <div className="space-y-3 mb-6">
                                {recipes.length === 0 ? <div className="text-center py-8 text-secondary border border-dashed border-white/10 rounded-lg">Список пуст. Добавьте ингредиенты ниже.</div> : recipes.map(r => (
                                    <div key={r.ingredient_id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                                        <div className="flex-1">
                                            <div className="font-medium">{r.ingredient_name}</div>
                                            <div className="text-sm text-secondary flex gap-4 mt-1">
                                                <span>Количество: {r.quantity}</span>
                                                <span className="text-white/50">
                                                    ({((Number(r.quantity) || 0) * (Number(r.unit_cost) || 0)).toFixed(2)} ₽)
                                                </span>
                                            </div>
                                        </div>
                                        <button onClick={() => handleDeleteIngredient(r.ingredient_id)} className="w-8 h-8 flex items-center justify-center hover:bg-red-500/20 rounded-lg transition-smooth text-red-400"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                ))}
                            </div>

                            {selectedProduct && (
                                <div className="border-t border-white/10 pt-6">
                                    <h3 className="font-semibold mb-4">Добавить ингредиент</h3>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-2">Выберите ингредиент</label>
                                            <div className="flex gap-2">
                                                <CustomSelect
                                                    value={newIngredient}
                                                    onChange={(val) => setNewIngredient(val)}
                                                    options={[...rawMaterials, ...finishedGoods]
                                                        .filter(item => {
                                                            // Исключаем сам продукт (чтобы не добавить себя в себя)
                                                            if (item.id === selectedProduct) return false
                                                            // Исключаем уже добавленные ингредиенты
                                                            if (recipes.find(r => r.ingredient_id === item.id)) return false
                                                            return true
                                                        })
                                                        .map(i => ({
                                                            value: i.id,
                                                            label: `${i.name} ${i.type === 'finished_good' ? '(Прод.)' : ''}`
                                                        }))
                                                    }
                                                    placeholder="Поиск ингредиента..."
                                                    className="flex-1"
                                                />
                                            </div>
                                        </div>
                                        <div><label className="block text-sm font-medium mb-2">Количество</label><input type="number" value={newQuantity} onChange={e => setNewQuantity(e.target.value)} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary" placeholder="0" step="0.01" /></div>
                                    </div>

                                    <div className="flex gap-4 mt-6">
                                        <button onClick={() => setIsEditing(false)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg font-medium text-secondary hover:text-white transition-smooth">
                                            Готово
                                        </button>
                                        <button onClick={handleAddIngredient} disabled={!newIngredient || !newQuantity} className={clsx('flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium', !newIngredient || !newQuantity ? 'bg-white/10 text-secondary cursor-not-allowed' : 'bg-primary hover:bg-primary/90 text-white')}><Plus className="w-5 h-5" />Добавить</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </GlassCard>
            </div >

            {showCreateModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[10000]">
                    <GlassCard className="w-full max-w-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold">Новый продукт</h2>
                            <button onClick={() => setShowCreateModal(false)} className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Иконка</label>
                                <IconPicker value={newItemIcon} onChange={setNewItemIcon} />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Название</label>
                                <input
                                    ref={nameInputRef}
                                    type="text"
                                    value={newItemName}
                                    onChange={e => setNewItemName(e.target.value)}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary"
                                    placeholder="Название"
                                    autoFocus
                                />
                            </div>
                            {/* Sales price message */}
                            <div className="text-sm text-secondary p-2 bg-white/5 rounded-lg border border-white/10">
                                <p>Тип продукта: {newItemReturnsToRaw ? 'Полуфабрикат (сырьё)' : 'Готовая продукция'}</p>
                            </div>

                            {/* Product Type Toggle */}
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setNewItemReturnsToRaw(false)}
                                    className={clsx("p-3 rounded-lg border text-left transition-all", !newItemReturnsToRaw ? "bg-primary/20 border-primary" : "bg-white/5 border-white/10 hover:bg-white/10")}
                                >
                                    <div className="font-medium text-sm">Готовая продукция</div>
                                    <div className="text-xs text-secondary mt-1">Для продажи</div>
                                </button>
                                <button
                                    onClick={() => setNewItemReturnsToRaw(true)}
                                    className={clsx("p-3 rounded-lg border text-left transition-all", newItemReturnsToRaw ? "bg-primary/20 border-primary" : "bg-white/5 border-white/10 hover:bg-white/10")}
                                >
                                    <div className="font-medium text-sm">Внутренний рецепт</div>
                                    <div className="text-xs text-secondary mt-1">Сырьё из сырья</div>
                                </button>
                            </div>

                            <div
                                className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10 cursor-pointer hover:bg-white/10 transition-smooth"
                                onClick={() => setNewItemIsWeighted(!newItemIsWeighted)}
                            >
                                <div className={clsx("w-5 h-5 rounded border flex items-center justify-center transition-colors", newItemIsWeighted ? "bg-primary border-primary" : "border-white/30")}>
                                    {newItemIsWeighted && <Check className="w-3 h-3 text-white" />}
                                </div>
                                <div>
                                    <div className="text-sm font-medium">Весовой товар</div>
                                    <div className="text-xs text-secondary">Измеряется в граммах</div>
                                </div>
                            </div>
                            <button
                                onClick={handleCreateItem}
                                disabled={!newItemName}
                                className="w-full py-3 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium mt-2"
                            >
                                Создать
                            </button>
                        </div>
                    </GlassCard >
                </div >
            )
            }
        </div >
    )
}

