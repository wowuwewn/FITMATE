
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

## Final release verification
- Preserve the completed Astra V4 integration. Do not repeat design integration.
- Start with `npm run test:smoke`: real catalog selection, P02+M02=88/R06,
  P02 to P01=100, saved combination reload, offline rule explanations,
  mobile gestures and mobile/desktop layout.
- For a deployed app set `PLAYWRIGHT_BASE_URL` to its verified production URL.
- Run build and lint once after edits, plus tests directly related to changes.
  Repeat only failed checks after fixes. Expand to the full suite only for
  changes to the analysis engine, scoring, shared state or unresolved regressions.
- Store all new recordings, rendered videos and release QA in `artifacts/`.
  Keep them outside `public/` and `src/`; `.vercelignore` excludes them.
- Original design assets and prototypes belong in `docs/` or `prototypes/`;
  preserve them without shipping unused originals in `public/`.
