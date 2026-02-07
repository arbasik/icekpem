import { useState } from 'react'
import {
    Package, Box, Snowflake, Droplets, Zap,
    Coffee, Pizza, Utensils, Award, Gift,
    Sun, Moon, Star, Heart, Cloud,
    Anchor, Archive, Briefcase, Camera, Circle,
    Cpu, Database, Disc, DollarSign, Eye,
    File, Flag, Folder, Globe, Hexagon,
    Image, Key, Layers, Layout, Link,
    Lock, Map, MapPin, Monitor, Mouse,
    Music, Pen, Phone, PieChart, Play,
    Printer, Radio, Shield, ShoppingBag, ShoppingCart,
    Smartphone, Speaker, Table, Tag, Target,
    Thermometer, Trash, Truck, Tv,
    Umbrella, User, Video, Watch, Wifi,
    Wrench, X,
    Drumstick, Fish, Egg, Milk, Wheat, Croissant,
    Apple, Banana, Cherry, Grape, Carrot, Sandwich
} from 'lucide-react'
import clsx from 'clsx'

// Map of icon names to components
export const iconMap: Record<string, any> = {
    'package': Package,
    'chicken': Drumstick,
    'fish': Fish,
    'egg': Egg,
    'milk': Milk,
    'wheat': Wheat,
    'bread': Croissant,
    'apple': Apple,
    'banana': Banana,
    'cherry': Cherry,
    'grape': Grape,
    'carrot': Carrot,
    'sandwich': Sandwich,
    'box': Box,
    'snowflake': Snowflake,
    'droplets': Droplets,
    'zap': Zap,
    'coffee': Coffee,
    'pizza': Pizza,
    'utensils': Utensils,
    'award': Award,
    'gift': Gift,
    'sun': Sun,
    'moon': Moon,
    'star': Star,
    'heart': Heart,
    'cloud': Cloud,
    'anchor': Anchor,
    'archive': Archive,
    'briefcase': Briefcase,
    'camera': Camera,
    'circle': Circle,
    'cpu': Cpu,
    'database': Database,
    'disc': Disc,
    'dollar-sign': DollarSign,
    'eye': Eye,
    'file': File,
    'flag': Flag,
    'folder': Folder,
    'globe': Globe,
    'hexagon': Hexagon,
    'image': Image,
    'key': Key,
    'layers': Layers,
    'layout': Layout,
    'link': Link,
    'lock': Lock,
    'map': Map,
    'map-pin': MapPin,
    'monitor': Monitor,
    'mouse': Mouse,
    'music': Music,
    'pen': Pen,
    'phone': Phone,
    'pie-chart': PieChart,
    'play': Play,
    'printer': Printer,
    'radio': Radio,
    'shield': Shield,
    'shopping-bag': ShoppingBag,
    'shopping-cart': ShoppingCart,
    'smartphone': Smartphone,
    'speaker': Speaker,
    'tables': Table,
    'tag': Tag,
    'target': Target,
    'thermometer': Thermometer,
    'trash': Trash,
    'truck': Truck,
    'tv': Tv,
    'umbrella': Umbrella,
    'user': User,
    'video': Video,
    'watch': Watch,
    'wifi': Wifi,
    'wrench': Wrench,
    'x': X
}

interface IconPickerProps {
    value: string
    onChange: (icon: string) => void
}

export default function IconPicker({ value, onChange }: IconPickerProps) {
    const [isOpen, setIsOpen] = useState(false)
    const SelectedIcon = iconMap[value] || Package

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors w-full"
            >
                <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center text-primary">
                    <SelectedIcon className="w-5 h-5" />
                </div>
                <span className="text-secondary text-sm">Выберите иконку</span>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-full p-4 bg-[#1a1b26] border border-white/10 rounded-xl shadow-2xl z-[15000] grid grid-cols-6 gap-2 max-h-60 overflow-y-auto custom-scrollbar">
                    {Object.entries(iconMap).map(([name, Icon]) => (
                        <button
                            key={name}
                            type="button"
                            onClick={() => {
                                onChange(name)
                                setIsOpen(false)
                            }}
                            className={clsx(
                                "p-2 rounded-lg flex items-center justify-center transition-all hover:scale-110",
                                value === name ? "bg-primary text-white shadow-[0_0_10px_rgba(34,211,238,0.5)]" : "bg-white/5 text-secondary hover:bg-white/10 hover:text-white"
                            )}
                            title={name}
                        >
                            <Icon className="w-5 h-5" />
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
