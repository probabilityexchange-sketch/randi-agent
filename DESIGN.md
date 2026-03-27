# Randi Agent Platform: Design System (Baseline)

## 🎨 Brand Identity: The "Cyber Employee"
Randi is a high-leverage, crypto-native employee. The design should feel **precise**, **data-dense**, and **trustworthy**. It avoids "bubbly" SaaS aesthetics in favor of a "terminal-plus" look.

## 🌈 Color Palette
| Token | HEX | Usage |
|-------|-----|-------|
| `randi-purple` | #8B5CF6 | Primary Brand / Lead Agent |
| `cyber-green` | #10B981 | Success / Connected / Healthy |
| `warning-amber`| #F59E0B | Partial / Blocked / Insufficient Credits |
| `danger-red`   | #EF4444 | Failed / Offline / Policy Denied |
| `bg-dark`      | #0F172A | Primary Background |
| `bg-surface`   | #1E293B | Card & Component Surfaces |

## 📐 Spacing & Grid
- **Scale:** 4px baseline (4, 8, 12, 16, 24, 32, 48, 64).
- **Radius:** 4px (Sharp) for terminal elements, 8px for standard containers.

## ⌨️ Typography
- **Headings:** Inter or custom sans-serif, Semibold.
- **Data/Status:** Fira Code or similar Monospace for tool outputs and IDs.
- **Body:** Inter, Regular.

## 🔄 Interaction States (The State Matrix)
| State | Visual Indicator | A11y Requirement |
|-------|------------------|------------------|
| **Loading** | Pulsing opacity + "Connecting..." mono text | `aria-busy="true"` |
| **Success** | `cyber-green` border + check icon | Announce "Completed" |
| **Partial** | `warning-amber` dash icon + "Partial" label | Tooltip explaining gap |
| **Error** | `danger-red` X icon + "Action Required" button | Announce "Blocked" |

## 📱 Responsive Principles
- **Desktop:** Multi-column high-density HUD.
- **Mobile:** Single-column "Employee Feed" emphasizing vertical progress and status history.
- **Touch Targets:** 44px minimum for all action buttons.
