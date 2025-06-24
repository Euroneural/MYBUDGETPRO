# Contributing to Budget Pro

Thank you for your interest in contributing to Budget Pro! We appreciate your time and effort in helping us improve this project.

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check [this list](#before-submitting-a-bug-report) as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible.

### Suggesting Enhancements

Enhancement suggestions are tracked as [GitHub issues](https://guides.github.com/features/issues/).

### Your First Code Contribution

Unsure where to begin contributing? You can start by looking through these `good first issue` and `help wanted` issues:

- Good first issues - issues which should only require a few lines of code, and a test or two.
- Help wanted issues - issues which should be a bit more involved than `beginner` issues.

### Pull Requests

1. Fork the repository and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code lints.
6. Issue that pull request!

## Development Setup

### Prerequisites

- Node.js (v16 or later recommended)
- npm (v7 or later) or yarn (v1.22 or later)
- Git

### Installation

1. Fork the repository
2. Clone your fork
   ```bash
   git clone https://github.com/your-username/budget-pro.git
   cd budget-pro
   ```
3. Install dependencies
   ```bash
   npm install
   # or
   yarn
   ```
4. Start the development server
   ```bash
   npm run dev
   # or
   yarn dev
   ```

## Style Guide

### Git Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line
- When only changing documentation, include `[ci skip]` in the commit description

### JavaScript Style Guide

- Follow the [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)
- Use ES6+ features when possible
- Use `const` by default, `let` when necessary, and avoid `var`
- Use template literals for string interpolation
- Use arrow functions for anonymous functions
- Use object destructuring when possible
- Use `===` and `!==` instead of `==` and `!-`

### CSS Style Guide

- Follow the [BEM methodology](http://getbem.com/)
- Use CSS custom properties for theming and variables
- Use CSS Grid and Flexbox for layouts
- Use relative units (rem, em, %) instead of fixed units (px) when possible
- Use CSS modules for component-scoped styles

## License

By contributing, you agree that your contributions will be licensed under its MIT License.
