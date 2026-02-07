# ИНСТРУКЦИИ ПО ЗАПУСКУ

## 1. Настройка Supabase ключей

Откройте файл: `c:\Users\home\Desktop\ice\src\lib\supabase.ts`

Замените строки 4-5:
```typescript
const supabaseUrl = 'YOUR_SUPABASE_URL'
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY'
```

На ваши реальные ключи из Supabase Dashboard.

---

## 2. Установка зависимостей

Откройте PowerShell **от имени администратора** и выполните:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
cd C:\Users\home\Desktop\ice
npm install
```

---

## 3. Запуск приложения

После успешной установки:

```powershell
npm run electron:dev
```

Приложение откроется в Electron окне с включённым hot-reload.

---

## Альтернативные команды

- `npm run dev` - только Vite dev server (без Electron)
- `npm run build` - production сборка
- `npm run electron:build` - сборка Electron приложения для дистрибуции

---

## 4. Запуск через CMD (Командную строку)

Если PowerShell вызывает ошибки с безопасностью, используйте стандартный CMD:

1. Нажмите `Win + R` на клавиатуре
2. Введите `cmd` и нажмите **Enter**
3. Скопируйте и вставьте следующие команды:

```cmd
cd C:\Users\home\Desktop\ice
npm run electron:dev
```
