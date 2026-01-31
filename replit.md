# Provocations - Cognitive Musculature Tool

## Overview
Provocations is a cognitive enhancement tool designed to challenge users and enhance critical thinking rather than acting as a traditional AI assistant. The core philosophy: "Would you rather have a tool that thinks for you, or a tool that makes you think?"

## Recent Changes
- January 31, 2026: Added text selection voice merge - select text in document and a floating mic button appears for voice feedback integration
- January 31, 2026: Improved hover highlighting to pinpoint specific text excerpts (not whole paragraphs)
- January 31, 2026: Added voice-driven document enhancement features:
  - Test button with sample text for quick testing
  - Blank Document flow with voice-first entry (large microphone interface)
  - Voice recording on provocation cards using Web Speech API
  - /api/merge endpoint for AI-powered feedback integration
  - Version history tracking with GitHub-style diff comparison view
- January 30, 2026: Added editable document view with pencil/check toggle and download button in ReadingPane
- January 30, 2026: Fixed API response parsing - now correctly calling .json() on fetch responses
- January 29, 2026: Added defensive null-checks throughout components, improved JSON parsing with type guards, added Open Graph meta tags
- January 29, 2026: Fixed refinement feature to show preview and apply to outline sections
- January 29, 2026: Aligned backend validation with shared schemas
- January 29, 2026: Initial MVP implementation with all 5 phases

## Architecture

### Frontend (React + Vite + TypeScript)
- **TextInputForm**: Entry point for pasting source materials
- **LensesPanel**: Customizable perspective views (consumer, executive, technical, financial, strategic, skeptic)
- **ProvocationsDisplay**: AI-generated challenges (opportunities, fallacies, alternatives)
- **OutlineBuilder**: Manual argument construction with AI-assisted expansion
- **DimensionsToolbar**: Text refinement with tone and length controls
- **ReadingPane**: Source material display with lens-filtered views

### Backend (Express + OpenAI)
- `POST /api/analyze` - Analyzes text, generates lenses and provocations
- `POST /api/expand` - Expands outline headings into paragraphs
- `POST /api/refine` - Refines text with tone and length adjustments

### Design System
- Warm intellectual theme with aged paper/ink aesthetic
- Custom fonts: Source Serif 4 (body), Libre Baskerville (headings), JetBrains Mono (code)
- Primary color: Warm amber/copper (#B35C1E)
- Accent color: Thoughtful blue for alternatives
- Dark mode support with inverted warm tones

## Key Design Principles
1. **No Chat Box**: Interface avoids chat-centric design
2. **Productive Resistance**: Tool may not always be "helpful" in traditional sense
3. **Material Engagement**: User remains primary author

## User Flow
1. **Input Phase**: Paste source material (transcripts, reports, notes)
2. **Analysis Phase**: View generated lenses and provocations
3. **Reading Phase**: Deep reading with lens-filtered perspective
4. **Outline Phase**: Manually build argument structure
5. **Refinement Phase**: Adjust tone and length of content

## Tech Stack
- Frontend: React 18, Vite, TailwindCSS, shadcn/ui, TanStack Query
- Backend: Express, OpenAI GPT-5.2
- State: React useState/useCallback (session-based, no persistence)

## Running the Project
```bash
npm run dev
```
Server runs on port 5000 with Vite handling frontend HMR.
