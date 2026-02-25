# Conscious Compass Style Guide

## Brand Colors

### Primary Palette

| Color | Hex | CSS Variable | Usage |
|-------|-----|--------------|-------|
| **Chartreuse Yellow** | `#E8FF00` | `--antenna-yellow` | Primary buttons, accents, highlights |
| **Yellow Dark** | `#D4E800` | `--antenna-yellow-dark` | Button hover states |
| **Antenna Red** | `#E53935` | `--antenna-red` | Secondary accent, badges, alerts, links |
| **Black** | `#1A1A1A` | `--antenna-black` | Primary text, headings |

### Neutral Palette

| Color | Hex | CSS Variable | Usage |
|-------|-----|--------------|-------|
| **Dark Gray** | `#333333` | `--antenna-dark-gray` | Body text |
| **Gray** | `#666666` | `--antenna-gray` | Secondary text, labels |
| **Light Gray** | `#E8E6E1` | `--antenna-light-gray` | Page backgrounds |
| **Cream** | `#F0EEEA` | `--antenna-cream` | Card backgrounds, highlights |
| **Sand** | `#D9D6D0` | `--antenna-sand` | Borders, dividers |
| **Off-White** | `#FAF9F7` | - | Alternative backgrounds |

### Semantic Colors

| Purpose | Color | Hex |
|---------|-------|-----|
| Success | Green | `#059669` / `#10B981` |
| Error | Red | `#DC2626` |
| Warning | Amber | `#F59E0B` |
| Info | Blue | `#3B82F6` |

---

## Typography

### Font Family

```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
```

**Import:**
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```

### Font Weights

| Weight | Usage |
|--------|-------|
| 300 | Light text (rarely used) |
| 400 | Body text |
| 500 | Labels, secondary headings |
| 600 | Headings, buttons |
| 700 | Bold emphasis |

### Type Scale (Tailwind)

| Element | Class | Size |
|---------|-------|------|
| Page Title | `text-2xl font-bold` | 24px |
| Section Title | `text-xl font-semibold` | 20px |
| Card Title | `text-lg font-semibold` | 18px |
| Subsection | `text-sm font-medium` | 14px |
| Body | `text-sm` | 14px |
| Caption | `text-xs` | 12px |
| Tiny | `text-[10px]` | 10px |

### Line Height

```css
body { line-height: 1.6; }
h1, h2, h3, h4 { line-height: 1.2; }
```

---

## Buttons

### Primary Button (Yellow)

```css
.btn-primary {
  background: #E8FF00;
  color: #1A1A1A;
  font-weight: 600;
  padding: 14px 28px;
  border-radius: 0;
  border: none;
  font-size: 15px;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
```

**Tailwind equivalent:**
```html
<button class="bg-[#E8FF00] text-[#1A1A1A] font-semibold py-3.5 px-7 uppercase text-sm tracking-wide">
  Button Text
</button>
```

### Secondary Button (Outlined)

```css
.btn-secondary {
  background: white;
  color: #1A1A1A;
  font-weight: 500;
  padding: 14px 28px;
  border-radius: 0;
  border: 1px solid #1A1A1A;
  font-size: 15px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
```

### Small Buttons (Tags/Actions)

```html
<!-- Red accent button -->
<button class="px-3 py-1.5 bg-[#E53935] text-white text-xs font-medium rounded-lg">
  Action
</button>

<!-- Outlined small button -->
<button class="px-3 py-1.5 border border-[#D9D6D0] text-[#666666] text-xs rounded-lg hover:border-[#1A1A1A]">
  Secondary
</button>
```

### Button States

| State | Primary | Secondary |
|-------|---------|-----------|
| Default | `bg-[#E8FF00]` | `bg-white border-[#1A1A1A]` |
| Hover | `bg-[#D4E800]` | `bg-[#E8FF00] border-[#E8FF00]` |
| Disabled | `bg-[#CCCCCC] text-[#888888]` | `opacity-50` |

---

## Cards

### Base Card

```css
.card {
  background: white;
  border-radius: 0;
  border: 1px solid #D9D6D0;
  box-shadow: none;
}
```

**Tailwind:**
```html
<div class="card p-5">
  <!-- Content -->
</div>
```

### Card with Accent

```html
<!-- Left border accent -->
<div class="card p-4 border-l-4 border-[#3B82F6]">
  <!-- Content -->
</div>

<!-- Top border accent -->
<div class="card p-4 border-t-4 border-[#E53935]">
  <!-- Content -->
</div>
```

### Highlighted Card

```html
<div class="card p-4 bg-[#F0EEEA]">
  <!-- Content -->
</div>
```

---

## Form Elements

### Text Input

```html
<input 
  type="text"
  class="w-full px-4 py-3 border border-[#D9D6D0] rounded-lg bg-white"
  placeholder="Enter text..."
/>
```

### Textarea

```html
<textarea 
  class="w-full h-24 px-4 py-3 border border-[#D9D6D0] rounded-lg bg-white resize-none"
  placeholder="Enter description..."
></textarea>
```

### Select

```html
<select class="w-full px-4 py-3 border border-[#D9D6D0] rounded-lg bg-white">
  <option value="">Select an option</option>
</select>
```

### Focus States

```css
input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: #1A1A1A;
}
```

### Labels

```html
<label class="block text-sm font-medium text-[#1A1A1A] mb-2">
  Label Text
</label>
```

---

## Tags & Badges

### Attribute Tags (Small)

```html
<span class="text-[10px] px-1.5 py-0.5 bg-[#E53935]/10 text-[#E53935] rounded-full">
  AWAKE
</span>
```

### Status Badges

```html
<!-- Success -->
<span class="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
  Complete
</span>

<!-- Warning -->
<span class="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
  Pending
</span>

<!-- Admin -->
<span class="text-xs px-2 py-0.5 bg-[#E53935] text-white rounded-full">
  Admin
</span>
```

### Numbered Badges

```html
<!-- Solid -->
<div class="w-6 h-6 rounded-full bg-[#E53935] text-white flex items-center justify-center font-bold text-xs">
  1
</div>

<!-- Light -->
<div class="w-6 h-6 rounded-full bg-[#E53935]/20 text-[#E53935] flex items-center justify-center font-bold text-xs">
  7
</div>
```

---

## Layout

### Page Container

```html
<div class="min-h-screen bg-[#E8E6E1]">
  <!-- Header -->
  <header class="bg-[#E8E6E1] border-b border-[#D9D6D0] py-5 px-6">
    ...
  </header>
  
  <!-- Main Content -->
  <main class="max-w-4xl mx-auto p-8">
    ...
  </main>
</div>
```

### Grid Layouts

```html
<!-- Two column -->
<div class="grid md:grid-cols-2 gap-4">
  ...
</div>

<!-- Three column -->
<div class="grid md:grid-cols-3 gap-4">
  ...
</div>
```

### Spacing Scale

| Size | Tailwind | Pixels |
|------|----------|--------|
| xs | `p-2` | 8px |
| sm | `p-3` | 12px |
| md | `p-4` | 16px |
| lg | `p-5` | 20px |
| xl | `p-6` | 24px |
| 2xl | `p-8` | 32px |

---

## Accordions

### Accordion Header

```html
<button class="w-full flex items-center justify-between p-4 bg-[#F0EEEA] rounded-t-lg border border-[#E8E6E1]">
  <div class="flex items-center gap-3">
    <Icon class="w-5 h-5 text-[#E53935]" />
    <span class="font-medium text-[#1A1A1A]">Section Title</span>
  </div>
  <ChevronDown class="w-5 h-5 text-[#666666]" />
</button>
```

### Accordion Content

```html
<div class="border border-t-0 border-[#E8E6E1] rounded-b-lg p-4 bg-white">
  <!-- Content -->
</div>
```

---

## Alerts & Messages

### Error

```html
<div class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
  Error message here
</div>
```

### Warning

```html
<div class="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm flex items-center gap-2">
  <AlertCircle class="w-5 h-5" />
  Warning message here
</div>
```

### Success

```html
<div class="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700 text-sm">
  ✓ Success message here
</div>
```

### Info Box

```html
<div class="bg-[#F0EEEA] rounded-lg p-4">
  <p class="text-xs text-[#666666]">Helper text</p>
</div>
```

---

## Animations

### Fade In

```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-fade-in { 
  animation: fadeIn 0.4s ease-out forwards; 
}
```

### Spin (Loading)

```html
<Loader2 class="w-4 h-4 animate-spin" />
```

### Hover Transitions

```css
transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
```

**Tailwind:**
```html
<element class="transition-colors">
```

---

## Icons

Using **Lucide React** icons:

```javascript
import { 
  Compass, ArrowRight, ArrowLeft, Globe, Users, Bot, 
  Newspaper, BarChart3, FileText, Play, Check, Loader2, 
  ChevronDown, Download, Save, Plus, Trash2, X, Upload, 
  Image, ExternalLink, Share2, Copy, LogOut, Shield, 
  UserCheck, UserX, TrendingUp, TrendingDown, Star, 
  Lightbulb, Sparkles, AlertCircle, Target, Search, Filter 
} from 'lucide-react';
```

### Icon Sizes

| Size | Class | Usage |
|------|-------|-------|
| Small | `w-3 h-3` | Inline with text |
| Default | `w-4 h-4` | Buttons |
| Medium | `w-5 h-5` | Headers, accents |
| Large | `w-6 h-6` | Feature icons |

---

## External Link Buttons

### Platform Buttons

```html
<!-- Meta (Blue) -->
<a href="..." class="px-2 py-1.5 bg-[#1877F2] text-white text-xs font-medium rounded-lg hover:bg-[#166FE5] flex items-center gap-1">
  <span>Meta</span> <ExternalLink class="w-3 h-3" />
</a>

<!-- Google (Blue) -->
<a href="..." class="px-2 py-1.5 bg-[#4285F4] text-white text-xs font-medium rounded-lg hover:bg-[#3367D6] flex items-center gap-1">
  <span>Google</span> <ExternalLink class="w-3 h-3" />
</a>

<!-- LinkedIn (Blue) -->
<a href="..." class="px-2 py-1.5 bg-[#0A66C2] text-white text-xs font-medium rounded-lg hover:bg-[#004182] flex items-center gap-1">
  <span>LinkedIn</span> <ExternalLink class="w-3 h-3" />
</a>

<!-- TikTok (Black) -->
<a href="..." class="px-2 py-1.5 bg-black text-white text-xs font-medium rounded-lg hover:bg-gray-800 flex items-center gap-1">
  <span>TikTok</span> <ExternalLink class="w-3 h-3" />
</a>

<!-- Instagram (Gradient) -->
<a href="..." class="px-2 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-medium rounded-lg flex items-center gap-1">
  <span>Instagram</span> <ExternalLink class="w-3 h-3" />
</a>
```

---

## Upload Areas

### Dashed Upload Box

```html
<button class="h-40 border-2 border-dashed border-[#E53935] rounded-lg flex flex-col items-center justify-center gap-2 hover:bg-[#E53935]/5 transition-colors">
  <Upload class="w-6 h-6 text-[#E53935]" />
  <span class="text-sm text-[#E53935] font-medium">Add Screenshot</span>
  <span class="text-xs text-[#666666]">3 remaining</span>
</button>
```

---

## Mobile Responsiveness

### Breakpoints (Tailwind)

| Prefix | Min Width |
|--------|-----------|
| `sm:` | 640px |
| `md:` | 768px |
| `lg:` | 1024px |
| `xl:` | 1280px |

### Mobile Optimizations

```css
@media (max-width: 768px) {
  .btn-primary, .btn-secondary {
    padding: 12px 20px;
    font-size: 14px;
  }
  
  .card { border-radius: 8px; }
  
  input, select, textarea {
    font-size: 16px; /* Prevents zoom on iOS */
  }
}
```

---

## CSS Variables Quick Reference

```css
:root {
  --antenna-yellow: #E8FF00;
  --antenna-yellow-dark: #D4E800;
  --antenna-red: #E53935;
  --antenna-black: #1A1A1A;
  --antenna-dark-gray: #333333;
  --antenna-gray: #666666;
  --antenna-light-gray: #E8E6E1;
  --antenna-cream: #F0EEEA;
  --antenna-sand: #D9D6D0;
}
```

---

## Tailwind Color Reference

For use in Tailwind classes:

| Variable | Tailwind Class |
|----------|----------------|
| Yellow | `bg-[#E8FF00]` `text-[#E8FF00]` |
| Red | `bg-[#E53935]` `text-[#E53935]` |
| Black | `bg-[#1A1A1A]` `text-[#1A1A1A]` |
| Gray | `text-[#666666]` |
| Light Gray | `bg-[#E8E6E1]` |
| Cream | `bg-[#F0EEEA]` |
| Sand | `border-[#D9D6D0]` |
| Off-White | `bg-[#FAF9F7]` |
