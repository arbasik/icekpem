import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Kassa from './pages/Kassa'
import Warehouse from './pages/Warehouse'
import InventoryHistory from './pages/InventoryHistory'
import Recipes from './pages/Recipes'
import Production from './pages/Production'
import ProductionOperations from './pages/ProductionOperations'
import Distribution from './pages/Distribution'
import Clients from './pages/Clients'
import Finance from './pages/Finance'
import Settings from './pages/Settings'
import { UpdateNotification } from './components/UpdateNotification'
import { useEffect } from 'react'



function App() {
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme-color')
        if (savedTheme) {
            document.documentElement.style.setProperty('--color-primary', savedTheme)
        }
    }, [])

    return (
        <BrowserRouter>
            {/* Update notification (only shows in Electron when update available) */}
            <UpdateNotification />

            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="kassa" element={<Kassa />} />
                    <Route path="warehouse" element={<Warehouse />} />
                    <Route path="inventory-history" element={<InventoryHistory />} />
                    <Route path="recipes" element={<Recipes />} />
                    <Route path="production" element={<Production />} />
                    <Route path="production/operations" element={<ProductionOperations />} />
                    <Route path="distribution" element={<Distribution />} />
                    <Route path="clients" element={<Clients />} />
                    <Route path="finance" element={<Finance />} />
                    <Route path="settings" element={<Settings />} />

                </Route>
            </Routes>
        </BrowserRouter>
    )
}

export default App
