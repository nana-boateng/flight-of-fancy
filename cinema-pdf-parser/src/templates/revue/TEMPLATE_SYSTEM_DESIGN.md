# Cinema Parser Template System Design

## Executive Summary

This document defines a secure, type-safe template system for the cinema PDF parser that enables theatre-specific parsing algorithms while maintaining strict security controls and extensibility for new theatres. The system uses TypeScript interfaces for compile-time safety, runtime validation for security, and modular architecture for maintainability.

## 1. Template System Architecture

### 1.1 Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Template System                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Template      │  │   Template      │  │   Template      │ │
│  │   Registry      │  │   Validator     │  │   Loader        │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│           │                     │                     │         │
│           └─────────────────────┼─────────────────────┘         │
│                                 ▼                               │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              Security & Type Safety Layer                  │ │
│  │  - Schema Validation  - Template Sandbox  - Error Handling │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                 ▼                               │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │           Theatre-Specific Algorithm Modules               │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  │  Revue      │  │  Fox        │  │  TIFF              │  │
│  │  │  Cinema     │  │  Theatre    │  │  (Future)          │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 2. TypeScript Interface Definitions

### 2.1 Core Template Interfaces

```typescript
// src/templates/types.ts

/**
 * Base template configuration interface
 */
export interface BaseTemplateConfig {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly theatreType: TheatreType;
  readonly security: SecurityConfig;
  readonly validation: ValidationConfig;
  readonly algorithm: AlgorithmConfig;
}

/**
 * Theatre classification
 */
export enum TheatreType {
  INDEPENDENT = 'independent',
  CHAIN = 'chain',
  FESTIVAL = 'festival',
  POPUP = 'popup'
}

/**
 * Security configuration for templates
 */
export interface SecurityConfig {
  readonly maxExecutionTimeMs: number;
  readonly maxMemoryMB: number;
  readonly allowedOperations: SecurityOperation[];
  readonly regexPatterns: RegexSecurityConfig;
  readonly fileSystemAccess: FileSystemSecurityConfig;
}

export enum SecurityOperation {
  TEXT_EXTRACTION = 'text_extraction',
  REGEX_MATCH = 'regex_match',
  DATE_PARSING = 'date_parsing',
  STRING_MANIPULATION = 'string_manipulation'
}

export interface RegexSecurityConfig {
  readonly maxComplexity: number; // Regex complexity score
  readonly timeoutMs: number;
  readonly forbiddenPatterns: string[];
  readonly maxBacktracking: number;
}

export interface FileSystemSecurityConfig {
  readonly allowTempFiles: boolean;
  readonly maxTempFileSize: number;
  readonly allowedDirectories: readonly string[];
  readonly sandboxEnabled: boolean;
}

/**
 * Validation configuration
 */
export interface ValidationConfig {
  readonly requiredFields: readonly string[];
  readonly fieldValidators: Record<string, FieldValidator>;
  readonly outputSchema: OutputSchema;
  readonly strictMode: boolean;
}

export interface FieldValidator {
  readonly type: ValidationType;
  readonly required: boolean;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
  readonly customValidator?: string; // Reference to validation function
}

export enum ValidationType {
  STRING = 'string',
  DATE = 'date',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  ARRAY = 'array',
  OBJECT = 'object'
}

/**
 * Algorithm configuration
 */
export interface AlgorithmConfig {
  readonly type: AlgorithmType;
  readonly steps: AlgorithmStep[];
  readonly fallbackStrategies: FallbackStrategy[];
  readonly errorHandling: ErrorHandlingConfig;
}

export enum AlgorithmType {
  REGEX_BASED = 'regex_based',
  POSITION_BASED = 'position_based',
  HYBRID = 'hybrid',
  ML_ASSISTED = 'ml_assisted'
}

export interface AlgorithmStep {
  readonly id: string;
  readonly type: StepType;
  readonly config: StepConfig;
  readonly dependencies?: readonly string[];
  readonly timeoutMs: number;
}

export enum StepType {
  TEXT_CLEANING = 'text_cleaning',
  PATTERN_MATCHING = 'pattern_matching',
  DATA_EXTRACTION = 'data_extraction',
  VALIDATION = 'validation',
  TRANSFORMATION = 'transformation'
}

export interface StepConfig {
  readonly [key: string]: unknown;
}

/**
 * Error handling configuration
 */
export interface ErrorHandlingConfig {
  readonly retryAttempts: number;
  readonly retryDelayMs: number;
  readonly fallbackEnabled: boolean;
  readonly errorMapping: Record<string, string>;
}
```

### 2.2 Theatre-Specific Template Interfaces

```typescript
// src/templates/revue/types.ts

import { BaseTemplateConfig } from '../types';

/**
 * Revue Cinema specific template configuration
 */
export interface RevueTemplateConfig extends BaseTemplateConfig {
  readonly theatreType: TheatreType.INDEPENDENT;
  readonly algorithm: AlgorithmConfig & {
    readonly type: AlgorithmType.HYBRID;
    readonly revueSpecific: RevueAlgorithmConfig;
  };
  readonly validation: ValidationConfig & {
    readonly revueSpecific: RevueValidationConfig;
  };
}

/**
 * Revue-specific algorithm configuration
 */
export interface RevueAlgorithmConfig {
  readonly pdfStructure: PdfStructureConfig;
  readonly dateParsing: DateParsingConfig;
  readonly movieTitleExtraction: MovieTitleExtractionConfig;
  readonly curatorMapping: CuratorMappingConfig;
  readonly specialEventHandling: SpecialEventConfig;
}

export interface PdfStructureConfig {
  readonly headerPatterns: readonly string[];
  readonly movieSectionStartPattern: string;
  readonly screeningLinePattern: string;
  readonly footerPatterns: readonly string[];
  readonly pageBreakHandling: PageBreakConfig;
}

export interface PageBreakConfig {
  readonly strategy: 'ignore' | 'merge' | 'split';
  readonly mergePatterns?: readonly string[];
  readonly splitPatterns?: readonly string[];
}

export interface DateParsingConfig {
  readonly dateFormats: readonly string[];
  readonly timeFormats: readonly string[];
  readonly timezoneHandling: TimezoneConfig;
  readonly relativeDateHandling: RelativeDateConfig;
}

export interface TimezoneConfig {
  readonly defaultTimezone: string;
  readonly enableDST: boolean;
  readonly timezonePatterns: Record<string, string>;
}

export interface RelativeDateConfig {
  readonly enabled: boolean;
  readonly referencePatterns: readonly string[];
  readonly fallbackStrategy: 'today' | 'error' | 'skip';
}

export interface MovieTitleExtractionConfig {
  readonly titlePatterns: readonly string[];
  readonly yearExtractionPatterns: readonly string[];
  readonly runtimeExtractionPatterns: readonly string[];
  readonly directorExtractionPatterns: readonly string[];
  readonly cleanupRules: readonly TitleCleanupRule[];
}

export interface TitleCleanupRule {
  readonly pattern: string;
  readonly replacement: string;
  readonly flags: string;
  readonly condition?: string;
}

export interface CuratorMappingConfig {
  readonly curatorPatterns: readonly CuratorPattern[];
  readonly collectiveMapping: Record<string, string>;
  readonly unknownCuratorHandling: 'create' | 'skip' | 'error';
}

export interface CuratorPattern {
  readonly pattern: string;
  readonly curatorId: string;
  readonly confidence: number;
  readonly context?: string;
}

export interface SpecialEventConfig {
  readonly eventPatterns: readonly string[];
  readonly screeningTypes: readonly ScreeningType[];
  readonly customHandlers: Record<string, string>;
}

export interface ScreeningType {
  readonly id: string;
  readonly name: string;
  readonly patterns: readonly string[];
  readonly metadata?: Record<string, unknown>;
}

/**
 * Revue-specific validation configuration
 */
export interface RevueValidationConfig {
  readonly movieTitleValidation: MovieTitleValidationConfig;
  readonly dateValidation: DateValidationConfig;
  readonly curatorValidation: CuratorValidationConfig;
}

export interface MovieTitleValidationConfig {
  readonly minLength: number;
  readonly maxLength: number;
  readonly allowedCharacters: string;
  readonly forbiddenPatterns: readonly string[];
  readonly referenceDatabase?: string;
}

export interface DateValidationConfig {
  readonly minDate: string;
  readonly maxDate: string;
  readonly allowedTimes: TimeRangeConfig[];
  readonly futureOnly: boolean;
}

export interface TimeRangeConfig {
  readonly start: string;
  readonly end: string;
  readonly days: readonly string[];
}

export interface CuratorValidationConfig {
  readonly knownCurators: readonly string[];
  readonly allowUnknown: boolean;
  readonly requireCollective: boolean;
}
```

### 2.3 Template Execution Interfaces

```typescript
// src/templates/execution/types.ts

/**
 * Template execution context
 */
export interface TemplateExecutionContext {
  readonly templateId: string;
  readonly pdfContent: string;
  readonly metadata: PdfMetadata;
  readonly securityContext: SecurityContext;
  readonly executionOptions: ExecutionOptions;
}

export interface PdfMetadata {
  readonly pageCount: number;
  readonly fileSize: number;
  readonly creationDate?: Date;
  readonly modificationDate?: Date;
  readonly ocrUsed: boolean;
  readonly textConfidence: number;
}

export interface SecurityContext {
  readonly executionId: string;
  readonly startTime: number;
  readonly memoryUsage: number;
  readonly allowedOperations: readonly SecurityOperation[];
  readonly sandboxActive: boolean;
}

export interface ExecutionOptions {
  readonly strictValidation: boolean;
  readonly enableFallbacks: boolean;
  readonly logLevel: LogLevel;
  readonly customConstants?: Record<string, unknown>;
}

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

/**
 * Template execution result
 */
export interface TemplateExecutionResult {
  readonly success: boolean;
  readonly data?: ExtractedScreeningData[];
  readonly errors: TemplateError[];
  readonly warnings: TemplateWarning[];
  readonly metadata: ExecutionMetadata;
  readonly securityReport: SecurityReport;
}

export interface ExtractedScreeningData {
  readonly movie: MovieInfo;
  readonly screenings: ScreeningInfo[];
  readonly curators: CuratorInfo[];
  readonly specialEvents?: SpecialEventInfo[];
  readonly metadata: ScreeningMetadata;
}

export interface MovieInfo {
  readonly title: string;
  readonly year?: number;
  readonly director?: string;
  readonly runtime?: number;
  readonly language?: string;
  readonly genre?: string;
  readonly sourceLocation: TextLocation;
}

export interface ScreeningInfo {
  readonly date: Date;
  readonly time: string;
  readonly format?: string;
  readonly price?: string;
  readonly sourceLocation: TextLocation;
}

export interface CuratorInfo {
  readonly name: string;
  readonly collective?: string;
  readonly confidence: number;
  readonly sourceLocation: TextLocation;
}

export interface SpecialEventInfo {
  readonly name: string;
  readonly type: string;
  readonly description?: string;
  readonly sourceLocation: TextLocation;
}

export interface ScreeningMetadata {
  readonly extractionMethod: string;
  readonly confidence: number;
  readonly sourcePages: readonly number[];
  readonly processingTime: number;
}

export interface TextLocation {
  readonly page: number;
  readonly line: number;
  readonly characterStart: number;
  readonly characterEnd: number;
  readonly context: string;
}

export interface TemplateError {
  readonly code: string;
  readonly message: string;
  readonly severity: ErrorSeverity;
  readonly step?: string;
  readonly location?: TextLocation;
  readonly timestamp: Date;
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface TemplateWarning {
  readonly code: string;
  readonly message: string;
  readonly step?: string;
  readonly location?: TextLocation;
  readonly timestamp: Date;
}

export interface ExecutionMetadata {
  readonly templateId: string;
  readonly executionTime: number;
  readonly memoryUsed: number;
  readonly stepsCompleted: readonly string[];
  readonly fallbacksUsed: readonly string[];
  readonly securityViolations: readonly SecurityViolation[];
}

export interface SecurityViolation {
  readonly type: SecurityViolationType;
  readonly description: string;
  readonly severity: SecurityViolationSeverity;
  readonly timestamp: Date;
}

export enum SecurityViolationType {
  REGEX_COMPLEXITY = 'regex_complexity',
  TIMEOUT_EXCEEDED = 'timeout_exceeded',
  MEMORY_EXCEEDED = 'memory_exceeded',
  UNAUTHORIZED_OPERATION = 'unauthorized_operation',
  PATTERN_VIOLATION = 'pattern_violation'
}

export enum SecurityViolationSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export interface SecurityReport {
  readonly violations: readonly SecurityViolation[];
  readonly maxMemoryUsed: number;
  readonly maxExecutionTime: number;
  readonly operationsExecuted: readonly SecurityOperation[];
  readonly sandboxCompliance: boolean;
}
```

## 3. Revue Cinema Template Implementation

### 3.1 Revue Template Configuration

```typescript
// src/templates/revue/RevueTemplate.ts

import { RevueTemplateConfig, TheatreType, AlgorithmType, SecurityOperation } from './types';

export const REVUE_TEMPLATE_CONFIG: RevueTemplateConfig = {
  id: 'revue-cinema-toronto',
  name: 'Revue Cinema Toronto',
  version: '1.0.0',
  theatreType: TheatreType.INDEPENDENT,
  
  security: {
    maxExecutionTimeMs: 20000, // 20 seconds
    maxMemoryMB: 256,
    allowedOperations: [
      SecurityOperation.TEXT_EXTRACTION,
      SecurityOperation.REGEX_MATCH,
      SecurityOperation.DATE_PARSING,
      SecurityOperation.STRING_MANIPULATION
    ],
    regexPatterns: {
      maxComplexity: 500,
      timeoutMs: 5000,
      forbiddenPatterns: [
        '.*\\(.*\\).*\\(.*\\).*\\(.*\\).*', // Excessive nesting
        '.*\\*.*\\*.*\\*.*',               // Catastrophic backtracking
        '.*\\{.*\\}.*\\{.*\\}.*'           // Nested quantifiers
      ],
      maxBacktracking: 1000
    },
    fileSystemAccess: {
      allowTempFiles: true,
      maxTempFileSize: 10 * 1024 * 1024, // 10MB
      allowedDirectories: ['/tmp', './temp'],
      sandboxEnabled: true
    }
  },

  validation: {
    requiredFields: ['title', 'date', 'time'],
    strictMode: true,
    fieldValidators: {
      title: {
        type: ValidationType.STRING,
        required: true,
        minLength: 1,
        maxLength: 200,
        allowedCharacters: 'a-zA-Z0-9\\s\\-\\.:\\\'",!&?',
        customValidator: 'movieTitle'
      },
      date: {
        type: ValidationType.DATE,
        required: true,
        pattern: '^\\d{4}-\\d{2}-\\d{2}$'
      },
      time: {
        type: ValidationType.STRING,
        required: true,
        pattern: '^(0?[1-9]|1[0-2]):[0-5][0-9]\\s?(AM|PM|am|pm)$'
      },
      curator: {
        type: ValidationType.STRING,
        required: false,
        maxLength: 100,
        customValidator: 'curatorName'
      }
    },
    outputSchema: {
      type: 'object',
      required: ['movie', 'screenings'],
      properties: {
        movie: {
          type: 'object',
          required: ['title'],
          properties: {
            title: { type: 'string' },
            year: { type: 'number' },
            director: { type: 'string' },
            runtime: { type: 'number' }
          }
        },
        screenings: {
          type: 'array',
          items: {
            type: 'object',
            required: ['date', 'time'],
            properties: {
              date: { type: 'string' },
              time: { type: 'string' },
              format: { type: 'string' }
            }
          }
        }
      }
    },
    revueSpecific: {
      movieTitleValidation: {
        minLength: 1,
        maxLength: 200,
        allowedCharacters: 'a-zA-Z0-9\\s\\-\\.:\\\'",!&?',
        forbiddenPatterns: ['^\\s*$', '^[0-9]+$'],
        referenceDatabase: './data/revue/movie_database.json'
      },
      dateValidation: {
        minDate: '2024-01-01',
        maxDate: '2025-12-31',
        allowedTimes: [
          { start: '10:00 AM', end: '11:59 PM', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] }
        ],
        futureOnly: true
      },
      curatorValidation: {
        knownCurators: [
          'Sprog', 'Rae', 'Greg Woods', 'Kiva', 'Andrew Parker', 
          'Angelo Muredda', 'Jason Gorber', 'Chris Knipp'
        ],
        allowUnknown: true,
        requireCollective: false
      }
    }
  },

  algorithm: {
    type: AlgorithmType.HYBRID,
    steps: [
      {
        id: 'text_cleaning',
        type: StepType.TEXT_CLEANING,
        timeoutMs: 2000,
        config: {
          removeExtraWhitespace: true,
          normalizeLineEndings: true,
          removeControlChars: true
        }
      },
      {
        id: 'section_detection',
        type: StepType.PATTERN_MATCHING,
        timeoutMs: 3000,
        dependencies: ['text_cleaning'],
        config: {
          patterns: [
            {
              name: 'movie_section',
              regex: '^(?:THIS WEEK|NEXT WEEK|COMING SOON)[\\s\\S]*?(?=\\n\\n|$)',
              flags: 'im'
            }
          ]
        }
      },
      {
        id: 'movie_extraction',
        type: StepType.DATA_EXTRACTION,
        timeoutMs: 5000,
        dependencies: ['section_detection'],
        config: {
          extractionRules: [
            {
              name: 'title_and_year',
              regex: '^([^\\n]+?)\\s*(?:\\((\\d{4})\\))?[\\s\\n]*',
              groups: { title: 1, year: 2 }
            },
            {
              name: 'director',
              regex: 'Dir\\.\\s*([^\\n]+)',
              groups: { director: 1 }
            },
            {
              name: 'runtime',
              regex: '(\\d+)\\s*min',
              groups: { runtime: 1 }
            }
          ]
        }
      },
      {
        id: 'screening_extraction',
        type: StepType.DATA_EXTRACTION,
        timeoutMs: 4000,
        dependencies: ['movie_extraction'],
        config: {
          extractionRules: [
            {
              name: 'screenings',
              regex: '(?:MON|TUE|WED|THU|FRI|SAT|SUN)\\s+(\\d{1,2})\\s+(?:@|at)?\\s*([0-9]{1,2}:[0-9]{2}\\s*(?:AM|PM|am|pm))',
              groups: { day: 1, time: 2 }
            }
          ]
        }
      },
      {
        id: 'curator_extraction',
        type: StepType.DATA_EXTRACTION,
        timeoutMs: 3000,
        dependencies: ['movie_extraction'],
        config: {
          extractionRules: [
            {
              name: 'curator',
              regex: '(?:Introduced by|Curated by|Hosted by)\\s+([^\\n]+)',
              groups: { curator: 1 }
            }
          ]
        }
      },
      {
        id: 'date_resolution',
        type: StepType.TRANSFORMATION,
        timeoutMs: 2000,
        dependencies: ['screening_extraction'],
        config: {
          transformation: 'resolve_relative_dates',
          referenceDate: 'current_week',
          timezone: 'America/Toronto'
        }
      },
      {
        id: 'validation',
        type: StepType.VALIDATION,
        timeoutMs: 2000,
        dependencies: ['date_resolution', 'curator_extraction'],
        config: {
          strictMode: true,
          requiredFields: ['title', 'date', 'time'],
          validationRules: [
            { field: 'title', rule: 'movieTitle' },
            { field: 'date', rule: 'validDate' },
            { field: 'time', rule: 'validTime' }
          ]
        }
      }
    ],
    fallbackStrategies: [
      {
        condition: 'no_screenings_found',
        strategy: 'broader_date_patterns',
        config: {
          alternativePatterns: [
            '(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\\s+(\\d{1,2})',
            '(\\d{1,2})/[0-1]?\\d/\\d{4}'
          ]
        }
      },
      {
        condition: 'title_extraction_failed',
        strategy: 'line_based_title_detection',
        config: {
          maxLines: 3,
          titleIndicators: ['Dir.', 'min', 'Canada', 'USA']
        }
      }
    ],
    errorHandling: {
      retryAttempts: 2,
      retryDelayMs: 1000,
      fallbackEnabled: true,
      errorMapping: {
        'regex_timeout': 'use_simpler_patterns',
        'date_parse_error': 'use_relative_dates',
        'memory_exceeded': 'reduce_text_scope'
      }
    },
    revueSpecific: {
      pdfStructure: {
        headerPatterns: [
          '^THE REVUE CINEMA',
          '^\\d+\\s+RONCESVALLES AVE',
          '^TORONTO, ON'
        ],
        movieSectionStartPattern: '^THIS WEEK|^NEXT WEEK|^COMING SOON',
        screeningLinePattern: '^(?:MON|TUE|WED|THU|FRI|SAT|SUN)',
        footerPatterns: [
          '^revuecinema\\.ca',
          '^@RevueCinema',
          '^revuecinema'
        ],
        pageBreakHandling: {
          strategy: 'merge',
          mergePatterns: [
            '-\\s*\\n\\s*',
            '\\n\\s*\\d+\\s*$'
          ]
        }
      },
      dateParsing: {
        dateFormats: [
          'YYYY-MM-DD',
          'MM/DD/YYYY',
          'MMM DD, YYYY'
        ],
        timeFormats: [
          'h:mm A',
          'h:mm a',
          'HH:mm'
        ],
        timezoneHandling: {
          defaultTimezone: 'America/Toronto',
          enableDST: true,
          timezonePatterns: {
            'EST': 'America/Toronto',
            'EDT': 'America/Toronto'
          }
        },
        relativeDateHandling: {
          enabled: true,
          referencePatterns: [
            'THIS WEEK',
            'NEXT WEEK',
            'COMING SOON'
          ],
          fallbackStrategy: 'today'
        }
      },
      movieTitleExtraction: {
        titlePatterns: [
          '^([^\\(\\n]+)', // Text before parentheses
          '^([A-Z][^\\n]{10,100})', // Capitalized lines of reasonable length
          '^([^\\n]{20,80})\\s*\\((\\d{4})\\)' // Title with year
        ],
        yearExtractionPatterns: [
          '\\((\\d{4})\\)',
          '\\s+(\\d{4})\\s+',
          '\\.(\\d{4})'
        ],
        runtimeExtractionPatterns: [
          '(\\d+)\\s*min',
          '(\\d+)\\s*minutes?',
          '(\\d+)\\s*mins?'
        ],
        directorExtractionPatterns: [
          'Dir\\.?\\s+([^\\n]+)',
          'Director:\\s+([^\\n]+)',
          'Directed by\\s+([^\\n]+)'
        ],
        cleanupRules: [
          {
            pattern: '^\\s+|\\s+$',
            replacement: '',
            flags: 'g'
          },
          {
            pattern: '\\s+',
            replacement: ' ',
            flags: 'g'
          },
          {
            pattern: '[\\x00-\\x1F\\x7F]',
            replacement: '',
            flags: 'g'
          }
        ]
      },
      curatorMapping: {
        curatorPatterns: [
          {
            pattern: 'Sprog',
            curatorId: 'sprog',
            confidence: 0.95
          },
          {
            pattern: 'Rae',
            curatorId: 'rae',
            confidence: 0.90
          },
          {
            pattern: 'Greg Woods',
            curatorId: 'greg_woods',
            confidence: 0.95
          },
          {
            pattern: 'Kiva',
            curatorId: 'kiva',
            confidence: 0.85
          },
          {
            pattern: 'Andrew Parker',
            curatorId: 'andrew_parker',
            confidence: 0.90
          },
          {
            pattern: 'Angelo Muredda',
            curatorId: 'angelo_muredda',
            confidence: 0.90
          },
          {
            pattern: 'Jason Gorber',
            curatorId: 'jason_gorber',
            confidence: 0.90
          },
          {
            pattern: 'Chris Knipp',
            curatorId: 'chris_knipp',
            confidence: 0.90
          }
        ],
        collectiveMapping: {
          'Third Eye Film Festival': 'third_eye',
          'Flesh of the Void': 'flesh_of_the_void',
          'Toronto After Dark': 'toronto_after_dark'
        },
        unknownCuratorHandling: 'create'
      },
      specialEventHandling: {
        eventPatterns: [
          'SPECIAL PRESENTATION',
          'RETROCOMING ATTRACTIONS',
          'DOUBLE BILL',
          'CULT FILM NIGHT',
          'SUNDAY SCREENINGS'
        ],
        screeningTypes: [
          {
            id: 'special_presentation',
            name: 'Special Presentation',
            patterns: ['SPECIAL PRESENTATION', 'SPC. PRESENT.']
          },
          {
            id: 'double_bill',
            name: 'Double Bill',
            patterns: ['DOUBLE BILL', 'DOUBLE FEATURE', 'DOUBLE']
          },
          {
            id: 'cult_film',
            name: 'Cult Film Night',
            patterns: ['CULT FILM', 'MIDNIGHT MOVIE']
          }
        ],
        customHandlers: {
          'double_bill': 'handleDoubleBill',
          'special_presentation': 'handleSpecialPresentation'
        }
      }
    }
  }
};
```

This comprehensive template system provides secure, type-safe, and extensible theatre-specific parsing algorithms while maintaining strict security controls and professional development standards.