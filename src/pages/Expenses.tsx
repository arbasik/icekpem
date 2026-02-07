import GlassCard from '../components/GlassCard'

export default function Expenses() {
    return (
        <div className="p-8 space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">Расходы</h1>
                <p className="text-secondary">Управление расходами и затратами</p>
            </div>

            <GlassCard>
                <div className="p-8 text-center">
                    <p className="text-secondary">Раздел в разработке</p>
                </div>
            </GlassCard>
        </div>
    )
}
