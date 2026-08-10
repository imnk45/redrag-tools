# REDRAG Tools AI Generator Instructions

**ATTENTION AI AGENT:** If the user has asked you to create a new tool using this template, you must follow the instructions below exactly. This project uses a strict "Shared Component" architecture.

## How to create a new tool

1. **Scaffold:** Duplicate this entire `template/` folder and rename it to the new tool's slug (e.g., `psu-calculator/`).
2. **Registry & Thumbnails:** Open `../shared/data/tools-registry.json` and add a new JSON object for this tool. 
   - Set `"status": "live"` and ensure you include a proper `schema` object.
   - Generate a 16:9 3D-rendered thumbnail image (using AI) and save it in `/assets/images/thumbnails/thumb-[slug].jpg`.
   - Add `"ogImage": "/assets/images/thumbnails/thumb-[slug].jpg"` and `"thumbnail": "/assets/images/thumbnails/thumb-[slug].jpg"` to the registry object.
3. **HTML Setup (`index.html`):**
   - Do **NOT** remove or edit the `<link rel="stylesheet" href="/shared/...">` tags. They load the global design system.
   - Update the `<title>`, `<meta description>`, Open Graph tags, change `noindex, nofollow` back to `index, follow`, and update the JSON-LD schema blocks in the `<head>` with the new tool's details.
   - Design the tool's form inside the `<!-- Left/Main Column: Inputs -->` section. Use `<input class="rt-input">` and `<button class="rt-btn">`.
   - Update the `<!-- Right Column: Results/Sidebar -->` to show the output.
   - **Crucial:** Write a highly detailed, 400+ word SEO article at the bottom inside the `<section class="rt-content-section">`. Include an FAQ and explain the formulas used.
4. **Logic Setup (`tool.js`):**
   - Write the pure calculation logic inside the `calculateResult()` function.
   - Attach event listeners so the result updates in real-time as the user types (no submit buttons needed for basic calculators).
   - Use `RT.components.Toast.show({ message: "Success", type: "success", duration: 3000 })` for notifications (e.g., when the user clicks 'Copy Result').
   - Do **NOT** write any `import` or `require` statements. `RT` is available globally.
5. **Styling (`tool.css`):**
   - Only add CSS here if you cannot achieve the design using the standard utility classes. Keep it under 100 lines.

## Guidelines
- **Premium Aesthetics:** Never use default browser styles. The tool must look modern, dark-themed, and premium.
- **Performance:** Do not add external libraries unless absolutely necessary.
- **Responsive:** The CSS grid handles responsiveness automatically, but ensure inputs and tables scale correctly on mobile.
