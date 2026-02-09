import { useState, useEffect, useRef } from 'react'
import { BookOpen, Plus, Trash2, X, Pencil, Check, FileText } from 'lucide-react'
import GlassCard from '../components/GlassCard'
import CustomSelect from '../components/CustomSelect'
import IconPicker, { iconMap } from '../components/IconPicker'
import { supabase, Item, Recipe } from '../lib/supabase'
import clsx from 'clsx'

interface RecipeWithNames extends Recipe {
    ingredient_name?: string
    is_weighted?: boolean
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
                    item:items!recipes_ingredient_id_fkey(name, is_weighted)
                `)
                .eq('finished_good_id', productId)

            if (error) throw error

            const formatted = data?.map(r => ({
                ...r,
                ingredient_name: (r.item as any)?.name,
                is_weighted: (r.item as any)?.is_weighted
            })) || []

            setRecipes(formatted)
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
            setInitialReturnsToRaw(newItemReturnsToRaw)
        }

        setShowCreateModal(false)
        setNewItemName('')
        setIsEditing(true)
    }

    async function handleUpdateReturnsToRaw(isReturnsToRaw: boolean) {
        if (!selectedProduct) return

        setRecipes(prev => prev.map(r => ({ ...r, returns_to_raw: isReturnsToRaw })))
        setInitialReturnsToRaw(isReturnsToRaw)

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
            await supabase.from('recipes').delete().eq('finished_good_id', selectedProduct)
            await supabase.from('items').delete().eq('id', selectedProduct)

            loadData()
            setSelectedProduct(null)
            setRecipes([])
        } catch (err) {
            console.error('Ошибка удаления:', err)
            alert('Ошибка удаления')
        }
    }

    // Get current product
    const currentProduct = [...finishedGoods, ...rawMaterials].find(p => p.id === selectedProduct)

    // Save notes
    async function handleSaveNotes(notes: string) {
        if (!selectedProduct) return
        await supabase.from('items').update({ notes }).eq('id', selectedProduct)
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
                        {finishedGoods
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
                            <h2 className="text-xl font-semibold">Рецепт: {currentProduct?.name || '—'}</h2>
                        </div>
                        {selectedProduct && (
                            <button onClick={handleDeleteProduct} className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-smooth" title="Удалить продукт">
                                <Trash2 className="w-5 h-5" />
                            </button>
                        )}
                    </div>

                    {!isEditing ? (
                        // Визуальный режим
                        <div className="animate-in fade-in duration-300 space-y-6">
                            {/* Recipe Visualization */}
                            <div className="flex items-center gap-4 justify-center py-6">
                                {/* Ingredients */}
                                <div className="flex-1 max-w-[200px]">
                                    <div className="text-xs text-secondary mb-2 text-center uppercase tracking-wide">Сырьё</div>
                                    <div className="bg-gradient-to-br from-red-500/10 to-orange-500/10 rounded-xl border border-red-500/20 p-4 space-y-2 min-h-[100px] flex flex-col justify-center">
                                        {recipes.length > 0 ? recipes.map(r => (
                                            <div key={r.ingredient_id} className="flex items-center justify-between text-sm">
                                                <span className="text-white">{r.ingredient_name}</span>
                                                <span className="text-red-300 font-medium">{r.quantity} {r.is_weighted ? 'г' : 'шт'}</span>
                                            </div>
                                        )) : (
                                            <div className="text-center text-secondary text-sm">Нет ингредиентов</div>
                                        )}
                                    </div>
                                </div>

                                {/* Process Arrow with Animation */}
                                <div className="flex flex-col items-center justify-center px-2 self-center">
                                    {/* Unified animated arrow */}
                                    <div
                                        className="w-16 h-4 relative"
                                        style={{
                                            clipPath: 'polygon(0% 35%, 75% 35%, 75% 0%, 100% 50%, 75% 100%, 75% 65%, 0% 65%)'
                                        }}
                                    >
                                        <div
                                            className="absolute inset-0"
                                            style={{
                                                background: 'linear-gradient(90deg, #a855f7, #22d3ee, #a855f7)',
                                                backgroundSize: '200% 100%',
                                                animation: 'flowGradient 1.5s linear infinite'
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Result */}
                                <div className="flex-1 max-w-[200px]">
                                    <div className="text-xs text-secondary mb-2 text-center uppercase tracking-wide">Результат</div>
                                    <div className="bg-gradient-to-br from-purple-500/20 to-cyan-500/20 rounded-xl border border-purple-500/30 p-4 text-center shadow-lg shadow-purple-500/10 min-h-[100px] flex flex-col justify-center">
                                        <div className="w-14 h-14 mx-auto bg-black/30 rounded-xl flex items-center justify-center mb-3 text-white">
                                            {(() => {
                                                if (!currentProduct) return <div className="w-6 h-6 bg-gray-500 rounded-full" />
                                                const iconName = currentProduct.icon || 'package'
                                                const IconComponent = (iconMap && iconMap[iconName]) ? iconMap[iconName] : (iconMap?.['package'] || null)
                                                if (!IconComponent) return <div className="w-6 h-6 bg-gray-500 rounded-full" />
                                                return <IconComponent className="w-7 h-7" />
                                            })()}
                                        </div>
                                        <div className="font-bold text-white text-lg">{currentProduct?.name || 'Неизвестно'}</div>
                                        <div className="text-sm text-purple-300 mt-1">1 ед.</div>
                                        {(currentProduct?.sale_price ?? 0) > 0 && (
                                            <div className="text-sm text-cyan-400 mt-2 font-medium">{currentProduct?.sale_price} ₽</div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Sale Price Edit */}
                            {selectedProduct && currentProduct?.type !== 'raw_material' && (
                                <div className="flex items-center gap-2 justify-center">
                                    <span className="text-sm text-secondary">Цена продажи:</span>
                                    <input
                                        type="number"
                                        className="bg-transparent border-b border-white/20 text-green-400 font-bold w-24 focus:outline-none focus:border-primary text-center"
                                        placeholder="0"
                                        onBlur={async (e) => {
                                            const val = parseFloat(e.target.value);
                                            if (isNaN(val)) return;
                                            await supabase.from('items').update({ sale_price: val }).eq('id', selectedProduct);
                                            loadData();
                                        }}
                                        defaultValue={currentProduct?.sale_price || ''}
                                        key={`price-${selectedProduct}`}
                                    />
                                    <span className="text-sm text-secondary">₽</span>
                                </div>
                            )}

                            {/* Editable Notes - always visible */}
                            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                                <div className="flex items-center gap-2 text-secondary text-sm mb-2">
                                    <FileText className="w-4 h-4" />
                                    Заметки к рецепту
                                </div>
                                <textarea
                                    key={`notes-${selectedProduct}`}
                                    defaultValue={currentProduct?.notes || ''}
                                    onBlur={async (e) => {
                                        if (!selectedProduct) return
                                        await supabase.from('items').update({ notes: e.target.value }).eq('id', selectedProduct)
                                        loadData()
                                    }}
                                    placeholder="Инструкции, напоминания, комментарии..."
                                    className="w-full bg-transparent text-white text-sm resize-none h-20 focus:outline-none placeholder:text-white/30"
                                />
                            </div>

                            <button
                                onClick={() => setIsEditing(true)}
                                className="flex items-center justify-center gap-2 w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-smooth text-secondary hover:text-white"
                            >
                                <Pencil className="w-4 h-4" />
                                Редактировать рецепт
                            </button>
                        </div>
                    ) : (
                        // Режим редактирования
                        <div className="animate-in fade-in duration-300 space-y-6">
                            {/* Product Type */}
                            <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                                <label className="block text-sm font-medium mb-3 text-secondary">Тип продукта</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => handleUpdateReturnsToRaw(false)}
                                        className={clsx(
                                            'p-3 rounded-lg border transition-smooth text-left relative',
                                            recipes.length > 0 ? !recipes[0].returns_to_raw : !initialReturnsToRaw
                                                ? 'bg-primary/20 border-primary'
                                                : 'bg-white/5 border-white/10 hover:bg-white/10'
                                        )}
                                    >
                                        {(recipes.length > 0 ? !recipes[0].returns_to_raw : !initialReturnsToRaw) && (
                                            <div className="absolute top-2 right-2 text-primary"><Check className="w-4 h-4" /></div>
                                        )}
                                        <div className="font-bold text-sm text-white">Готовая продукция</div>
                                        <p className="text-xs text-secondary mt-1">Продается клиентам</p>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleUpdateReturnsToRaw(true)}
                                        className={clsx(
                                            'p-3 rounded-lg border transition-smooth text-left relative',
                                            recipes.length > 0 ? recipes[0].returns_to_raw : initialReturnsToRaw
                                                ? 'bg-primary/20 border-primary'
                                                : 'bg-white/5 border-white/10 hover:bg-white/10'
                                        )}
                                    >
                                        {(recipes.length > 0 ? recipes[0].returns_to_raw : initialReturnsToRaw) && (
                                            <div className="absolute top-2 right-2 text-primary"><Check className="w-4 h-4" /></div>
                                        )}
                                        <div className="font-bold text-sm text-white">Полуфабрикат</div>
                                        <p className="text-xs text-secondary mt-1">Используется в других рецептах</p>
                                    </button>
                                </div>
                            </div>

                            {/* Ingredients List */}
                            <div>
                                <h3 className="font-semibold mb-3">Список ингредиентов</h3>
                                <div className="space-y-2 mb-4">
                                    {recipes.length === 0 ? (
                                        <div className="text-center py-8 text-secondary border border-dashed border-white/10 rounded-lg">
                                            Список пуст. Добавьте ингредиенты ниже.
                                        </div>
                                    ) : recipes.map(r => (
                                        <div key={r.ingredient_id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                                            <div>
                                                <div className="font-medium text-white">{r.ingredient_name}</div>
                                                <div className="text-sm text-secondary">Количество: {r.quantity}</div>
                                            </div>
                                            <button onClick={() => handleDeleteIngredient(r.ingredient_id)} className="w-8 h-8 flex items-center justify-center hover:bg-red-500/20 rounded-lg transition-smooth text-red-400">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Add Ingredient */}
                            {selectedProduct && (
                                <div className="border-t border-white/10 pt-6">
                                    <h3 className="font-semibold mb-4">Добавить ингредиент</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-2">Ингредиент</label>
                                            <CustomSelect
                                                value={newIngredient}
                                                onChange={(val) => setNewIngredient(val)}
                                                options={[...rawMaterials, ...finishedGoods]
                                                    .filter(item => {
                                                        if (item.id === selectedProduct) return false
                                                        if (recipes.find(r => r.ingredient_id === item.id)) return false
                                                        return true
                                                    })
                                                    .map(i => ({
                                                        value: i.id,
                                                        label: `${i.name} ${i.type === 'finished_good' ? '(Прод.)' : ''}`
                                                    }))
                                                }
                                                placeholder="Выберите..."
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-2">Количество</label>
                                            <input
                                                type="number"
                                                value={newQuantity}
                                                onChange={e => setNewQuantity(e.target.value)}
                                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary"
                                                placeholder="0"
                                                step="0.01"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-4 mt-4">
                                        <button
                                            onClick={handleAddIngredient}
                                            disabled={!newIngredient || !newQuantity}
                                            className={clsx(
                                                'flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium',
                                                !newIngredient || !newQuantity
                                                    ? 'bg-white/10 text-secondary cursor-not-allowed'
                                                    : 'bg-primary hover:bg-primary/90 text-white'
                                            )}
                                        >
                                            <Plus className="w-5 h-5" />
                                            Добавить
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Notes */}
                            <div>
                                <h3 className="font-semibold mb-3 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-cyan-400" />
                                    Заметки
                                </h3>
                                <textarea
                                    defaultValue={currentProduct?.notes || ''}
                                    onBlur={e => handleSaveNotes(e.target.value)}
                                    placeholder="Инструкции, памятка для оператора..."
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary resize-none h-24"
                                />
                            </div>

                            {/* Done Button */}
                            <button
                                onClick={() => setIsEditing(false)}
                                className="w-full py-3 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium"
                            >
                                Готово
                            </button>
                        </div>
                    )}
                </GlassCard>
            </div>

            {/* Create Modal */}
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
                                    <div className="font-medium text-sm">Полуфабрикат</div>
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
                    </GlassCard>
                </div>
            )}

            {/* CSS for animation */}
            <style>{`
                @keyframes flowGradient {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
            `}</style>
        </div>
    )
}
