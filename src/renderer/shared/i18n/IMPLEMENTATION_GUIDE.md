# Complete i18n Implementation Guide for All Pages

## Overview
This guide covers comprehensive translations for ALL pages in ZEO Studio application.

## Pages Coverage (15 pages)

### 1. BATCH GENERATOR
- ✅ Generate Prompt - PromptGeneratorPage.tsx
- ✅ Generate Video - GenerateVideoPage.tsx  
- ✅ Generate Image - GenerateImagePage.tsx
- ✅ Generate Scene - GenerateScenePage.tsx

### 2. UNIQUE GENERATOR
- ✅ Generate Affiliate - GenerateAffiliatePage.tsx
- ✅ Generate Catalog - GenerateCatalogPage.tsx
- ✅ Generate Poster - GeneratePosterPage.tsx
- ✅ Generate Story - GenerateStoryPage.tsx
- ✅ Generate Story Selling - GenerateStorySellingPage.tsx

### 3. ASSET GENERATOR
- ✅ Generate Character - GenerateCharacterPage.tsx
- ✅ Generate Concept - GenerateConceptPage.tsx
- ✅ Generate Product - GenerateProductPage.tsx

### 4. SETTINGS & OTHERS
- ✅ Settings (Pengaturan) - PengaturanPage.tsx - ALREADY IMPLEMENTED
- ✅ Guide (Panduan) - PanduanPage.tsx
- ✅ Logs - LogsPage.tsx

---

## Translation Structure

All translations are organized in `types.ts` under these main sections:

```typescript
TranslationStrings {
  common          // Common UI elements (buttons, status, etc.)
  loadingScreen   // Loading screen
  login           // Login page - IMPLEMENTED
  settings        // Settings page - IMPLEMENTED
  sidebar         // Sidebar navigation - IMPLEMENTED
  pages           // Page titles
  messages        // Status messages
  configStatus    // Configuration statuses
  buttons         // All buttons
  validation      // Form validation
  activityLog     // Activity logs
  modals          // Modal dialogs
  workflow        // Workflow specific
  
  // PAGE-SPECIFIC SECTIONS (To be expanded)
  promptGenerator // Generate Prompt page
  videoGenerator  // Generate Video page
  imageGenerator  // Generate Image page
  sceneGenerator  // Generate Scene page
  // ... etc for all pages
}
```

---

## Common Patterns to Translate

### 1. Page Headers
```typescript
// Current (hardcoded):
<h1>Generate Prompt</h1>

// Should be:
const { t } = useLanguage();
<h1>{t.pages.generatePrompt}</h1>
```

### 2. Buttons
```typescript
// Current:
<button>Start Generation</button>
<button>Stop</button>
<button>Download</button>

// Should be:
<button>{t.buttons.generate}</button>
<button>{t.buttons.stop}</button>
<button>{t.buttons.download}</button>
```

### 3. Form Labels & Placeholders
```typescript
// Current:
<input placeholder="Enter your prompt..." />
<label>Character Name</label>

// Should be:
<input placeholder={t.promptGenerator.promptPlaceholder} />
<label>{t.promptGenerator.characterNameLabel}</label>
```

### 4. Status Messages
```typescript
// Current:
setStatus('Processing...');
setStatus('Generation complete');
setStatus('Error occurred');

// Should be:
setStatus(t.workflow.status.processing);
setStatus(t.messages.generateSuccess);
setStatus(t.messages.generateError);
```

### 5. Modal Content
```typescript
// Current:
<Modal title="Confirm Generation">
  <p>Are you sure?</p>
</Modal>

// Should be:
<Modal title={t.modals.confirmGeneration.title}>
  <p>{t.modals.confirmGeneration.message}</p>
</Modal>
```

---

## Implementation Steps for Each Page

### Step 1: Import useLanguage hook
```typescript
import { useLanguage } from '../../shared/i18n';

const MyPage = () => {
  const { t } = useLanguage();
  // ... rest of component
};
```

### Step 2: Replace hardcoded text
Search for:
- String literals in JSX: `"Generate"`, `"Start"`, etc.
- Placeholder text
- Button labels
- Error/success messages
- Modal titles and content

### Step 3: Use translation keys
Replace with appropriate `t.*` keys from translation files.

---

## Priority Translation Items

### HIGH PRIORITY (User-facing text)
1. ✅ Page titles and headers
2. ✅ All buttons (Start, Stop, Generate, Download, etc.)
3. ✅ Form labels and placeholders
4. ✅ Status/progress messages
5. ✅ Error and success notifications

### MEDIUM PRIORITY
6. ✅ Section headings
7. ✅ Helper text and tooltips
8. ✅ Modal dialog content
9. ✅ Dropdown options

### LOW PRIORITY (Can defer)
10. Console logs
11. Developer comments
12. Technical error details

---

## Translation File Structure

### en.ts Example
```typescript
export const en: TranslationStrings = {
  // ... existing sections
  
  promptGenerator: {
    title: 'Generate Prompt',
    description: 'Generate creative prompts for your content',
    startButton: 'Start Generation',
    stopButton: 'Stop',
    promptLabel: 'Enter your prompt',
    promptPlaceholder: 'Type your creative idea here...',
    characterLock: 'Lock Character',
    themeStyle: 'Theme & Style',
    // ... more fields
  },
  
  videoGenerator: {
    title: 'Generate Video',
    // ... fields
  },
  
  // ... etc for all pages
};
```

---

## Testing Checklist

For each page, verify:
- [ ] All visible text uses translations
- [ ] Language switching works correctly
- [ ] No hardcoded Indonesian/English text remains
- [ ] Placeholders translate properly
- [ ] Status messages translate
- [ ] Modal dialogs translate
- [ ] Error messages translate

---

## Quick Reference: Translation Keys by Page

### Generate Prompt Page
- `t.pages.promptGenerator`
- `t.promptGenerator.*`
- `t.buttons.generate`, `t.buttons.stop`, `t.buttons.download`
- `t.workflow.status.*`

### Generate Video Page
- `t.pages.generateVideo`
- `t.videoGenerator.*`
- `t.buttons.*`

### Settings Page (Already Done ✅)
- `t.settings.*`
- `t.configStatus.*`

---

## Notes

1. **Consistency**: Use same translation key for same concept across pages
2. **Context**: Some words need different translations based on context
3. **Length**: Consider UI space when translating (some languages are longer)
4. **Testing**: Always test in all 3 languages after implementing

---

## Developer Workflow

1. Open page component
2. Find all hardcoded text
3. Check if translation key exists in types.ts
4. If not, add to types.ts
5. Add translations to en.ts, id.ts, ms.ts
6. Replace hardcoded text with `t.*` in component
7. Test language switching
8. Commit changes

---

## Support

For questions or additions, refer to:
- `src/shared/i18n/README.md` - Main i18n documentation
- `src/shared/i18n/types.ts` - Type definitions
- `src/shared/i18n/languages/en.ts` - English translations (reference)
