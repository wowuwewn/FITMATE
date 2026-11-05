
# FITMATE — Development Guidelines

## Project
Fitmate is a mobile-first supplement combination
analysis application.

Source of truth:
- docs/PRD.md
- src/data

Follow the PRD. Do not invent new product requirements.

## Design Direction
Create a premium consumer fitness and supplement app.

Avoid generic AI-generated dashboard aesthetics.

Do NOT use:
- Generic SaaS dashboard layouts
- Repetitive rounded KPI cards
- Purple/blue gradient backgrounds
- Excessive glassmorphism
- Random decorative icons
- Unnecessary charts or fake statistics

Prioritize:
- Strong editorial typography
- Sophisticated spacing and composition
- High-quality product presentation
- Intentional visual hierarchy
- Distinctive brand identity
- Mobile-first UX
- Responsive layouts

## Interaction & Motion
Use meaningful micro-interactions and motion.

Prioritize:
1. Product selection and cart interactions
2. Supplement combination analysis sequence
3. Animated score transitions
4. Product replacement and optimization feedback

Animations should communicate changes,
not merely decorate the interface.

Respect prefers-reduced-motion.

## Technology
- React + TypeScript + Vite
- Tailwind CSS when needed
- Motion for React
- Local JSON data
- localStorage for demo persistence

Do not introduce a backend, database, or
authentication system without approval.

## Data Integrity
- Preserve existing JSON files.
- Never fabricate clinical evidence.
- Do not invent ingredient quantities.
- Do not invent scoring rules.
- Missing data must remain explicitly unknown.
- A combination score is not a medical safety rating.
- Show evidence and limitations for health-related claims.

## Development Workflow
1. Read the PRD and available data.
2. Explain the implementation approach.
3. Plan UI/UX before writing major UI code.
4. Implement one screen or feature at a time.
5. Review the rendered result in a browser.
6. Test responsive behavior and interactions.
7. Fix visual inconsistencies before proceeding.

Do not generate the entire application at once.
