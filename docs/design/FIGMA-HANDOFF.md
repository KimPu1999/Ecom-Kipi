# Figma Handoff

## File structure

The connected Starter plan supports three pages, so the requested structure is consolidated as:

1. 00 - Cover
2. 01 - Foundations — tokens, component library, and specimen sheet
3. 02 - Screens & Prototype — customer and admin core screens

Components use Auto Layout, semantic names, variants, and token bindings. Screens are composed from component instances rather than detached copies.

## Prototype connections

Home → Products → Product Details → Cart → Checkout → Confirmation. Login → Account. Admin Login → Dashboard → Product Management.

## Developer handoff requirements

Each screen must document frame width, responsive behavior, spacing token, typography token, interaction state, API dependency, empty/error state, and accessibility notes. Exportable assets should use stable names and include a source/usage note.

## Artifact

Editable Figma file: [Kipi E-Commerce Platform Design](https://www.figma.com/design/sGXOgveiRpDlt274j4tHsB).

Created artifacts include the Kipi Tokens collection, Button variants, Input, Product Card, Home, Product Listing, Product Details, Checkout, and Admin Overview frames. Prototype links connect primary actions between core screens.

The Figma MCP Starter-plan rate limit prevented a screenshot-based visual QA pass in this session. Structural metadata was verified; final visual review should be completed in Figma before engineering handoff.
