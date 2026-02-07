import { useState, useEffect } from 'react'

interface AddressAutocompleteProps {
    value: string
    onChange: (address: string, lat?: number, lon?: number) => void
    placeholder?: string
}

interface DadataSuggestion {
    value: string
    data: {
        geo_lat: string
        geo_lon: string
    }
}

export default function AddressAutocomplete({ value, onChange, placeholder }: AddressAutocompleteProps) {
    const [suggestions, setSuggestions] = useState<DadataSuggestion[]>([])
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [loading, setLoading] = useState(false)

    const DADATA_TOKEN = "d1ee8daa112be66db3b136ca85f92f98a9e8b179"

    useEffect(() => {
        if (value.length < 3) {
            setSuggestions([])
            return
        }

        const timer = setTimeout(async () => {
            setLoading(true)
            try {
                const response = await fetch(
                    'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address',
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                            'Authorization': `Token ${DADATA_TOKEN}`
                        },
                        body: JSON.stringify({
                            query: value,
                            count: 5
                        })
                    }
                )

                if (response.ok) {
                    const data = await response.json()
                    setSuggestions(data.suggestions || [])
                    setShowSuggestions(true)
                } else {
                    console.error('Ошибка Dadata:', response.status)
                }
            } catch (err) {
                console.error('Ошибка автодополнения:', err)
            } finally {
                setLoading(false)
            }
        }, 300)

        return () => clearTimeout(timer)
    }, [value])

    function handleSelect(suggestion: DadataSuggestion) {
        const lat = suggestion.data.geo_lat ? parseFloat(suggestion.data.geo_lat) : undefined
        const lon = suggestion.data.geo_lon ? parseFloat(suggestion.data.geo_lon) : undefined
        onChange(suggestion.value, lat, lon)
        setShowSuggestions(false)
        setSuggestions([])
    }

    return (
        <div className="relative">
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary transition-smooth"
                placeholder={placeholder || "Начните вводить адрес..."}
            />
            {loading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary text-sm">
                    Поиск...
                </div>
            )}
            {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-2 bg-glass backdrop-blur-md border border-white/10 rounded-lg shadow-lg max-h-60 overflow-auto">
                    {suggestions.map((suggestion, index) => (
                        <button
                            key={index}
                            onClick={() => handleSelect(suggestion)}
                            className="w-full px-4 py-3 text-left hover:bg-white/10 transition-smooth border-b border-white/5 last:border-0"
                        >
                            <div className="text-sm text-white">{suggestion.value}</div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
