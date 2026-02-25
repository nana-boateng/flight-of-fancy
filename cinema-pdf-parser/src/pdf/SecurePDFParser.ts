/**
 * Secure PDF Parser with security validation
 * Note: Simplified implementation for demonstration
 * In production, would integrate pdf-lib and tesseract.js
 */

import type {
  PDFParseResult,
  PDFMetadata,
  PDFSecurityConfig,
  PDFSecurityReport,
  PDFSecurityWarning,
  SecurityScanResult,
  ExtractionResult,
  PerformanceMetrics,
} from '../types/pdf';
import { ErrorSeverity } from '../types/common';

/**
 * Malicious PDF patterns to detect
 */
const MALICIOUS_PATTERNS = {
  SCRIPT_PATTERNS: [/\/JavaScript\s+/gi, /\/JS\s+/gi, /\/S\s+/gi],
  EXECUTABLE_PATTERNS: [/\.exe$/i, /\.bat$/i, /\.cmd$/i, /\.scr$/i],
  ANNOTATION_PATTERNS: [/\/AA\s+/gi, /\/OpenAction/i, /\/URI\s+/gi],
  FORM_PATTERNS: [/\/Fields\s*\[/gi, /\/CO\s+/gi, /\/DP\s+/gi],
  ENCODING_PATTERNS: [
    /<<\s*\/Filter.*\/FlateDecode.*>>/gi,
    /<<\s*\/Filter.*\/DCTDecode.*>>/gi,
    /<<\s*\/Filter.*\/CCITTFaxDecode.*>>/gi,
  ],
};

/**
 * Secure PDF Parser
 */
export class SecurePDFParser {
  private readonly securityConfig: PDFSecurityConfig;
  private readonly tempDir: string;

  constructor(securityConfig?: Partial<PDFSecurityConfig>) {
    this.securityConfig = {
      maxFileSize: 50 * 1024 * 1024, // 50MB
      maxPages: 1000,
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
        'system(',
      ],
      scanTimeout: 30000, // 30 seconds
      memoryLimit: 512 * 1024 * 1024, // 512MB
      ...securityConfig,
    };

    // Use built-in Node.js modules (available in all environments)
    const os = require('os');
    const path = require('path');
    this.tempDir = path.join(os.tmpdir(), 'cinema-parser', Date.now().toString());
  }

  /**
   * Parse PDF with comprehensive security validation
   */
  async parsePDF(filePath: string): Promise<PDFParseResult> {
    const startTime = Date.now();
    const securityReport: PDFSecurityReport = {
      scanTime: 0,
      threatsDetected: 0,
      memoryUsed: 0,
      tempFilesCreated: 0,
      ocrUsed: false,
      securityLevel: 'high' as any,
    };

    try {
      await this.validateInput(filePath);
      const scanResult = await this.performSecurityScan(filePath);
      if (!scanResult.safe) {
        throw new Error(`PDF contains malicious content: ${scanResult.reasons.join(', ')}`);
      }

      const extractionResult = await this.extractText(filePath, securityReport);
      const sanitizedContent = this.sanitizeOutput(extractionResult.content);

      // Update security report
      securityReport.scanTime = Date.now() - startTime;

      return {
        success: true,
        content: sanitizedContent,
        metadata: extractionResult.metadata,
        security: securityReport,
        warnings: Array.from(scanResult.warnings),
        errors: [],
      };
    } catch (error: any) {
      return {
        success: false,
        content: '',
        metadata: this.createEmptyMetadata(),
        security: securityReport,
        warnings: [],
        errors: [
          {
            code: 'PDF_PARSE_ERROR',
            message: `PDF parsing failed: ${error.message}`,
            severity: 'critical' as ErrorSeverity,
            timestamp: new Date(),
            name: 'PDFSecurityError',
          },
        ],
      };
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Input validation
   */
  private async validateInput(filePath: string): Promise<void> {
    const path = require('path');
    const fs = require('fs').promises;

    // Path traversal protection
    const normalizedPath = path.resolve(filePath);
    if (normalizedPath !== filePath || filePath.includes('..')) {
      throw new Error('Path traversal attempt detected');
    }

    // File existence and size check
    const stats = await fs.stat(filePath);

    if (stats.size > this.securityConfig.maxFileSize) {
      throw new Error(`File size exceeds maximum allowed`);
    }

    // PDF signature validation
    const buffer = await fs.readFile(filePath, { start: 0, end: 1024 });
    if (!this.isValidPDFSignature(buffer)) {
      throw new Error('Invalid PDF file signature');
    }
  }

  /**
   * Security scanning
   */
  private async performSecurityScan(filePath: string): Promise<SecurityScanResult> {
    const warnings: PDFSecurityWarning[] = [];
    const reasons: string[] = [];
    let threatsDetected = 0;

    try {
      const fs = require('fs').promises;
      const existingPdfBytes = await fs.readFile(filePath);

      const contentString = existingPdfBytes.toString('binary');

      // Scan for malicious patterns
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
        threatsDetected,
      };
    } catch (error: any) {
      return {
        safe: false,
        reasons: [`PDF scanning failed: ${error.message}`],
        warnings: [],
        threatsDetected: 1,
      };
    }
  }

  /**
   * Text extraction with OCR fallback
   */
  private async extractText(
    filePath: string,
    securityReport: PDFSecurityReport
  ): Promise<ExtractionResult> {
    const fs = require('fs').promises;
    const path = require('path');
    const crypto = require('crypto');

    const existingPdfBytes = await fs.readFile(filePath);

    // Extract metadata
    const metadata: PDFMetadata = {
      pageCount: 1, // Simplified - would use pdf-lib
      fileSize: existingPdfBytes.length,
      hash: crypto.createHash('sha256').update(existingPdfBytes).digest('hex'),
      ocrUsed: false,
      textConfidence: 1.0,
      hasJavaScript: false,
      hasEmbeddedFiles: false,
      hasForms: false,
    };

    // Simplified text extraction
    // In production, would use pdf-lib for proper text extraction
    let content = existingPdfBytes.toString('utf8', 6, Math.min(1000, existingPdfBytes.length));
    let ocrUsed = false;

    // Check if extraction was successful
    if (content.trim().length === 0 || this.isLikelyScannedPDF(content)) {
      console.warn('Falling back to OCR due to insufficient text extraction');
      securityReport.ocrUsed = true;
      ocrUsed = true;
      content = await this.performOCR(filePath, securityReport);
    }

    const performanceMetrics: PerformanceMetrics = {
      processingTime: Date.now(),
      memoryPeak: process.memoryUsage().heapUsed,
      pagesProcessed: 1,
      threatsDetected: 0,
      warnings: 0,
    };

    return {
      content,
      metadata: {
        ...metadata,
        ocrUsed,
      },
      ocrUsed,
      performanceMetrics,
    };
  }

  /**
   * OCR fallback (placeholder)
   */
  private async performOCR(filePath: string, securityReport: PDFSecurityReport): Promise<string> {
    // In production, would use Tesseract.js
    console.warn('OCR processing would use Tesseract.js here');
    return 'OCR processed text content';
  }

  /**
   * Output sanitization
   */
  private sanitizeOutput(content: string): string {
    let sanitized = content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    sanitized = sanitized.replace(/\s+/g, ' ').replace(/\n\s+/g, '\n');

    // Remove forbidden patterns
    for (const pattern of this.securityConfig.forbiddenPatterns) {
      const regex = new RegExp(pattern, 'gi');
      sanitized = sanitized.replace(regex, '');
    }

    // Length limits
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

  private isLikelyScannedPDF(content: string): boolean {
    const wordCount = content.split(/\s+/).length;
    const pageCount = content.split('\n\n').length;
    return wordCount / pageCount < 10;
  }

  private createEmptyMetadata(): PDFMetadata {
    return {
      pageCount: 0,
      fileSize: 0,
      hasJavaScript: false,
      hasEmbeddedFiles: false,
      hasForms: false,
      hash: '',
      ocrUsed: false,
      textConfidence: 0,
    };
  }

  private async cleanup(): Promise<void> {
    try {
      const fs = require('fs').promises;
      await fs.rmdir(this.tempDir, { recursive: true });
    } catch (error: any) {
      console.warn('Failed to cleanup temp directory:', error.message);
    }
  }
}

/**
 * PDF Parser Factory
 */
export class PDFParserFactory {
  private static parser: SecurePDFParser | null = null;

  static getParser(config?: Partial<PDFSecurityConfig>): SecurePDFParser {
    if (!PDFParserFactory.parser) {
      PDFParserFactory.parser = new SecurePDFParser(config);
    }
    return PDFParserFactory.parser;
  }

  static reset(): void {
    PDFParserFactory.parser = null;
  }
}
