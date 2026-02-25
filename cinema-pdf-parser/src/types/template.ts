// Template system related types

import { BaseError, TextLocation } from './common';

/**
 * Base template configuration interface
 */
export interface BaseTemplateConfig {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly theatreType: TheatreType;
  readonly security: TemplateSecurityConfig;
  readonly validation: TemplateValidationConfig;
  readonly algorithm: TemplateAlgorithmConfig;
}

/**
 * Theatre classification
 */
export enum TheatreType {
  INDEPENDENT = 'independent',
  CHAIN = 'chain',
  FESTIVAL = 'festival',
  POPUP = 'popup',
}

/**
 * Security configuration for templates
 */
export interface TemplateSecurityConfig {
  readonly maxExecutionTimeMs: number;
  readonly maxMemoryMB: number;
  readonly allowedOperations: readonly SecurityOperation[];
  readonly regexPatterns: RegexSecurityConfig;
  readonly fileSystemAccess: FileSystemSecurityConfig;
}

/**
 * Security operations
 */
export enum SecurityOperation {
  TEXT_EXTRACTION = 'text_extraction',
  REGEX_MATCH = 'regex_match',
  DATE_PARSING = 'date_parsing',
  STRING_MANIPULATION = 'string_manipulation',
}

/**
 * Regex security configuration
 */
export interface RegexSecurityConfig {
  readonly maxComplexity: number;
  readonly timeoutMs: number;
  readonly forbiddenPatterns: readonly string[];
  readonly maxBacktracking: number;
}

/**
 * File system security configuration
 */
export interface FileSystemSecurityConfig {
  readonly allowTempFiles: boolean;
  readonly maxTempFileSize: number;
  readonly allowedDirectories: readonly string[];
  readonly sandboxEnabled: boolean;
}

/**
 * Validation configuration
 */
export interface TemplateValidationConfig {
  readonly requiredFields: readonly string[];
  readonly fieldValidators: Record<string, FieldValidator>;
  readonly outputSchema: OutputSchema;
  readonly strictMode: boolean;
}

/**
 * Field validator
 */
export interface FieldValidator {
  readonly type: ValidationType;
  readonly required: boolean;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
  readonly customValidator?: string;
}

/**
 * Validation types
 */
export enum ValidationType {
  STRING = 'string',
  DATE = 'date',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  ARRAY = 'array',
  OBJECT = 'object',
}

/**
 * Output schema
 */
export interface OutputSchema {
  readonly type: string;
  readonly required: readonly string[];
  readonly properties: Record<string, any>;
}

/**
 * Algorithm configuration
 */
export interface TemplateAlgorithmConfig {
  readonly type: AlgorithmType;
  readonly steps: readonly AlgorithmStep[];
  readonly fallbackStrategies: readonly FallbackStrategy[];
  readonly errorHandling: ErrorHandlingConfig;
}

/**
 * Algorithm types
 */
export enum AlgorithmType {
  REGEX_BASED = 'regex_based',
  POSITION_BASED = 'position_based',
  HYBRID = 'hybrid',
  ML_ASSISTED = 'ml_assisted',
}

/**
 * Algorithm step
 */
export interface AlgorithmStep {
  readonly id: string;
  readonly type: StepType;
  readonly config: StepConfig;
  readonly dependencies?: readonly string[];
  readonly timeoutMs: number;
}

/**
 * Step types
 */
export enum StepType {
  TEXT_CLEANING = 'text_cleaning',
  PATTERN_MATCHING = 'pattern_matching',
  DATA_EXTRACTION = 'data_extraction',
  VALIDATION = 'validation',
  TRANSFORMATION = 'transformation',
}

/**
 * Step configuration
 */
export interface StepConfig {
  readonly [key: string]: unknown;
}

/**
 * Fallback strategy
 */
export interface FallbackStrategy {
  readonly condition: string;
  readonly strategy: string;
  readonly config: Record<string, unknown>;
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

/**
 * Template execution context
 */
export interface TemplateExecutionContext {
  readonly templateId: string;
  readonly pdfContent: string;
  readonly metadata: any;
  readonly securityContext: any;
  readonly executionOptions: any;
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
  readonly securityReport: TemplateSecurityReport;
}

/**
 * Template error
 */
export interface TemplateError extends BaseError {
  readonly name: 'TemplateError';
  readonly step?: string;
  readonly location?: TextLocation;
}

/**
 * Template warning
 */
export interface TemplateWarning extends BaseError {
  readonly name: 'TemplateWarning';
  readonly step?: string;
  readonly location?: TextLocation;
}

/**
 * Security violation
 */
export interface SecurityViolation {
  readonly type: SecurityViolationType;
  readonly description: string;
  readonly severity: SecurityViolationSeverity;
  readonly timestamp: Date;
}

/**
 * Security violation types
 */
export enum SecurityViolationType {
  REGEX_COMPLEXITY = 'regex_complexity',
  TIMEOUT_EXCEEDED = 'timeout_exceeded',
  MEMORY_EXCEEDED = 'memory_exceeded',
  UNAUTHORIZED_OPERATION = 'unauthorized_operation',
  PATTERN_VIOLATION = 'pattern_violation',
}

/**
 * Security violation severity
 */
export enum SecurityViolationSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Security report
 */
export interface TemplateSecurityReport {
  readonly violations: readonly SecurityViolation[];
  readonly maxMemoryUsed: number;
  readonly maxExecutionTime: number;
  readonly operationsExecuted: readonly SecurityOperation[];
  readonly sandboxCompliance: boolean;
}

/**
 * Execution metadata
 */
export interface ExecutionMetadata {
  readonly templateId: string;
  readonly executionTime: number;
  readonly memoryUsed: number;
  readonly stepsCompleted: readonly string[];
  readonly fallbacksUsed: readonly string[];
  readonly securityViolations: readonly SecurityViolation[];
}

/**
 * Extracted screening data
 */
export interface ExtractedScreeningData {
  readonly movie: MovieInfo;
  readonly screenings: ScreeningInfo[];
  readonly curators: CuratorInfo[];
  readonly specialEvents?: SpecialEventInfo[];
  readonly metadata: ScreeningMetadata;
}

/**
 * Movie information
 */
export interface MovieInfo {
  readonly title: string;
  readonly year?: number;
  readonly director?: string;
  readonly runtime?: number;
  readonly language?: string;
  readonly genre?: string;
  readonly country?: string;
  readonly sourceLocation: TextLocation;
}

/**
 * Screening information
 */
export interface ScreeningInfo {
  readonly date: Date;
  readonly time: string;
  readonly format?: string;
  readonly price?: string;
  readonly sourceLocation: TextLocation;
}

/**
 * Curator information
 */
export interface CuratorInfo {
  readonly name: string;
  readonly collective?: string;
  readonly confidence: number;
  readonly sourceLocation: TextLocation;
}

/**
 * Special event information
 */
export interface SpecialEventInfo {
  readonly name: string;
  readonly type: string;
  readonly description?: string;
  readonly sourceLocation: TextLocation;
}

/**
 * Screening metadata
 */
export interface ScreeningMetadata {
  readonly extractionMethod: string;
  readonly confidence: number;
  readonly sourcePages: readonly number[];
  readonly processingTime: number;
}
