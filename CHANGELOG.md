# Changelog

## 1.1.0.0 — November 2026

- **Team total on manager cards.** A manager's card now shows the total of the whole team (the manager plus everyone below) in Value. In 1.0 it showed the manager's own value, so a manager who does not sell appeared empty or with 0. The tooltip still gives both: the person's own value and "Value · team".
- **Missing managers explained.** The warning for Manager IDs that are not among the Employee IDs now gives the likely cause: when Value is blank for a manager, Power BI leaves that row out. Fix: add a measure that is never blank (for example a count of rows) to Tooltips.
- **Style template:** Report theme (the default, formerly Clean: it now takes the ink and the department colours from the report theme unless you picked a palette) plus six TCViz collection styles — Boardroom, Ledger, Editorial, Signal, Aurora, Terrace — each with its own background, ink and department palette. The 1.0 templates (None, Corporate, Colorful, Minimal, Compact) leave the dropdown; reports saved with them keep their look. Anything set by hand in the Format pane wins over the style.
- **Report theme palette** in Colors → Palette.
- **Department colors** card: one colour picker per department (up to 60), which wins over the palette and the style.
- **Accessibility** card: High contrast (Automatic, following Windows, or On: black on white), Focus color, Focus width and Minimum text size (cards grow taller when the minimum size does not fit).
- **Dynamic format strings:** when every row of a measure shares one format string, it is used on cards, line labels and tooltips; otherwise the column's format.
- **Readable card text:** name and text keep at least 4.5:1 contrast on any fill (tint, fx, colour value, department colour); the tint is mixed with the style's card colour; initials turn dark on light circles.
- **Texts drawn by the visual** (toolbar, warnings, card footer, start page) are translated in Power BI Desktop in the 12 languages; in 1.0 they appeared in English there.
- "Edit interactions" is respected (allowInteractions read from the host capabilities). npm audit: 0 vulnerabilities.

## 1.0.0.0 — October 2026

First release.

- Employee ID + Manager ID, any depth, several tops; name, job title, department, photo (Base64), value, colour value, tooltips.
- Dotted-line managers (second dashed set of links); vacancies from rows without a name.
- Open levels to fit (readable names), collapse/expand, compact layout, search, zoom, fit, minimap, Show only this team with breadcrumb.
- Reporting loops, repeated IDs and missing managers handled and reported (warning icon).
- 5 style templates; colour by department, level, value or single; tinted cards; department groups; elbow/straight/curved lines with labels.
- Selection of a person or whole team, Ctrl+click, highlighting, bookmarks (selection restored, branches opened), tooltips and report page tooltips, context menu, fx on card colour, on-object formatting, number formats, fetchMoreData past 30,000 rows.
- View state (open branches, focus) kept through filters and refreshes via persistProperties.
- Keyboard tree navigation, ARIA tree, high contrast. Format pane in 12 languages.
