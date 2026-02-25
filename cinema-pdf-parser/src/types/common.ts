// Core shared types for cinema parser system

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
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

/**
 * Base error interface
 */
export interface BaseError {
  readonly code: string;
  readonly message: string;
  readonly severity: ErrorSeverity;
  readonly timestamp: Date;
}

/**
 * Processing options
 */
export interface ProcessingOptions {
  readonly strictValidation: boolean;
  readonly enableFallbacks: boolean;
  readonly logLevel: LogLevel;
  readonly customConstants?: Record<string, unknown>;
  readonly onProgress?: (stage: string, progress: number) => void;
}

/**
 * Security context
 */
export interface SecurityContext {
  readonly executionId: string;
  readonly startTime: number;
  readonly memoryUsage: number;
  readonly allowedOperations: readonly string[];
  readonly sandboxActive: boolean;
}

/**
 * Validation result
 */
export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  readonly processingTime: number;
  readonly memoryPeak: number;
  readonly pagesProcessed: number;
  readonly threatsDetected: number;
  readonly warnings: number;
}

/**
 * Resource limits
 */
export interface ResourceLimits {
  readonly maxFileSize: number;
  readonly maxPages: number;
  readonly maxMemoryMB: number;
  readonly maxTimeoutMs: number;
}
