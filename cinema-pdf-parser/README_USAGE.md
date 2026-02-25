# Cinema PDF Parser

A secure TypeScript-based PDF parser for theatre calendar data with
template-based algorithms and intelligent constants management.

## Quick Start

```bash
# Using Node.js
npm install
node cli.js path/to/calendar.pdf revue-cinema

# Using Bun (when available)
bun install
node cli.js path/to/calendar.pdf revue-cinema
```

## Features

- 🔒 **Security-First Design**: Multi-layer security validation and threat
  detection
- 📄 **PDF + OCR Processing**: Extract text with fallback OCR support
- 🎭 **Theatre-Specific Templates**: Extensible template system for different
  theatres
- 🔧 **Intelligent Constants Management**: Auto-discovery with encrypted storage
- 📊 **Structured JSON Output**: Validated, secure output with comprehensive
  metadata
- 🚀 **High Performance**: Memory-efficient processing with timeout protection

## Architecture

```
cinema-pdf-parser/
├── src/
│   ├── types/           # TypeScript definitions
│   ├── pdf/             # PDF processing with security
│   ├── templates/       # Theatre-specific templates
│   ├── constants/       # Constants management
│   ├── output/          # JSON generation
│   └── parser/         # Main orchestrator
├── docs/               # Design documentation
├── test/               # Test suite
└── data/               # Constants storage
```

## Supported Theatres

- **Revue Cinema** (Toronto, ON) - Complete implementation with curator
  detection

## Example Usage

```bash
# Parse Revue Cinema PDF
node cli.js "Revue_Calendar_February26-12x18-1.pdf" revue-cinema

# Output JSON with all screening data
node cli.js calendar.pdf revue-cinema --output screenings.json
```

## Security Features

- **Input Validation**: Path traversal protection, file type validation, size
  limits
- **Content Scanning**: JavaScript filtering, malicious pattern detection
- **Resource Protection**: Memory limits, timeout enforcement, DoS prevention
- **Output Sanitization**: XSS prevention, HTML escaping, data validation

## Development

```bash
npm install
npm run build
npm run test
```

Built with ❤️ for cinema lovers and film enthusiasts.
