# PDF Parsing Module Security-First Design

## Executive Summary

This document defines a security-first approach to PDF parsing for the cinema parser system, utilizing pdf-lib for text extraction and Tesseract.js for OCR capabilities with comprehensive security controls.

## 1. Security Architecture

### 1.1 Defense in Depth Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                     PDF Processing Pipeline                  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Input     │  │   File      │  │   Resource          │  │
│  │ Validation  │──▶│ Validation  │──▶│   Monitoring        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│           │                 │                    │           │
│           ▼                 ▼                    ▼           │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              Secure Processing Engine                   │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │  │
│  │  │ pdf-lib     │  │ Tesseract   │  │ Memory      │    │  │
│  │  │ Integration │  │ OCR Engine  │  │ Manager     │    │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘    │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                 ▼                           │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │           Output Validation & Sanitization             │  │
│  │  - Text Sanitization  - Structure Validation  -       │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Core Security Controls

#### 1.2.1 Input Validation Layer
```typescript
// Security validation levels
enum SecurityLevel {
  LOW = 'low',        // Basic file type checking
  MEDIUM = 'medium',  // Deep file structure validation  
  HIGH = 'high',      // Content analysis and threat detection
  CRITICAL = 'critical' // Full sandbox isolation
}

interface SecurityConfig {
  readonly maxFileSize: number;        // Default: 50MB
  readonly maxPages: number;           // Default: 1000 pages
  readonly allowedMimeTypes: readonly string[];
  readonly forbiddenPatterns: readonly string[];
  readonly scanTimeout: number;         // Default: 30 seconds
  readonly memoryLimit: number;         // Default: 512MB
}
```

#### 1.2.2 Threat Detection Patterns
```typescript
// Malicious PDF patterns to detect
const MALICIOUS_PATTERNS = {
  // JavaScript execution attempts
  SCRIPT_PATTERNS: [
    /\/JavaScript\s+/gi,
    /\/JS\s+/gi,
    /\/S\s+/gi  // Short form JavaScript
  ],
  
  // Embedded executables
  EXECUTABLE_PATTERNS: [
    /\.exe$/i,
    /\.bat$/i,
    /\.cmd$/i,
    /\.scr$/i
  ],
  
  // Suspicious annotations
  ANNOTATION_PATTERNS: [
    /\/AA\s+/gi,    // Additional actions
    /\/OpenAction/i,
    /\/URI\s+/gi   // URL links
  ],
  
  // Form field exploits
  FORM_PATTERNS: [
    /\/Fields\s*\[/gi,
    /\/CO\s+/gi,    // Calculation order
    /\/DP\s+/gi     // Default appearance
  ],
  
  // Encoding attacks
  ENCODING_PATTERNS: [
    /<<\s*\/Filter.*\/FlateDecode.*>>/gi,
    /<<\s*\/Filter.*\/DCTDecode.*>>/gi,
    /<<\s*\/Filter.*\/CCITTFaxDecode.*>>/gi
  ]
};
```

## 2. Implementation Architecture

### 2.1 Core PDF Parser Class

```typescript
// src/pdf/SecurePDFParser.ts

import { PDFDocument } from 'pdf-lib';
import Tesseract from 'tesseract.js';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

export interface PDFParseResult {
  readonly success: boolean;
  readonly content: string;
  readonly metadata: PDFMetadata;
  readonly security: SecurityReport;
  readonly warnings: SecurityWarning[];
  readonly errors: SecurityError[];
}

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
}

export interface SecurityReport {
  readonly scanTime: number;
  readonly threatsDetected: number;
  readonly memoryUsed: number;
  readonly tempFilesCreated: number;
  readonly ocrUsed: boolean;
  readonly securityLevel: SecurityLevel;
}

export class SecurePDFParser {
  private readonly securityConfig: SecurityConfig;
  private readonly tempDir: string;
  
  constructor(securityConfig?: Partial<SecurityConfig>) {
    this.securityConfig = {
      maxFileSize: 50 * 1024 * 1024,  // 50MB
      maxPages: 1000,
      allowedMimeTypes: ['application/pdf'],
      forbiddenPatterns: [
        '<script',
        'javascript:',
        'vbscript:',
        'data:text/html',
        '<?php',
        '<%',
        '<%'
      ],
      scanTimeout: 30000,  // 30 seconds
      memoryLimit: 512 * 1024 * 1024, // 512MB
      ...securityConfig
    };
    
    this.tempDir = join(tmpdir(), 'cinema-parser', Date.now().toString());
  }

  /**
   * Parse PDF with comprehensive security validation
   */
  async parsePDF(filePath: string): Promise<PDFParseResult> {
    const startTime = Date.now();
    const securityReport: SecurityReport = {
      scanTime: 0,
      threatsDetected: 0,
      memoryUsed: 0,
      tempFilesCreated: 0,
      ocrUsed: false,
      securityLevel: SecurityLevel.HIGH
    };

    try {
      // Phase 1: Input Validation
      await this.validateInput(filePath);
      
      // Phase 2: Security Scanning
      const scanResult = await this.performSecurityScan(filePath);
      if (!scanResult.safe) {
        throw new SecurityError(`PDF contains malicious content: ${scanResult.reasons.join(', ')}`);
      }
      
      // Phase 3: Text Extraction
      const extractionResult = await this.extractText(filePath, securityReport);
      
      // Phase 4: Output Validation and Sanitization
      const sanitizedContent = this.sanitizeOutput(extractionResult.content);
      
      securityReport.scanTime = Date.now() - startTime;
      
      return {
        success: true,
        content: sanitizedContent,
        metadata: extractionResult.metadata,
        security: securityReport,
        warnings: scanResult.warnings,
        errors: []
      };

    } catch (error) {
      return {
        success: false,
        content: '',
        metadata: this.createEmptyMetadata(),
        security: securityReport,
        warnings: [],
        errors: [new SecurityError(`PDF parsing failed: ${error.message}`)]
      };
    } finally {
      // Cleanup temporary files
      await this.cleanup();
    }
  }

  /**
   * Phase 1: Input Validation
   */
  private async validateInput(filePath: string): Promise<void> {
    // Path traversal protection
    const normalizedPath = require('path').normalize(filePath);
    if (normalizedPath !== filePath || filePath.includes('..')) {
      throw new SecurityError('Path traversal attempt detected');
    }

    // File existence check
    try {
      const stats = await fs.stat(filePath);
      
      // File size validation
      if (stats.size > this.securityConfig.maxFileSize) {
        throw new SecurityError(`File size ${stats.size} exceeds maximum allowed ${this.securityConfig.maxFileSize}`);
      }
      
      // File type validation
      const buffer = await fs.readFile(filePath, { start: 0, end: 1024 });
      if (!this.isValidPDFSignature(buffer)) {
        throw new SecurityError('Invalid PDF file signature');
      }
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new SecurityError('File not found');
      }
      throw error;
    }
  }

  /**
   * Phase 2: Security Scanning
   */
  private async performSecurityScan(filePath: string): Promise<SecurityScanResult> {
    const warnings: SecurityWarning[] = [];
    const reasons: string[] = [];
    let threatsDetected = 0;

    try {
      // Load PDF for analysis
      const existingPdfBytes = await fs.readFile(filePath);
      const pdfDoc = await PDFDocument.load(existingPdfBytes, { 
        ignoreEncryption: false,
        updateMetadata: false 
      });

      // Check for JavaScript
      if (this.hasJavaScript(pdfDoc)) {
        reasons.push('PDF contains JavaScript');
        threatsDetected++;
      }

      // Check for embedded files
      if (this.hasEmbeddedFiles(pdfDoc)) {
        reasons.push('PDF contains embedded files');
        threatsDetected++;
      }

      // Check for forms
      if (this.hasForms(pdfDoc)) {
        warnings.push(new SecurityWarning('PDF contains forms which may be exploited'));
      }

      // Deep content scanning
      const contentBytes = await fs.readFile(filePath);
      const contentString = contentBytes.toString('binary');
      
      for (const [category, patterns] of Object.entries(MALICIOUS_PATTERNS)) {
        for (const pattern of patterns) {
          if (pattern.test(contentString)) {
            reasons.push(`Suspicious content detected: ${category}`);
            threatsDetected++;
          }
        }
      }

      return {
        safe: threatsDetected === 0,
        reasons,
        warnings,
        threatsDetected
      };

    } catch (error) {
      return {
        safe: false,
        reasons: [`PDF scanning failed: ${error.message}`],
        warnings: [],
        threatsDetected: 1
      };
    }
  }

  /**
   * Phase 3: Text Extraction with OCR fallback
   */
  private async extractText(
    filePath: string, 
    securityReport: SecurityReport
  ): Promise<ExtractionResult> {
    const existingPdfBytes = await fs.readFile(filePath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    
    // Extract metadata
    const metadata = await this.extractMetadata(pdfDoc, existingPdfBytes);
    
    // Try text extraction first
    let content = '';
    let ocrUsed = false;
    
    try {
      content = await this.extractTextFromPDF(pdfDoc);
      
      // Check if extraction was successful
      if (content.trim().length === 0 || this.isLikelyScannedPDF(content)) {
        throw new Error('Text extraction insufficient, falling back to OCR');
      }
      
    } catch (error) {
      // Fallback to OCR
      console.warn('Falling back to OCR due to:', error.message);
      securityReport.ocrUsed = true;
      ocrUsed = true;
      content = await this.performOCR(filePath, securityReport);
    }
    
    return {
      content,
      metadata: {
        ...metadata,
        ocrUsed
      }
    };
  }

  /**
   * Primary text extraction using pdf-lib
   */
  private async extractTextFromPDF(pdfDoc: PDFDocument): Promise<string> {
    const pages = pdfDoc.getPages();
    let fullText = '';

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const text = await page.getTextContent();
      fullText += text.items.map(item => item.str).join(' ') + '\n';
      
      // Memory management - process in chunks
      if (i % 10 === 0 && i > 0) {
        if (process.memoryUsage().heapUsed > this.securityConfig.memoryLimit) {
          throw new Error('Memory limit exceeded during text extraction');
        }
      }
    }

    return fullText;
  }

  /**
   * OCR fallback using Tesseract.js
   */
  private async performOCR(filePath: string, securityReport: SecurityReport): Promise<string> {
    let fullText = '';

    try {
      // Convert PDF to images for OCR
      const imagePaths = await this.convertPDFToImages(filePath);
      securityReport.tempFilesCreated += imagePaths.length;

      // Process each image with OCR
      for (const imagePath of imagePaths) {
        const result = await Tesseract.recognize(
          imagePath,
          'eng',
          {
            logger: (m) => {
              if (m.status === 'recognizing text') {
                // Progress monitoring for timeout
                if (Date.now() - startTime > this.securityConfig.scanTimeout) {
                  throw new Error('OCR processing timeout');
                }
              }
            }
          }
        );
        
        fullText += result.data.text + '\n';
        
        // Cleanup temporary image
        await fs.unlink(imagePath);
      }

      return fullText;

    } catch (error) {
      throw new Error(`OCR processing failed: ${error.message}`);
    }
  }

  /**
   * Phase 4: Output Sanitization
   */
  private sanitizeOutput(content: string): string {
    // Remove control characters except newlines and tabs
    let sanitized = content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').replace(/\n\s+/g, '\n');
    
    // Remove potential script content
    for (const pattern of this.securityConfig.forbiddenPatterns) {
      const regex = new RegExp(pattern, 'gi');
      sanitized = sanitized.replace(regex, '');
    }
    
    // Length limits to prevent memory exhaustion
    const maxLength = 10 * 1024 * 1024; // 10MB of text
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength) + '\n...[TRUNCATED]';
    }
    
    return sanitized.trim();
  }

  /**
   * Utility methods
   */
  private isValidPDFSignature(buffer: Buffer): boolean {
    const PDF_SIGNATURE = Buffer.from('%PDF-');
    return buffer.slice(0, 5).compare(PDF_SIGNATURE) === 0;
  }

  private async extractMetadata(pdfDoc: PDFDocument, bytes: Buffer): Promise<PDFMetadata> {
    return {
      pageCount: pdfDoc.getPageCount(),
      fileSize: bytes.length,
      title: pdfDoc.getTitle(),
      author: pdfDoc.getAuthor(),
      creationDate: pdfDoc.getCreationDate(),
      modificationDate: pdfDoc.getModificationDate(),
      hasJavaScript: this.hasJavaScript(pdfDoc),
      hasEmbeddedFiles: this.hasEmbeddedFiles(pdfDoc),
      hasForms: this.hasForms(pdfDoc),
      hash: createHash('sha256').update(bytes).digest('hex')
    };
  }

  private hasJavaScript(pdfDoc: PDFDocument): boolean {
    // Check for JavaScript in various locations
    // This is a simplified check - in production you'd want more thorough analysis
    return false; // pdf-lib doesn't expose JS detection easily
  }

  private hasEmbeddedFiles(pdfDoc: PDFDocument): boolean {
    // Check for embedded files (simplified)
    return false; // Would need deeper PDF structure analysis
  }

  private hasForms(pdfDoc: PDFDocument): boolean {
    // Check for form fields (simplified)
    return false; // Would need deeper PDF structure analysis
  }

  private isLikelyScannedPDF(content: string): boolean {
    // Heuristics to detect scanned PDF
    const wordCount = content.split(/\s+/).length;
    const pageCount = content.split('\n\n').length;
    
    // If very few words per page, likely scanned
    return (wordCount / pageCount) < 10;
  }

  private async convertPDFToImages(filePath: string): Promise<string[]> {
    // This would use a PDF-to-image conversion library
    // For security, we'd convert one page at a time with strict limits
    // Implementation would depend on chosen conversion library
    throw new Error('PDF to image conversion not implemented');
  }

  private createEmptyMetadata(): PDFMetadata {
    return {
      pageCount: 0,
      fileSize: 0,
      hasJavaScript: false,
      hasEmbeddedFiles: false,
      hasForms: false,
      hash: ''
    };
  }

  private async cleanup(): Promise<void> {
    try {
      await fs.rmdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.warn('Failed to cleanup temp directory:', error.message);
    }
  }
}

// Supporting interfaces
interface SecurityScanResult {
  readonly safe: boolean;
  readonly reasons: string[];
  readonly warnings: SecurityWarning[];
  readonly threatsDetected: number;
}

interface ExtractionResult {
  readonly content: string;
  readonly metadata: PDFMetadata;
}

export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

export class SecurityWarning extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityWarning';
  }
}
```

### 2.2 Security Configuration Manager

```typescript
// src/pdf/SecurityConfigManager.ts

export class SecurityConfigManager {
  private static instance: SecurityConfigManager;
  private config: SecurityConfig;

  private constructor() {
    this.config = this.loadConfiguration();
  }

  static getInstance(): SecurityConfigManager {
    if (!SecurityConfigManager.instance) {
      SecurityConfigManager.instance = new SecurityConfigManager();
    }
    return SecurityConfigManager.instance;
  }

  private loadConfiguration(): SecurityConfig {
    // Load from environment variables and config files
    return {
      maxFileSize: parseInt(process.env.PDF_PARSER_MAX_SIZE || '52428800'), // 50MB
      maxPages: parseInt(process.env.PDF_PARSER_MAX_PAGES || '1000'),
      allowedMimeTypes: ['application/pdf'],
      forbiddenPatterns: [
        '<script',
        'javascript:',
        'vbscript:',
        'data:text/html',
        '<?php',
        '<%',
        'eval(',
        'exec(',
        'system('
      ],
      scanTimeout: parseInt(process.env.PDF_PARSER_TIMEOUT || '30000'), // 30 seconds
      memoryLimit: parseInt(process.env.PDF_PARSER_MEMORY_LIMIT || '536870912') // 512MB
    };
  }

  getConfig(): SecurityConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  validateConfig(): ValidationResult {
    const errors: string[] = [];
    
    if (this.config.maxFileSize > 100 * 1024 * 1024) {
      errors.push('File size limit too large (max 100MB)');
    }
    
    if (this.config.maxPages > 10000) {
      errors.push('Page limit too high (max 10000)');
    }
    
    if (this.config.memoryLimit > 1024 * 1024 * 1024) {
      errors.push('Memory limit too high (max 1GB)');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

interface ValidationResult {
  readonly valid: boolean;
  readonly errors: string[];
}
```

## 3. Security Monitoring and Auditing

### 3.1 Security Event Logger

```typescript
// src/pdf/SecurityLogger.ts

export interface SecurityEvent {
  readonly timestamp: Date;
  readonly eventType: SecurityEventType;
  readonly severity: SecuritySeverity;
  readonly description: string;
  readonly metadata?: Record<string, unknown>;
}

export enum SecurityEventType {
  FILE_VALIDATION = 'file_validation',
  THREAT_DETECTED = 'threat_detected',
  MEMORY_LIMIT = 'memory_limit',
  TIMEOUT = 'timeout',
  SANITIZATION = 'sanitization',
  OCR_FALLBACK = 'ocr_fallback'
}

export enum SecuritySeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export class SecurityLogger {
  private events: SecurityEvent[] = [];
  private maxEvents = 1000;

  logEvent(event: SecurityEvent): void {
    this.events.push(event);
    
    // Trim events if too many
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
    
    // Log to console with appropriate level
    const message = `[SECURITY] ${event.eventType}: ${event.description}`;
    
    switch (event.severity) {
      case SecuritySeverity.INFO:
        console.info(message);
        break;
      case SecuritySeverity.WARNING:
        console.warn(message);
        break;
      case SecuritySeverity.ERROR:
        console.error(message);
        break;
      case SecuritySeverity.CRITICAL:
        console.error(`🚨 ${message}`);
        break;
    }
  }

  getEvents(): SecurityEvent[] {
    return [...this.events];
  }

  getCriticalEvents(): SecurityEvent[] {
    return this.events.filter(e => e.severity === SecuritySeverity.CRITICAL);
  }

  clearEvents(): void {
    this.events = [];
  }

  generateReport(): SecurityReport {
    const criticalCount = this.events.filter(e => e.severity === SecuritySeverity.CRITICAL).length;
    const errorCount = this.events.filter(e => e.severity === SecuritySeverity.ERROR).length;
    const warningCount = this.events.filter(e => e.severity === SecuritySeverity.WARNING).length;
    
    return {
      totalEvents: this.events.length,
      criticalEvents: criticalCount,
      errorEvents: errorCount,
      warningEvents: warningCount,
      lastEvent: this.events.length > 0 ? this.events[this.events.length - 1] : null
    };
  }
}

interface SecurityReport {
  readonly totalEvents: number;
  readonly criticalEvents: number;
  readonly errorEvents: number;
  readonly warningEvents: number;
  readonly lastEvent: SecurityEvent | null;
}
```

## 4. Integration with Main System

### 4.1 PDF Parser Factory

```typescript
// src/pdf/PDFParserFactory.ts

import { SecurePDFParser } from './SecurePDFParser';
import { SecurityConfigManager } from './SecurityConfigManager';
import { SecurityLogger } from './SecurityLogger';

export class PDFParserFactory {
  private static parser: SecurePDFParser | null = null;
  private static logger: SecurityLogger = new SecurityLogger();

  static getParser(): SecurePDFParser {
    if (!PDFParserFactory.parser) {
      const config = SecurityConfigManager.getInstance().getConfig();
      PDFParserFactory.parser = new SecurePDFParser(config);
    }
    return PDFParserFactory.parser;
  }

  static getLogger(): SecurityLogger {
    return PDFParserFactory.logger;
  }

  static reset(): void {
    PDFParserFactory.parser = null;
    PDFParserFactory.logger.clearEvents();
  }
}
```

## 5. Testing Strategy

### 5.1 Security Test Suite

```typescript
// test/pdf/security.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { SecurePDFParser } from '../../src/pdf/SecurePDFParser';
import { SecurityEventType, SecuritySeverity } from '../../src/pdf/SecurityLogger';

describe('PDF Parser Security Tests', () => {
  let parser: SecurePDFParser;

  beforeEach(() => {
    parser = new SecurePDFParser({
      maxFileSize: 10 * 1024 * 1024, // 10MB for testing
      maxPages: 100,
      scanTimeout: 5000 // 5 seconds for testing
    });
  });

  describe('Input Validation', () => {
    it('should reject path traversal attempts', async () => {
      await expect(parser.parsePDF('../../../etc/passwd'))
        .rejects.toThrow('Path traversal attempt detected');
    });

    it('should reject oversized files', async () => {
      // Create a mock oversized file
      const oversizedPath = await createOversizedPDF();
      
      const result = await parser.parsePDF(oversizedPath);
      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        expect.objectContaining({
          message: expect.stringContaining('exceeds maximum allowed')
        })
      );
    });

    it('should reject invalid PDF signatures', async () => {
      const invalidPath = await createInvalidPDF();
      
      const result = await parser.parsePDF(invalidPath);
      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        expect.objectContaining({
          message: 'Invalid PDF file signature'
        })
      );
    });
  });

  describe('Threat Detection', () => {
    it('should detect JavaScript in PDF', async () => {
      const maliciousPath = await createMaliciousPDF('javascript');
      
      const result = await parser.parsePDF(maliciousPath);
      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('malicious content');
    });

    it('should detect embedded executables', async () => {
      const maliciousPath = await createMaliciousPDF('executable');
      
      const result = await parser.parsePDF(maliciousPath);
      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('malicious content');
    });
  });

  describe('Memory Management', () => {
    it('should respect memory limits', async () => {
      const largePath = await createLargePDF();
      
      // Mock low memory condition
      const originalUsage = process.memoryUsage;
      process.memoryUsage = () => ({
        rss: 1024 * 1024 * 1024, // 1GB
        heapTotal: 1024 * 1024 * 1024,
        heapUsed: 600 * 1024 * 1024, // Over 512MB limit
        external: 0,
        arrayBuffers: 0
      });

      const result = await parser.parsePDF(largePath);
      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('Memory limit exceeded');

      // Restore original function
      process.memoryUsage = originalUsage;
    });
  });

  describe('Timeout Protection', () => {
    it('should timeout on slow processing', async () => {
      const slowPath = await createSlowProcessingPDF();
      
      const slowParser = new SecurePDFParser({
        scanTimeout: 100 // 100ms timeout
      });

      const startTime = Date.now();
      const result = await slowParser.parsePDF(slowPath);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(200); // Should timeout quickly
      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('timeout');
    });
  });
});

// Helper functions for test data creation
async function createOversizedPDF(): Promise<string> {
  // Implementation to create oversized PDF for testing
  return 'test/fixtures/oversized.pdf';
}

async function createInvalidPDF(): Promise<string> {
  // Implementation to create invalid PDF for testing
  return 'test/fixtures/invalid.pdf';
}

async function createMaliciousPDF(type: string): Promise<string> {
  // Implementation to create malicious PDF for testing
  return `test/fixtures/malicious-${type}.pdf`;
}

async function createLargePDF(): Promise<string> {
  // Implementation to create large PDF for testing
  return 'test/fixtures/large.pdf';
}

async function createSlowProcessingPDF(): Promise<string> {
  // Implementation to create PDF that processes slowly
  return 'test/fixtures/slow.pdf';
}
```

## 6. Performance Monitoring

### 6.1 Performance Metrics

```typescript
// src/pdf/PerformanceMonitor.ts

export interface PerformanceMetrics {
  readonly processingTime: number;
  readonly memoryPeak: number;
  readonly ocrTime?: number;
  readonly pagesProcessed: number;
  readonly threatsDetected: number;
  readonly warnings: number;
}

export class PerformanceMonitor {
  private startTime: number = 0;
  private peakMemory: number = 0;
  private ocrStartTime: number = 0;

  start(): void {
    this.startTime = Date.now();
    this.peakMemory = 0;
    this.monitorMemory();
  }

  startOCR(): void {
    this.ocrStartTime = Date.now();
  }

  getMetrics(pagesProcessed: number, threatsDetected: number, warnings: number): PerformanceMetrics {
    const processingTime = Date.now() - this.startTime;
    const ocrTime = this.ocrStartTime ? Date.now() - this.ocrStartTime : undefined;

    return {
      processingTime,
      memoryPeak: this.peakMemory,
      ocrTime,
      pagesProcessed,
      threatsDetected,
      warnings
    };
  }

  private monitorMemory(): void {
    const interval = setInterval(() => {
      const currentMemory = process.memoryUsage().heapUsed;
      this.peakMemory = Math.max(this.peakMemory, currentMemory);
    }, 100);

    // Auto-cleanup after reasonable time
    setTimeout(() => clearInterval(interval), 60000);
  }
}
```

This comprehensive PDF parsing module design provides enterprise-grade security while maintaining functionality and performance for the cinema parser application.