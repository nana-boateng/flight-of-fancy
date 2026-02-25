// PDF processing related types

import { BaseError, TextLocation } from './common';

/**
 * PDF parsing result
 */
export interface PDFParseResult {
  readonly success: boolean;
  readonly content: string;
  readonly metadata: PDFMetadata;
  readonly security: PDFSecurityReport;
  readonly warnings: PDFSecurityWarning[];
  readonly errors: PDFSecurityError[];
}

/**
 * PDF metadata
 */
export interface PDFMetadata {
  readonly pageCount: number;
  readonly fileSize: number;
  readonly title?: string;
  readonly author?: string;
  readonly creationDate?: Date;
  readonly modificationDate?: Date;
  readonly hasJavaScript: boolean;
  readonly hasEmbeddedFiles: boolean;
  readonly hasForms: boolean;
  readonly hash: string;
  ocrUsed: boolean;
  textConfidence: number;
}

/**
 * PDF security configuration
 */
export interface PDFSecurityConfig {
  readonly maxFileSize: number;
  readonly maxPages: number;
  readonly allowedMimeTypes: readonly string[];
  readonly forbiddenPatterns: readonly string[];
  readonly scanTimeout: number;
  readonly memoryLimit: number;
}

/**
 * Security level
 */
export enum SecurityLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * PDF security report
 */
export interface PDFSecurityReport {
  scanTime: number;
  threatsDetected: number;
  memoryUsed: number;
  tempFilesCreated: number;
  ocrUsed: boolean;
  securityLevel: SecurityLevel;
}

/**
 * Security warning
 */
export interface PDFSecurityWarning extends BaseError {
  readonly name: 'PDFSecurityWarning';
  readonly pattern?: string;
  readonly location?: TextLocation;
}

/**
 * Security error
 */
export interface PDFSecurityError extends BaseError {
  readonly name: 'PDFSecurityError';
  readonly pattern?: string;
  readonly location?: TextLocation;
}

/**
 * Security scan result
 */
export interface SecurityScanResult {
  readonly safe: boolean;
  readonly reasons: readonly string[];
  readonly warnings: readonly PDFSecurityWarning[];
  readonly threatsDetected: number;
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
 * Extraction result
 */
export interface ExtractionResult {
  readonly content: string;
  readonly metadata: PDFMetadata;
  readonly ocrUsed: boolean;
  readonly performanceMetrics: PerformanceMetrics;
}

/**
 * Processing result
 */
export interface ProcessingResult {
  readonly success: boolean;
  readonly data?: string;
  readonly metadata: PDFMetadata;
  readonly errors: readonly PDFSecurityError[];
  readonly warnings: readonly PDFSecurityWarning[];
  readonly performanceMetrics: PerformanceMetrics;
}
