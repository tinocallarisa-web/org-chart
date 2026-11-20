# Org Chart by TCViz

A free org chart for Power BI — every feature, no licence, no limit on people, no watermark. Version 1.1.0.0.

- **Two fields draw it.** Employee ID and Manager ID, any depth. Add name, job title, department, photo and a measure: manager cards show the total of the whole team.
- **Large organisations stay readable.** Opens as many levels as fit, compact layout, search, zoom, minimap, and *Show only this team* with breadcrumb navigation.
- **Real data.** Reporting loops, repeated IDs and missing managers are handled and reported, with the likely cause (a blank Value) and the fix. Vacancies and dotted-line managers.
- **Look.** Report theme and six TCViz collection styles (Boardroom, Ledger, Editorial, Signal, Aurora, Terrace), a colour picker per department, 4.5:1 contrast for card text.
- **Power BI.** Select a person or a whole team, highlighting, bookmarks, report page tooltips, fx on card colour, dynamic format strings, format on the canvas, keyboard navigation, an Accessibility card (high contrast, focus colour and width, minimum text size), 12 languages.
- **Private.** No network access: nothing leaves your report.

**Documentation:** https://tinocallarisa-web.github.io/org-chart/support.html
**Questions:** [Discussions](https://github.com/tinocallarisa-web/org-chart/discussions) · [Issues](https://github.com/tinocallarisa-web/org-chart/issues) · support@tcviz.com

## Build

```
npm install
node build-test.js      # test package with a _test GUID, alongside the AppSource version
```

Requires Node 18+ and powerbi-visuals-tools 7.

© 2026 TCViz
