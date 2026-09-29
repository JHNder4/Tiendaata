# Tienda Ata — design notes

## Identity and asset status
The text wordmark **Tienda Ata** is used by explicit user approval for this first pass; no logo file exists in the repository. Do not substitute a logo from another ATA-branded business or from ThePoint. Product records in Supabase currently contain demonstration SVG silhouettes, not real product photography. They are retained as temporary placeholders and have not been replaced with unrelated stock or generated images. Upload authentic product photos through the existing admin image editor when available.

## First-pass visual system
- Palette: warm ivory page background, charcoal text, muted olive accents derived from current sample colors; existing red remains for destructive/error states.
- Typography: system-ui stack already used by the storefront; no font dependency added.
- Spacing: 8 px base rhythm; compact mobile controls remain touch-friendly.
- Surfaces: subtle translucent glass limited to navigation, search/filter controls, chips, and gallery/action overlays. Product cards and their images remain matte and readable.
- Shape/elevation: 16 px glass surfaces, 12 px cards, 10–12 px controls; soft edge shadows and fine borders.
- Motion/accessibility: short interaction feedback only; visible focus; reduced-motion and reduced-transparency/fallback rules.

## Protected behavior
Keep existing hash routes, Supabase reads/writes, local cart persistence, sample-order checkout, inventory, login, and admin permissions unchanged.
