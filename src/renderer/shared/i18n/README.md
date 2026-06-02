# 🌍 ZEO Studio Internationalization (i18n) System

Complete guide for using the multi-language system in ZEO Studio.

## 📋 Table of Contents
1. [Quick Start](#quick-start)
2. [Available Languages](#available-languages)
3. [Translation Structure](#translation-structure)
4. [Usage in Components](#usage-in-components)
5. [Adding New Languages](#adding-new-languages)
6. [Adding New Translations](#adding-new-translations)
7. [Best Practices](#best-practices)

---

## 🚀 Quick Start

### Using Translations in Your Component

```tsx
import { useLanguage } from '../../shared/i18n';

const MyComponent = () => {
  const { t, language, setLanguage } = useLanguage();
  
  return (
    <div>
      <h1>{t.pages.settings}</h1>
      <button>{t.buttons.save}</button>
      <p>{t.messages.saveSuccess}</p>
    </div>
  );
};
```

### Current Language

```tsx
const { language } = useLanguage(); // 'en' | 'id' | 'ms'
```

---

## 🌐 Available Languages

| Code | Language | Native Name |
|------|----------|-------------|
| `en` | English | English (DEFAULT) |
| `id` | Indonesian | Bahasa Indonesia |
| `ms` | Malay | Bahasa Melayu |

---

## 📝 Translation Structure

### Complete Translation Categories

```typescript
TranslationStrings {
  common          // Common UI words (20+ items)
  loadingScreen   // Loading screen texts
  login           // Login page texts
  settings        // Settings page (5 subsections)
  sidebar         // Sidebar navigation
  pages           // All page names
  messages        // Status messages
  configStatus    // Configuration statuses
  buttons         // UI buttons (14 items)
  validation      // Form validation messages
  activityLog     // Activity log items
  modals          // Modal dialog texts
  workflow        // Workflow specific texts
}
```

### Example: Buttons Section

```typescript
// English (en.ts)
buttons: {
  save: 'Save',
  reset: 'Reset',
  cancel: 'Cancel',
  confirm: 'Confirm',
  delete: 'Delete',
  download: 'Download',
  upload: 'Upload',
  generate: 'Generate',
  regenerate: 'Regenerate',
  edit: 'Edit',
  close: 'Close',
  showDetails: 'Show Details',
  hideDetails: 'Hide Details',
  selectFile: 'Select File',
  selectFolder: 'Select Folder',
  clearAll: 'Clear All',
  testConfiguration: 'Test Configuration',
}
```

---

## 💻 Usage in Components

### 1. Basic Usage

```tsx
import { useLanguage } from '../../shared/i18n';

const MyPage = () => {
  const { t } = useLanguage();
  
  return (
    <div>
      <h1>{t.settings.title}</h1>
      <p>{t.settings.description}</p>
      <button>{t.buttons.save}</button>
    </div>
  );
};
```

### 2. With State Management

```tsx
const MyComponent = () => {
  const { t, language } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  
  return (
    <div>
      {isLoading ? t.common.loading : t.common.success}
    </div>
  );
};
```

### 3. In Activity Logs

```tsx
const addLog = (type: 'INFO' | 'SUCCESS' | 'ERROR', message: string) => {
  const { t } = useLanguage();
  
  setLogs(prev => [...prev, {
    type: t.activityLog[type.toLowerCase()],
    message,
    timestamp: new Date().toISOString()
  }]);
};
```

### 4. In Modal Dialogs

```tsx
<Modal
  title={t.modals.confirmDelete.title}
  message={t.modals.confirmDelete.message}
  confirmButtonText={t.modals.confirmDelete.confirm}
  cancelButtonText={t.modals.confirmDelete.cancel}
/>
```

### 5. Dynamic Translations

```tsx
const statusText = {
  ready: t.workflow.status.ready,
  processing: t.workflow.status.processing,
  completed: t.workflow.status.completed,
  failed: t.workflow.status.failed,
}[currentStatus];
```

---

## 🆕 Adding New Languages

### Step 1: Update `types.ts`

```typescript
// src/shared/i18n/types.ts
export type LanguageCode = 'en' | 'id' | 'ms' | 'fr'; // Add 'fr'
```

### Step 2: Create New Language File

```bash
# Copy English template
cp src/shared/i18n/languages/en.ts src/shared/i18n/languages/fr.ts
```

### Step 3: Translate All Strings

```typescript
// src/shared/i18n/languages/fr.ts
import { TranslationStrings } from '../types';

export const fr: TranslationStrings = {
  common: {
    loading: 'Chargement...',
    save: 'Enregistrer',
    // ... translate all strings
  },
  // ... translate all sections
};
```

### Step 4: Register Language

```typescript
// src/shared/i18n/languages/index.ts
import { fr } from './fr';

export const translations: Record<LanguageCode, TranslationStrings> = {
  en,
  id,
  ms,
  fr, // Add here
};

export { en, id, ms, fr };
```

### Step 5: Update Language Selector

```tsx
// src/pages/Pengaturan/PengaturanPage.tsx
<select>
  <option value="en">English (English)</option>
  <option value="id">Indonesian (Bahasa Indonesia)</option>
  <option value="ms">Malay (Bahasa Melayu)</option>
  <option value="fr">French (Français)</option>
</select>
```

✅ **Done!** Your new language is ready to use.

---

## ➕ Adding New Translations

When adding new text to the application:

### Step 1: Update `types.ts`

```typescript
// Add new translation key
export interface TranslationStrings {
  // ... existing
  
  myNewSection: {
    title: string;
    description: string;
  };
}
```

### Step 2: Add to ALL Language Files

**English (en.ts):**
```typescript
myNewSection: {
  title: 'My New Section',
  description: 'This is a new section',
}
```

**Indonesian (id.ts):**
```typescript
myNewSection: {
  title: 'Bagian Baru Saya',
  description: 'Ini adalah bagian baru',
}
```

**Malay (ms.ts):**
```typescript
myNewSection: {
  title: 'Bahagian Baru Saya',
  description: 'Ini adalah bahagian baru',
}
```

### Step 3: Use in Component

```tsx
const { t } = useLanguage();
<h1>{t.myNewSection.title}</h1>
```

⚠️ **Important:** TypeScript will error if you forget to add translations to any language file!

---

## 🎯 Best Practices

### DO ✅

1. **Always use translations for user-facing text**
   ```tsx
   // ✅ Good
   <button>{t.buttons.save}</button>
   
   // ❌ Bad
   <button>Save</button>
   ```

2. **Use semantic keys**
   ```tsx
   // ✅ Good
   {t.messages.saveSuccess}
   
   // ❌ Bad
   {t.msg1}
   ```

3. **Group related translations**
   ```typescript
   settings: {
     workflow: { ... },
     bearer: { ... },
     folder: { ... },
   }
   ```

4. **Keep translations consistent**
   - Use same terms across the app
   - Follow naming conventions
   - Maintain tone and style

### DON'T ❌

1. **Don't hardcode strings**
   ```tsx
   // ❌ Never do this
   <button>Simpan</button>
   ```

2. **Don't skip translation files**
   - Every translation must exist in ALL language files
   - TypeScript will catch missing translations

3. **Don't use inline translations**
   ```tsx
   // ❌ Bad
   const text = language === 'en' ? 'Save' : 'Simpan';
   
   // ✅ Good
   const text = t.buttons.save;
   ```

---

## 🔄 Language Switching

Language changes are **immediate** and affect:
- ✅ All UI texts
- ✅ Buttons and labels
- ✅ Error messages
- ✅ Activity logs
- ✅ Modal dialogs
- ✅ Form placeholders
- ✅ Status messages

Language preference is **automatically saved** to `localStorage`.

---

## 📦 File Structure

```
src/shared/i18n/
├── types.ts                    # Type definitions
├── index.ts                    # Main exports
├── LanguageContext.tsx         # Provider & hook
└── languages/
    ├── index.ts                # Translations registry
    ├── en.ts                   # 🇬🇧 English (DEFAULT)
    ├── id.ts                   # 🇮🇩 Indonesian
    └── ms.ts                   # 🇲🇾 Malay
```

---

## 🎓 Examples

### Complete Component Example

```tsx
import React, { useState } from 'react';
import { useLanguage } from '../../shared/i18n';

const MyFeaturePage: React.FC = () => {
  const { t, language } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  
  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Save logic
      alert(t.messages.saveSuccess);
    } catch (error) {
      alert(t.messages.saveError);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div>
      <h1>{t.pages.myFeature}</h1>
      <p>{t.common.loading}: {isLoading ? 'Yes' : 'No'}</p>
      
      <button onClick={handleSave} disabled={isLoading}>
        {isLoading ? t.common.loading : t.buttons.save}
      </button>
      
      <button>{t.buttons.reset}</button>
      <button>{t.buttons.cancel}</button>
      
      <p>{t.validation.required}</p>
      
      <select>
        <option value="en">English</option>
        <option value="id">Indonesian</option>
      </select>
      
      <div>
        Current Language: {language}
      </div>
    </div>
  );
};

export default MyFeaturePage;
```

---

## 📞 Support

For questions or issues with the i18n system, contact the development team.

**Happy Translating! 🌍**
