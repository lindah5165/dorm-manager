# Dorm Manager — Starter Website

A responsive front-end prototype built with plain HTML, CSS, and JavaScript.

## Files
- `index.html` — page structure and dialogs
- `style.css` — layout, colors, responsive styles
- `app.js` — navigation and interactive behavior

## Run locally
1. Download or clone this project.
2. Open the folder in Visual Studio Code.
3. Open `index.html` in a browser, or use the VS Code Live Server extension.
4. Changes to the files can be previewed by refreshing the browser.

## Publish with GitHub Pages
1. Create a GitHub repository (for example, `dorm-manager`).
2. Upload `index.html`, `style.css`, `app.js`, and this README to the repository root.
3. In the repository, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Choose the `main` branch and `/ (root)`, then save.
6. Wait for GitHub Pages to publish the site. The Pages section will show the published URL.

## Current prototype behavior
- Sidebar navigation between the main sections
- Tabs within Calendar & Tasks, Household Needs, and Communication
- Add shopping items
- Change the next buyer for a shopping item
- Mark shopping items as purchased (the selected next buyer is recorded as last buyer)
- Add chores, mark chores complete, and randomly reassign pending chores
- Check off moving-in items
- Save a household wishlist URL
- Post announcements and anonymous suggestions
- Send prototype chat messages
- Record household purchases and see totals

## Important limitations
This is a front-end prototype. Data is stored in the browser using `localStorage`, so it is not shared with other roommates or devices. The sample household members and messages are demonstration data. There is no real authentication, server, database, email/SMS delivery, or file upload yet.

For a real multi-user capstone application, the next phase should add a backend API, database, authentication, and household-level permissions. Do not use real personal information in this prototype.
