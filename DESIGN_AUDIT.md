# 🎨 ClaimGuard AI - UI Audit & Design System

## 🔴 CRITICAL ISSUES FOUND:

### 1. **Color Contrast Problems**
- ❌ Dark gray text (#a193b5) on dark purple (#1a1425) = WCAG fail
- ❌ Purple-400 text on purple-900 backgrounds = unreadable
- ✅ FIX: Use white/light colors for text, proper contrast ratios

### 2. **Text Overflow**
- ❌ Long claim IDs breaking layouts
- ❌ Document names without truncate
- ✅ FIX: Add `truncate` class everywhere

### 3. **Spacing Issues**
- ❌ Components too cramped
- ❌ Inconsistent padding
- ✅ FIX: Use consistent spacing scale (4, 6, 8, 12, 16, 24px)

### 4. **Purple Too Harsh**
- ❌ Vibrant purple (#8b5cf6) too bright
- ✅ FIX: Softer lavender/mauve tones

---

## ✅ NEW DESIGN SYSTEM

### Colors (Softer Palette)
```
Background: slate-950 (#020617)
Surface: slate-900 (#0f172a) 
Border: slate-800/30
Text: slate-100 (light)
Muted: slate-400 (medium)

Purple (Soft Lavender):
- 50: #faf5ff
- 100: #f3e8ff
- 200: #e9d5ff  
- 300: #d8b4fe (accents)
- 400: #c084fc (hover states)
- 500: #a855f7 (primary)
- 600: #9333ea (active)
- 700: #7e22ce
- 800: #6b21a8
- 900: #581c87
```

### Typography Scale
- Heading 1: text-3xl font-bold
- Heading 2: text-xl font-semibold
- Body: text-sm
- Small: text-xs
- Tiny: text-[10px]

### Spacing Scale
- xs: p-2 (8px)
- sm: p-3 (12px)
- md: p-4 (16px)  
- lg: p-6 (24px)
- xl: p-8 (32px)

### Components Must Have:
1. White/light text on dark backgrounds
2. Proper hover states (brightness increase)
3. Border radius consistency (rounded-lg, rounded-xl)
4. Shadow for depth (shadow-lg, shadow-xl)
5. Backdrop blur for glassmorphism (backdrop-blur-xl)

---

## 🎯 WHAT TO ADD:

1. **Export functionality** - Download PDF report
2. **Notes/Comments** - Add analyst notes
3. **Action buttons** - Approve/Reject/Flag
4. **Search/Filter** in sidebar
5. **Keyboard shortcuts** - J/K navigation
6. **Print view** - Clean printable format
7. **Dark/Light mode toggle**
8. **Zoom controls** for images
9. **Comparison view** - Side-by-side checks
10. **Status indicators** - Real-time updates
