# Cinema PDF Parser

A secure, TypeScript-based PDF parser for theatre calendar data with template-based algorithms and intelligent constants management.

## Features

- 🔒 **Security-First Design**: Multi-layer security validation and threat detection
- 📄 **PDF + OCR Processing**: Extract text with Tesseract.js fallback
- 🎭 **Theatre-Specific Templates**: Extensible template system for different theatres
- 🔧 **Intelligent Constants Management**: Auto-discovery and management of curators, formats, series
- 📊 **Structured JSON Output**: Validated, secure output with comprehensive metadata
- 🚀 **High Performance**: Memory-efficient processing with timeout protection
- 🧪 **Comprehensive Testing**: 95%+ coverage with security testing

## Quick Start

### Installation

```bash
# Using Bun (recommended)
bun install cinema-pdf-parser

# Using npm
npm install cinema-pdf-parser

# Using yarn
yarn add cinema-pdf-parser
```

### Basic Usage

```bash
# Parse a Revue Cinema PDF
cinema-parser parse calendar.pdf --template revue-cinema

# Advanced options
cinema-parser parse calendar.pdf \
  --template revue-cinema \
  --output results.json \
  --format json \
  --progress \
  --verbose

# Export to CSV
cinema-parser parse calendar.pdf \
  --template revue-cinema \
  --format csv \
  --output screenings.csv
```

### Programmatic Usage

```typescript
import { CinemaParser } from 'cinema-pdf-parser';
import { ConstantsManager } from 'cinema-pdf-parser/constants';

// Initialize
const constantsManager = new ConstantsManager();
await constantsManager.initialize();

const parser = new CinemaParser(constantsManager);

// Parse PDF
const result = await parser.parsePDF('calendar.pdf', {
  template: 'revue-cinema',
  enableOCR: true,
  strictMode: true
});

if (result.success) {
  console.log('Parsed data:', result.data);
} else {
  console.error('Parsing failed:', result.errors);
}
```

## Supported Theatres

### Currently Supported
- **Revue Cinema** (Toronto, ON) - Complete implementation with curator detection, format recognition, and special event handling

### Adding New Theatres
Extend the template system by creating new theatre-specific configurations:

```typescript
// src/templates/your-theatre/YourTheatreTemplate.ts
export const YOUR_THEATRE_TEMPLATE_CONFIG: YourTheatreTemplateConfig = {
  id: 'your-theatre',
  name: 'Your Theatre Name',
  version: '1.0.0',
  theatreType: TheatreType.INDEPENDENT,
  // ... configuration
};
```

## Output Format

The parser generates structured JSON with comprehensive cinema data:

```json
{
  "metadata": {
    "version": "1.0.0",
    "generatedAt": "2026-02-06T10:30:00.000Z",
    "sourceFile": { "name": "calendar.pdf", "size": 2048576 },
    "parser": { "template": "revue-cinema", "confidence": 0.95 }
  },
  "theatre": {
    "id": "revue_cinema",
    "name": "Revue Cinema",
    "location": { "address": "400 Roncesvalles Ave", "city": "Toronto" }
  },
  "movies": [
    {
      "movie": {
        "title": "The Seven Samurai",
        "year": 1954,
        "director": "Akira Kurosawa"
      },
      "screenings": [
        {
          "date": "2026-02-28",
          "time": "19:30",
          "format": { "id": "35mm", "name": "35mm Film" }
        }
      ],
      "curators": [
        { "id": "sprog", "name": "Sprog" }
      ]
    }
  ]
}
```

## Security Features

- **Input Validation**: Path traversal protection, file type validation, size limits
- **Content Scanning**: Malicious PDF detection, JavaScript filtering, threat identification
- **Resource Protection**: Memory limits, timeout enforcement, DoS prevention
- **Output Sanitization**: XSS prevention, HTML escaping, data validation
- **Audit Logging**: Comprehensive security event tracking

## Configuration

### Environment Variables

```bash
PDF_PARSER_MAX_SIZE=52428800          # Maximum PDF size (50MB)
PDF_PARSER_TIMEOUT=30000               # Processing timeout (30s)
PDF_PARSER_MEMORY_LIMIT=536870912      # Memory limit (512MB)
PDF_PARSER_TEMP_DIR=/tmp/cinema-parser  # Temporary directory
PDF_PARSER_LOG_LEVEL=info              # Logging level
```

### Constants Management

```bash
# List all constants
cinema-parser constants list

# Add new curator
cinema-parser constants add curator --name "John Doe" --collective "Film Collective"

# Export constants
cinema-parser constants export --format json --output constants.json

# Import constants
cinema-parser constants import --file constants.json
```

## Development

### Setup

```bash
# Clone repository
git clone https://github.com/your-org/cinema-pdf-parser.git
cd cinema-pdf-parser

# Install dependencies
bun install

# Run tests
bun run test

# Run with coverage
bun run test:coverage

# Run linting
bun run lint

# Build project
bun run build
```

### Testing

```bash
# Run all tests
bun run test

# Unit tests only
bun run test:unit

# Integration tests
bun run test:integration

# Security tests
bun run test:security

# Performance tests
bun run test:performance

# Watch mode
bun run test:watch
```

### Project Structure

```
cinema-pdf-parser/
├── src/
│   ├── cli/                 # Command-line interface
│   ├── pdf/                 # PDF processing with OCR
│   ├── templates/           # Theatre-specific templates
│   ├── constants/           # Constants management
│   ├── output/              # JSON generation
│   ├── parser/              # Core parsing engine
│   └── types/               # TypeScript definitions
├── test/
│   ├── unit/                # Unit tests
│   ├── integration/         # Integration tests
│   ├── security/            # Security tests
│   ├── performance/         # Performance tests
│   └── fixtures/            # Test data
├── docs/                    # Documentation
└── data/                    # Constants and templates
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes with tests
4. Run tests: `bun run test`
5. Submit a pull request

### Development Guidelines

- Follow TypeScript strict mode
- Maintain 95%+ test coverage
- Add security tests for new features
- Update documentation for API changes
- Use conventional commit messages

## Performance

- **Small PDFs (< 1MB)**: 1-3 seconds
- **Medium PDFs (1-10MB)**: 3-10 seconds  
- **Large PDFs (10-50MB)**: 10-30 seconds
- **Memory Usage**: Typically 50-200MB depending on PDF size
- **OCR Processing**: Additional 5-15 seconds per page

## Security

This application follows security best practices:

- **Input Validation**: All inputs are validated and sanitized
- **Sandboxing**: PDF processing runs in isolated environments
- **Resource Limits**: Configurable limits prevent resource exhaustion
- **Audit Logging**: All security events are logged
- **Regular Updates**: Dependencies are regularly updated for security

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- **Documentation**: [Full documentation](./docs/)
- **Issues**: [GitHub Issues](https://github.com/your-org/cinema-pdf-parser/issues)
- **Security**: Report security issues to security@your-org.com

## Roadmap

- [ ] Additional Theatre Templates
- [ ] Machine Learning OCR Enhancement
- [ ] Web Interface
- [ ] API Server
- [ ] Docker Container
- [ ] Mobile App Support

---

**Built with ❤️ for cinema lovers and film enthusiasts**