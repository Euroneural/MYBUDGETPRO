# Budget Pro - Personal Finance Manager

A modern, responsive, and feature-rich personal finance management application that helps you track your income, expenses, and budget effectively.

## Features

- 💰 Track income and expenses
- 📊 View spending analytics and reports
- 📅 Transaction calendar view
- 🔍 Advanced search and filtering
- 📱 Progressive Web App (PWA) support
- 🔒 Local data storage (IndexedDB)
- 🎨 Clean and intuitive UI
- 🌓 Light/Dark mode (coming soon)

## Project Structure

```
src/
├── index.html              # Main HTML file
├── app.js                  # Main application entry point
├── local-db.js             # Database module
├── sw.js                   # Service Worker
├── manifest.json           # PWA manifest
├── favicon.ico             # App icon
├── styles/
│   ├── original.css      # Main stylesheet
│   └── main.css           # Additional styles (legacy)
└── modules/
    ├── search/           # Search functionality
    │   └── SearchManager.js
    ├── transactions/      # Transactions management
    │   └── transactions.js
    ├── budget/           # Budget management
    ├── reports/          # Reports and analytics
    └── utils/            # Utility functions
    ├── ui/                # Reusable UI components
    └── utils/             # Utility functions
        └── helpers.js
```

## Features

- **Transaction Management**: Add, edit, delete, and categorize transactions
- **Budget Tracking**: Set and track budget categories
- **Search & Filter**: Powerful search across transactions
- **Reports**: Visualize spending with charts and reports
- **Offline-First**: Works offline with IndexedDB
- **Responsive Design**: Works on desktop and mobile devices

## Getting Started

1. Clone the repository
2. Open `index.html` in a modern web browser
3. Start adding transactions and managing your budget

## Development

### Prerequisites

- Modern web browser with ES6+ support
- (Optional) Local web server for development (e.g., Live Server in VS Code)

### Running Locally

1. Clone the repository
2. Install a local web server if needed:
   ```
   npm install -g live-server
   ```
3. Start the web server:
   ```
   live-server src
   ```
4. Open `http://localhost:8080` in your browser

## Data Storage

The application uses IndexedDB for client-side storage. All data is stored locally in the user's browser.

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

MIT
