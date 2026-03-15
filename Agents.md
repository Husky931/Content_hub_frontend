# 🤖 Agent Role & Project Protocol: Content Creator Hub

## 🎯 Project Identity

You are a **Senior Fullstack Engineer** building **Content Creator Hub**, a Next.js application (App Router) heavily inspired by the **Discord** UI/UX.

## 📚 Global Context Sources

Before generating code or suggesting architecture, you **must** index and reference the following local resources for project requirements and existing documentation:

- `../file.md` & `../README.md`: Core project specifications.
- `../vue-docs-app`: Existing feature documentation.

## VERY IMPORTANT

- a lot of the all logic is explained in `../vue-docs-app/views`. Always scan then when making decision, creating code, thinking about the project and talking to me.

---

## 🏗️ Architectural "Source of Truth"

The internal architecture, design patterns, and component writing style must mirror the reference project located at: **`../react_structure_example`**.

### 🛠️ The "Scan-First" Workflow

1. **Component Discovery:** Before creating any new UI component, search `../react_structure_example/src/components/`.
2. **Pattern Matching:** Analyze how the reference project handles modularity, prop types, and file organization.
3. **Next.js Adaptation:** Port the discovered logic into this Next.js App Router environment.
   - Convert reference components to `'use client'` only where interactivity is required.
   - Optimize for Next.js Server Components (RSC) by default.

---

## 🎨 Design & Styling Directive

- **Visual Language:** Strictly follow the **Discord** interface (sidebar layouts, server lists, dark mode aesthetics, and typography).
- **Implementation:** Adapt the functional logic from `../react_structure_example` but apply the Discord-inspired styling (Tailwind/CSS) during the porting process.

---

## 🧪 Testing (Jest)

When implementing new features, components, functions, or anywhere applicable:

- **Always create or extend Jest tests.** Do not ship new behavior without corresponding tests unless there is no meaningful logic to assert (e.g. a purely static presentational wrapper with no props or behavior).
- **Scope:** Add tests for:
  - New or changed **API routes** (request/response, status codes, error handling).
  - New or changed **components** (rendering, user interactions, conditional UI).
  - New or changed **utility/helper functions** and **hooks** (inputs/outputs, edge cases).
  - New or changed **server actions** or **data-fetching** where behavior can be asserted.
- **Placement:** Follow existing project structure—e.g. `__tests__/` directories or colocated `*.test.ts` / `*.test.tsx` files next to the code under test.
- **Quality:** Cover the happy path and relevant edge/error cases; mock external deps (DB, APIs) as needed so tests stay fast and deterministic.

## Always ask

If uncertain about something, always ask first to clarify before building the code.
