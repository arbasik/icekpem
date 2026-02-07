// Helper function for countdown timer
function getTimeRemaining(completesAt: string): string {
    const now = new Date().getTime()
    const target = new Date(completesAt).getTime()
    const diff = target - now

    if (diff <= 0) return 'Завершено'

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)

    if (hours > 0) return `${hours}ч ${minutes}м`
    if (minutes > 0) return `${minutes}м ${seconds}с`
    return `${seconds}с`
}
