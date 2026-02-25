# Cinema PDF Parser - Grand Architecture

## Overview
A robust TypeScript/Bun application that parses theatre calendar PDFs and extracts structured movie screening information using template-based algorithms and intelligent constants management.

## System Architecture

### Core Components

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   CLI Module    │───▶│  Parser Engine   │───▶│  Output Module  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Config Mgr    │    │  Template Engine │    │  Constants Mgr  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                               │
                       ┌──────────────────┐
                       │   PDF + OCR      │
                       │   Processor      │
                       └──────────────────┘
```

### Technology Stack

- **Runtime**: Bun 1.0+
- **Language**: TypeScript 5.0+
- **PDF Processing**: pdf-lib + Tesseract.js (OCR)
- **Testing**: Vitest + Testing Library
- **Configuration**: TypeScript interfaces + JSON
- **Constants**: TypeScript enums + JSON persistence

## Security Considerations

### Input Validation
- Strict PDF file type validation
- Template string sanitization
- Path traversal prevention
- File size limits (max 50MB)

### Data Security
- No external API calls without user consent
- Local file processing only
- Secure temporary file handling
- Memory management for large files

### Error Handling
- Graceful degradation for parsing failures
- Input validation with clear error messages
- Secure logging without PII exposure

## Data Flow

1. **Input Processing**
   - Validate PDF file and template
   - Load theatre-specific configuration
   - Initialize parsing context

2. **PDF Processing**
   - Extract raw text using pdf-lib
   - Apply OCR for scanned content
   - Clean and normalize text

3. **Template Application**
   - Match theatre template
   - Apply parsing algorithm
   - Extract structured data

4. **Constants Management**
   - Identify new entities (curators, series, formats)
   - Update constants store automatically
   - Replace with references

5. **Output Generation**
   - Validate extracted data
   - Generate structured JSON
   - Update constants if needed

## Module Specifications

### 1. CLI Module (`src/cli/`)
**Purpose**: Command-line interface and orchestration
**Security**: Input validation, argument sanitization

### 2. PDF Processor (`src/pdf/`)
**Purpose**: Extract text from PDFs with OCR fallback
**Security**: File validation, memory limits

### 3. Template Engine (`src/templates/`)
**Purpose**: Theatre-specific parsing algorithms
**Security**: Template validation, algorithm bounds

### 4. Constants Manager (`src/constants/`)
**Purpose**: Dynamic entity management with persistence
**Security**: Schema validation, data integrity

### 5. Parser Engine (`src/parser/`)
**Purpose**: Core parsing logic and data extraction
**Security**: Input sanitization, output validation

### 6. Output Module (`src/output/`)
**Purpose**: JSON generation and formatting
**Security**: Schema validation, data sanitization

## Data Models

### Core Types
```typescript
interface MovieScreening {
  id: string;
  movie: Movie;
  dateTime: Date;
  curators?: Curator[];
  specialFormat?: SpecialFormat;
  series?: Series;
  collective?: Collective;
}

interface Movie {
  title: string;
  year?: number;
  director?: string;
  runtime?: number;
}

interface Curator {
  id: string;
  name: string;
  collective?: string;
}
```

## Testing Strategy

### Unit Tests
- Individual module functionality
- Parsing algorithms
- Constants management
- Data validation

### Integration Tests
- End-to-end PDF processing
- Template application
- Output generation
- Constants updates

### Security Tests
- Input validation
- File type checking
- Path traversal attempts
- Memory limits

## Performance Considerations

- Streaming PDF processing for large files
- Async OCR processing
- Lazy loading of templates
- Efficient text processing algorithms
- Memory cleanup and garbage collection

## Extensibility

### Adding New Theatres
1. Define TypeScript interface
2. Create parsing algorithm
3. Add template configuration
4. Update constants mapping

### Supporting New Formats
1. Extend data models
2. Update parsing algorithms
3. Modify output schema
4. Update validation rules

## Deployment and Distribution

### Package Structure
```
cinema-pdf-parser/
├── src/
│   ├── cli/
│   ├── pdf/
│   ├── templates/
│   ├── constants/
│   ├── parser/
│   ├── output/
│   └── types/
├── tests/
├── config/
├── data/constants/
└── docs/
```

### Distribution
- Bun package distribution
- Docker container option
- CLI installation via bunx
- npm/bun registry publishing

## Monitoring and Logging

### Structured Logging
- Debug: Processing steps
- Info: Successful operations
- Warn: Parsing anomalies
- Error: Failures and exceptions

### Metrics
- Processing time
- Success/failure rates
- Memory usage
- Constants updates

## Configuration Management

### Environment Variables
- `PDF_PARSER_MAX_SIZE`: Maximum PDF size
- `PDF_PARSER_TEMP_DIR`: Temporary file directory
- `PDF_PARSER_LOG_LEVEL`: Logging verbosity
- `PDF_PARSER_CONSTANTS_PATH`: Constants file path

### Configuration Files
- Theatre templates (TypeScript)
- Constants definitions (JSON)
- Parsing algorithms (TypeScript)

## Error Recovery

### Parsing Failures
- Fallback to basic text extraction
- Partial data extraction when possible
- Detailed error reporting
- Automatic retry with different strategies

### Constants Conflicts
- Merge strategies for duplicates
- Version tracking for updates
- Rollback capabilities
- Conflict resolution protocols

This architecture provides a secure, extensible, and maintainable foundation for parsing theatre calendar PDFs into structured JSON data.