// Main entry point for cinema parser types
export * from './common';

// Re-export with aliases to avoid conflicts
export {
  TheatreType,
  SecurityOperation,
  AlgorithmType,
  StepType,
  TemplateExecutionResult,
  TemplateError,
  TemplateWarning,
  SecurityViolation,
  SecurityViolationType,
  SecurityViolationSeverity,
  ExtractedScreeningData,
  MovieInfo,
  ScreeningInfo,
  CuratorInfo,
  SpecialEventInfo,
} from './template';

export {
  ConstantType,
  ConstantSource,
  ValidationType,
  ValidationRule,
  FormatType as ConstantsFormatType,
  SeriesFrequency,
  DetectionResult,
  ConflictStrategy,
  SimilarityAlgorithm,
  ProcessDetectedResult,
  ImportResult,
} from './constants';

export {
  PDFParseResult,
  PDFMetadata,
  PDFSecurityConfig,
  SecurityLevel,
  PDFSecurityReport,
  PDFSecurityWarning,
  PDFSecurityError,
  SecurityScanResult,
  ExtractionResult,
  ProcessingResult,
} from './pdf';

export {
  CinemaCalendarOutput,
  OutputMetadata,
  SourceFileInfo,
  ParserInfo,
  TheatreInfo,
  TheatreLocation,
  Coordinates,
  TheatreContact,
  CalendarPeriod,
  MovieScreening,
  Movie,
  Screening,
  ScreeningFormat,
  FormatType as OutputFormatType,
  CuratorReference,
  CollectiveReference,
  SpecialEvent,
  EventType,
  SeriesReference,
  ScreeningMetadata as OutputScreeningMetadata,
  ConstantsReference,
  ConstantReference,
  ProcessingInfo,
  ProcessingError,
  ProcessingWarning,
  OutputResult,
  OutputFormat,
  OutputError,
  OutputWarning,
} from './output';

// Re-export commonly used combined types
export interface CinemaParserConfig {
  readonly template: string;
  readonly enableOCR?: boolean;
  readonly strictMode?: boolean;
  readonly timeout?: number;
  readonly maxSize?: number;
  readonly outputFormat?: 'json' | 'csv' | 'xml';
  readonly onProgress?: (stage: string, progress: number) => void;
}

export interface CinemaParserResult {
  readonly success: boolean;
  readonly data?: CinemaCalendarOutput;
  readonly newConstants?: BaseConstant[];
  readonly errors: BaseError[];
  readonly warnings: BaseError[];
}

// Import required types from other modules
import { BaseConstant } from './constants';
import { CinemaCalendarOutput } from './output';
import { BaseError } from './common';
