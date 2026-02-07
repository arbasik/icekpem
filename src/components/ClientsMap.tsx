import { useEffect, useRef, useState } from 'react'
import { Location } from '../lib/supabase'
import L from 'leaflet'

interface ClientsMapProps {
    clients: Location[]
    onClientClick?: (client: Location) => void
}

export default function ClientsMap({ clients, onClientClick }: ClientsMapProps) {
    const mapRef = useRef<HTMLDivElement>(null)
    const mapInstanceRef = useRef<L.Map | null>(null)
    const tileLayerRef = useRef<L.TileLayer | null>(null)
    const [mapStyle, setMapStyle] = useState<'stadia-dark' | 'osm-light'>('stadia-dark')

    const clientsWithCoords = clients.filter(c => c.latitude && c.longitude)

    // Инициализация карты
    useEffect(() => {
        if (!mapRef.current) return

        if (!mapInstanceRef.current) {
            const center: [number, number] = clientsWithCoords.length > 0
                ? [
                    clientsWithCoords.reduce((sum, c) => sum + (c.latitude || 0), 0) / clientsWithCoords.length,
                    clientsWithCoords.reduce((sum, c) => sum + (c.longitude || 0), 0) / clientsWithCoords.length
                ]
                : [55.7558, 37.6173]

            mapInstanceRef.current = L.map(mapRef.current, {
                attributionControl: false,
                zoomControl: false // Скроем дефолтный зум, чтобы он не мешал (опционально)
            }).setView(center, clientsWithCoords.length === 1 ? 17 : 13) // Зум 14+ показывает номера домов на Dark карте

            // Добавляем зум в другое место или оставляем дефолт
            L.control.zoom({ position: 'bottomright' }).addTo(mapInstanceRef.current)
        }

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove()
                mapInstanceRef.current = null
                tileLayerRef.current = null
            }
        }
    }, []) // Пустой массив зависимостей, карта создается один раз

    // Обновление тайлов при смене стиля
    useEffect(() => {
        if (!mapInstanceRef.current) return

        // Удаляем старый слой
        if (tileLayerRef.current) {
            mapInstanceRef.current.removeLayer(tileLayerRef.current)
        }

        let tileUrl: string
        let attribution: string = ''

        switch (mapStyle) {
            case 'stadia-dark':
                // Stadia Alidade Smooth Dark - стильная тёмная карта
                tileUrl = 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png'
                break
            case 'osm-light':
            default:
                // 2GIS - детальная карта с русскими названиями
                tileUrl = 'https://tile2.maps.2gis.com/tiles?x={x}&y={y}&z={z}'
                attribution = '&copy; <a href="https://2gis.ru">2GIS</a>'
                break
        }

        tileLayerRef.current = L.tileLayer(tileUrl, {
            maxZoom: 20,
            minZoom: 3,
            attribution: attribution
        }).addTo(mapInstanceRef.current)

    }, [mapStyle])

    // Обновление маркеров
    useEffect(() => {
        if (!mapInstanceRef.current) return

        // Очищаем старые маркеры
        mapInstanceRef.current.eachLayer((layer) => {
            if (layer instanceof L.Marker) {
                mapInstanceRef.current?.removeLayer(layer)
            }
        })

        // Кастомная иконка в тёмной теме (изумрудный акцент)
        const customIcon = L.divIcon({
            className: 'custom-marker',
            html: `
                <div style="
                    position: relative;
                    width: 32px;
                    height: 32px;
                ">
                    <div style="
                        width: 32px;
                        height: 32px;
                        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                        border: 2px solid rgba(255, 255, 255, 0.9);
                        border-radius: 50%;
                        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4), 0 0 0 3px rgba(16, 185, 129, 0.15);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: all 0.2s ease;
                    ">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                    </div>
                    <div style="
                        position: absolute;
                        bottom: -6px;
                        left: 50%;
                        transform: translateX(-50%);
                        width: 0;
                        height: 0;
                        border-left: 5px solid transparent;
                        border-right: 5px solid transparent;
                        border-top: 6px solid #059669;
                    "></div>
                </div>
            `,
            iconSize: [32, 40],
            iconAnchor: [16, 40],
            popupAnchor: [0, -40]
        })

        // Добавляем маркеры
        clientsWithCoords.forEach(client => {
            if (!mapInstanceRef.current) return

            const marker = L.marker([client.latitude!, client.longitude!], { icon: customIcon })
                .addTo(mapInstanceRef.current)

            // Tooltip при наведении (тёмная тема)
            const tooltipContent = `
                <div style="
                    background: rgba(20, 20, 25, 0.95);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    padding: 8px 12px;
                    color: white;
                    font-family: system-ui, -apple-system, sans-serif;
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
                ">
                    <div style="font-weight: 600; font-size: 13px;">${client.name}</div>
                </div>
            `

            marker.bindTooltip(tooltipContent, {
                direction: 'top',
                offset: [0, -8],
                opacity: 1,
                className: 'custom-tooltip'
            })

            // Popup при клике (glassmorphism тёмная тема)
            const popupContent = `
                <div style="
                    background: rgba(25, 25, 30, 0.95);
                    backdrop-filter: blur(16px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 12px;
                    padding: 16px;
                    min-width: 220px;
                    color: white;
                    font-family: system-ui, -apple-system, sans-serif;
                    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
                ">
                    <div style="
                        font-weight: bold; 
                        font-size: 15px; 
                        margin-bottom: 10px; 
                        color: #10b981;
                    ">${client.name}</div>
                    ${client.address ? `
                        <div style="
                            font-size: 12px; 
                            color: rgba(255,255,255,0.7); 
                            margin-bottom: 6px;
                            display: flex;
                            align-items: start;
                            gap: 6px;
                        ">
                            <span style="color: #10b981;">📍</span>
                            <span>${client.address}</span>
                        </div>
                    ` : ''}
                    ${client.contact ? `
                        <div style="
                            font-size: 12px; 
                            color: rgba(255,255,255,0.7);
                            display: flex;
                            align-items: center;
                            gap: 6px;
                        ">
                            <span style="color: #10b981;">📞</span>
                            <span>${client.contact}</span>
                        </div>
                    ` : ''}
                </div>
            `
            marker.bindPopup(popupContent, {
                className: 'custom-popup'
            })

            marker.on('click', () => {
                onClientClick?.(client)
            })
        })
    }, [clients, onClientClick]) // Обновляем маркеры при изменении списка клиентов

    if (clientsWithCoords.length === 0) {
        return (
            <div className="h-full flex items-center justify-center text-secondary">
                <div className="text-center">
                    <p className="text-lg">Нет клиентов с адресами на карте</p>
                    <p className="text-sm mt-2">Добавьте адреса клиентам для отображения на карте</p>
                </div>
            </div>
        )
    }

    return (
        <div className="relative h-full w-full rounded-2xl overflow-hidden">
            <style>{`
                .custom-tooltip {
                    background: transparent !important;
                    border: none !important;
                    box-shadow: none !important;
                    padding: 0 !important;
                }
                .custom-tooltip::before {
                    display: none !important;
                }
                .leaflet-popup-content-wrapper {
                    background: transparent !important;
                    box-shadow: none !important;
                    padding: 0 !important;
                }
                .leaflet-popup-tip {
                    background: white !important;
                }
                .custom-marker:hover > div > div:first-child {
                    transform: scale(1.15) !important;
                    box-shadow: 0 6px 24px rgba(102, 126, 234, 0.7), 0 0 0 6px rgba(102, 126, 234, 0.25) !important;
                }
                /* Стили для контролов */
                .leaflet-control-zoom {
                    border: none !important;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
                }
                .leaflet-control-zoom a {
                    background: rgba(30, 30, 35, 0.8) !important;
                    color: white !important;
                    backdrop-filter: blur(10px) !important;
                    border-bottom: 1px solid rgba(255,255,255,0.1) !important;
                }
                .leaflet-control-zoom a:hover {
                    background: rgba(60, 60, 70, 0.9) !important;
                }
                .leaflet-control-zoom a:first-child {
                    border-top-left-radius: 8px !important;
                    border-top-right-radius: 8px !important;
                }
                .leaflet-control-zoom a:last-child {
                    border-bottom-left-radius: 8px !important;
                    border-bottom-right-radius: 8px !important;
                    border-bottom: none !important;
                }
                /* Popup стили для тёмной темы */
                .custom-popup .leaflet-popup-content-wrapper {
                    background: transparent !important;
                    box-shadow: none !important;
                    padding: 0 !important;
                    border-radius: 12px !important;
                }
                .custom-popup .leaflet-popup-tip {
                    background: rgba(25, 25, 30, 0.95) !important;
                    border: 1px solid rgba(255, 255, 255, 0.1) !important;
                }
                .custom-popup .leaflet-popup-content {
                    margin: 0 !important;
                }
            `}</style>

            <div ref={mapRef} style={{ height: '100%', width: '100%' }} />

            {/* Switch Map Style Control */}
            <div className="absolute top-4 right-4 z-[400] bg-black/60 backdrop-blur-md border border-white/10 rounded-lg p-1 flex gap-1 shadow-xl">
                <button
                    onClick={() => setMapStyle('stadia-dark')}
                    className={`
                        px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-300
                        ${mapStyle === 'stadia-dark'
                            ? 'bg-primary text-white shadow-lg'
                            : 'text-white/60 hover:text-white hover:bg-white/10'}
                    `}
                    title="Stadia Smooth Dark"
                >
                    Dark
                </button>
                <button
                    onClick={() => setMapStyle('osm-light')}
                    className={`
                        px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-300
                        ${mapStyle === 'osm-light'
                            ? 'bg-white text-black shadow-lg'
                            : 'text-white/60 hover:text-white hover:bg-white/10'}
                    `}
                    title="2GIS (детальная, русский)"
                >
                    Light
                </button>
            </div>
        </div>
    )
}
