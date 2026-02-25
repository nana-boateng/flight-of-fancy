# JSON Output Schema and Data Models Design

## Overview

This document defines the comprehensive JSON output schema and data models for the cinema PDF parser system. The schema provides structured, validated, and secure output for movie screening information with proper references to managed constants.

## Core Data Models

### 1. Primary Output Schema

```typescript
// src/types/output.ts

/**
 * Main output structure for parsed cinema data
 */
export interface CinemaCalendarOutput {
  readonly metadata: OutputMetadata;
  readonly theatre: TheatreInfo;
  readonly period: CalendarPeriod;
  readonly movies: MovieScreening[];
  readonly constants: ConstantsReference;
  readonly processing: ProcessingInfo;
}

/**
 * Metadata about the output file
 */
export interface OutputMetadata {
  readonly version: string;
  readonly generatedAt: string; // ISO 8601 timestamp
  readonly sourceFile: {
    readonly name: string;
    readonly size: number;
    readonly hash: string; // SHA-256 for integrity
    readonly pages: number;
  };
  readonly parser: {
    readonly version: string;
    readonly template: string;
    readonly confidence: number; // Overall confidence 0-1
  };
}

/**
 * Theatre information
 */
export interface TheatreInfo {
  readonly id: string;
  readonly name: string;
  readonly location: TheatreLocation;
  readonly contact?: TheatreContact;
}

export interface TheatreLocation {
  readonly address: string;
  readonly city: string;
  readonly province: string;
  readonly country: string;
  readonly coordinates?: {
    readonly latitude: number;
    readonly longitude: number;
  };
}

export interface TheatreContact {
  readonly website?: string;
  readonly phone?: string;
  readonly email?: string;
}

/**
 * Calendar period covered by the PDF
 */
export interface CalendarPeriod {
  readonly startDate: string; // ISO 8601 date
  readonly endDate: string; // ISO 8601 date
  readonly type: 'weekly' | 'monthly' | 'custom';
}

/**
 * Movie screening information
 */
export interface MovieScreening {
  readonly id: string;
  readonly movie: Movie;
  readonly screenings: Screening[];
  readonly curators: CuratorReference[];
  readonly specialEvents?: SpecialEvent[];
  readonly metadata: ScreeningMetadata;
}

/**
 * Movie details
 */
export interface Movie {
  readonly title: string;
  readonly year?: number;
  readonly director?: string;
  readonly runtime?: number; // in minutes
  readonly language?: string;
  readonly genre?: string;
  readonly country?: string;
  readonly sourceLocation: TextLocation;
}

/**
 * Individual screening information
 */
export interface Screening {
  readonly id: string;
  readonly date: string; // ISO 8601 date
  readonly time: string; // HH:MM format
  readonly format?: ScreeningFormat;
  readonly price?: string;
  readonly notes?: string;
  readonly sourceLocation: TextLocation;
}

/**
 * Screening format information
 */
export interface ScreeningFormat {
  readonly id: string; // References constants
  readonly name: string;
  readonly type: FormatType;
  readonly notes?: string;
}

export enum FormatType {
  DIGITAL = 'digital',
  FILM = 'film',
  SPECIAL = 'special'
}

/**
 * Curator reference information
 */
export interface CuratorReference {
  readonly id: string; // References constants
  readonly name: string;
  readonly collective?: CollectiveReference;
  readonly role?: string;
  readonly sourceLocation: TextLocation;
}

/**
 * Collective reference information
 */
export interface CollectiveReference {
  readonly id: string; // References constants
  readonly name: string;
  readonly description?: string;
}

/**
 * Special event information
 */
export interface SpecialEvent {
  readonly id: string;
  readonly name: string;
  readonly type: EventType;
  readonly description?: string;
  readonly series?: SeriesReference;
  readonly sourceLocation: TextLocation;
}

export enum EventType {
  SPECIAL_PRESENTATION = 'special_presentation',
  DOUBLE_BILL = 'double_bill',
  FESTIVAL = 'festival',
  RETROSPECTIVE = 'retrospective',
  GUEST_QA = 'guest_qa',
  LIVE_ACCOMPANIMENT = 'live_accompaniment'
}

/**
 * Series reference information
 */
export interface SeriesReference {
  readonly id: string; // References constants
  readonly name: string;
  readonly description?: string;
  readonly curator?: string;
}

/**
 * Screening metadata
 */
export interface ScreeningMetadata {
  readonly extractionMethod: string;
  readonly confidence: number; // 0-1
  readonly sourcePages: number[];
  readonly processingTime: number; // in milliseconds
  readonly validationWarnings?: string[];
  extractionIssues?: string[];
}

/**
 * Constants reference section
 */
export interface ConstantsReference {
  readonly formats: ConstantReference[];
  readonly curators: ConstantReference[];
  readonly collectives: ConstantReference[];
  readonly series: ConstantReference[];
}

export interface ConstantReference {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly isNew: boolean; // True if discovered in current parsing
}

/**
 * Processing information
 */
export interface ProcessingInfo {
  readonly totalProcessingTime: number; // in milliseconds
  readonly memoryUsed: number; // in bytes
  readonly stepsCompleted: string[];
  readonly errors: ProcessingError[];
  readonly warnings: ProcessingWarning[];
}

export interface ProcessingError {
  readonly code: string;
  readonly message: string;
  readonly severity: ErrorSeverity;
  readonly step?: string;
  readonly timestamp: string;
}

export interface ProcessingWarning {
  readonly code: string;
  readonly message: string;
  readonly step?: string;
  readonly timestamp: string;
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Text location for source reference
 */
export interface TextLocation {
  readonly page: number;
  readonly line: number;
  readonly characterStart: number;
  readonly characterEnd: number;
  readonly context: string;
}
```

### 2. JSON Schema Definitions

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://cinema-parser.org/schema/v1/cinema-calendar.json",
  "title": "Cinema Calendar Output",
  "description": "Structured output for parsed cinema calendar PDFs",
  "type": "object",
  "required": ["metadata", "theatre", "period", "movies", "constants", "processing"],
  "properties": {
    "metadata": {
      "$ref": "#/definitions/OutputMetadata"
    },
    "theatre": {
      "$ref": "#/definitions/TheatreInfo"
    },
    "period": {
      "$ref": "#/definitions/CalendarPeriod"
    },
    "movies": {
      "type": "array",
      "items": {
        "$ref": "#/definitions/MovieScreening"
      },
      "minItems": 0
    },
    "constants": {
      "$ref": "#/definitions/ConstantsReference"
    },
    "processing": {
      "$ref": "#/definitions/ProcessingInfo"
    }
  },
  "additionalProperties": false,
  "definitions": {
    "OutputMetadata": {
      "type": "object",
      "required": ["version", "generatedAt", "sourceFile", "parser"],
      "properties": {
        "version": {
          "type": "string",
          "pattern": "^\\d+\\.\\d+\\.\\d+$"
        },
        "generatedAt": {
          "type": "string",
          "format": "date-time"
        },
        "sourceFile": {
          "$ref": "#/definitions/SourceFileInfo"
        },
        "parser": {
          "$ref": "#/definitions/ParserInfo"
        }
      },
      "additionalProperties": false
    },
    "SourceFileInfo": {
      "type": "object",
      "required": ["name", "size", "hash", "pages"],
      "properties": {
        "name": {
          "type": "string",
          "minLength": 1,
          "maxLength": 255,
          "pattern": "^[a-zA-Z0-9._-]+$"
        },
        "size": {
          "type": "integer",
          "minimum": 0,
          "maximum": 52428800
        },
        "hash": {
          "type": "string",
          "pattern": "^[a-fA-F0-9]{64}$"
        },
        "pages": {
          "type": "integer",
          "minimum": 1,
          "maximum": 1000
        }
      },
      "additionalProperties": false
    },
    "ParserInfo": {
      "type": "object",
      "required": ["version", "template", "confidence"],
      "properties": {
        "version": {
          "type": "string",
          "pattern": "^\\d+\\.\\d+\\.\\d+$"
        },
        "template": {
          "type": "string",
          "minLength": 1,
          "maxLength": 100
        },
        "confidence": {
          "type": "number",
          "minimum": 0,
          "maximum": 1
        }
      },
      "additionalProperties": false
    }
  }
}
```

## Example Output Structure

```json
{
  "metadata": {
    "version": "1.0.0",
    "generatedAt": "2026-02-06T10:30:00.000Z",
    "sourceFile": {
      "name": "Revue_Calendar_February26-12x18-1.pdf",
      "size": 2048576,
      "hash": "a1b2c3d4e5f6...",
      "pages": 2
    },
    "parser": {
      "version": "1.0.0",
      "template": "revue-cinema-toronto",
      "confidence": 0.95
    }
  },
  "theatre": {
    "id": "revue_cinema",
    "name": "Revue Cinema",
    "location": {
      "address": "400 Roncesvalles Ave",
      "city": "Toronto",
      "province": "ON",
      "country": "Canada"
    }
  },
  "period": {
    "startDate": "2026-02-26",
    "endDate": "2026-03-05",
    "type": "weekly"
  },
  "movies": [
    {
      "id": "movie_1",
      "movie": {
        "title": "The Seven Samurai",
        "year": 1954,
        "director": "Akira Kurosawa",
        "runtime": 207,
        "sourceLocation": {
          "page": 1,
          "line": 5,
          "characterStart": 10,
          "characterEnd": 25,
          "context": "THE SEVEN SAMURAI (1954) - Dir. Akira Kurosawa"
        }
      },
      "screenings": [
        {
          "id": "screening_1",
          "date": "2026-02-28",
          "time": "19:30",
          "format": {
            "id": "35mm",
            "name": "35mm Film",
            "type": "film"
          },
          "price": "$12",
          "sourceLocation": {
            "page": 1,
            "line": 7,
            "characterStart": 5,
            "characterEnd": 15,
            "context": "Thu 28 @ 7:30 PM - $12"
          }
        }
      ],
      "curators": [
        {
          "id": "sprog",
          "name": "Sprog",
          "sourceLocation": {
            "page": 1,
            "line": 6,
            "characterStart": 20,
            "characterEnd": 25,
            "context": "Introduced by Sprog"
          }
        }
      ],
      "metadata": {
        "extractionMethod": "revue_template_v1",
        "confidence": 0.95,
        "sourcePages": [1],
        "processingTime": 150
      }
    }
  ],
  "constants": {
    "formats": [
      {
        "id": "35mm",
        "name": "35mm Film",
        "type": "film",
        "isNew": false
      }
    ],
    "curators": [
      {
        "id": "sprog",
        "name": "Sprog",
        "type": "curator",
        "isNew": false
      }
    ],
    "collectives": [],
    "series": []
  },
  "processing": {
    "totalProcessingTime": 2500,
    "memoryUsed": 52428800,
    "stepsCompleted": [
      "text_cleaning",
      "section_detection",
      "movie_extraction",
      "screening_extraction",
      "curator_extraction",
      "date_resolution",
      "validation"
    ],
    "errors": [],
    "warnings": [
      {
        "code": "LOW_CONFIDENCE_CURATOR",
        "message": "Low confidence in curator name extraction",
        "timestamp": "2026-02-06T10:30:01.000Z"
      }
    ]
  }
}
```

## Testing Strategy

### 1. Unit Tests
- Schema validation tests
- Sanitization function tests
- Output generation tests
- Security validation tests

### 2. Integration Tests
- End-to-end output generation
- Constants reference resolution
- Error handling in output generation
- Performance testing with large datasets

### 3. Security Tests
- XSS injection attempts
- SQL injection attempts
- Encoding attack tests
- Malicious input handling

This comprehensive JSON output schema provides secure, validated, and structured output for cinema parsing applications with proper constants management and enterprise-grade security.