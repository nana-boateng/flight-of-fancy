# Testing Strategy and Structure Design

## Executive Summary

This document defines a comprehensive testing strategy for the cinema PDF parser system using Vitest + Testing Library. The strategy covers unit testing, integration testing, security testing, performance testing, and CI/CD integration with rigorous quality gates and enterprise-grade testing standards.

## 1. Testing Architecture

### 1.1 Test Structure Overview

```
test/
├── unit/                      # Unit tests
│   ├── pdf/                  # PDF parser tests
│   ├── templates/             # Template engine tests
│   ├── constants/             # Constants management tests
│   ├── output/                # Output generation tests
│   └── cli/                   # CLI interface tests
├── integration/               # Integration tests
│   ├── end-to-end/          # Full workflow tests
│   ├── api/                  # API integration tests
│   └── workflows/            # Workflow integration tests
├── security/                 # Security tests
│   ├── input-validation/      # Input validation security
│   ├── path-traversal/       # Path traversal tests
│   ├── injection-attacks/    # Injection attack tests
│   └── resource-exhaustion/  # Resource limit tests
├── performance/              # Performance tests
│   ├── load/                 # Load testing
│   ├── memory/               # Memory usage tests
│   └── benchmarks/          # Benchmark tests
├── fixtures/                 # Test data and fixtures
│   ├── pdfs/                # Sample PDF files
│   ├── templates/            # Template configurations
│   ├── constants/            # Constants data
│   └── outputs/              # Expected outputs
├── mocks/                    # Mock implementations
│   ├── pdf-lib/             # PDF library mocks
│   ├── tesseract/           # OCR engine mocks
│   └── filesystem/          # File system mocks
└── test-utils/               # Testing utilities
    ├── helpers/              # Helper functions
    ├── matchers/            # Custom matchers
    └── setup/               # Test setup utilities
```

## 2. Testing Configuration

### 2.1 Vitest Configuration

```typescript
// vitest.config.ts

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reporterOnFailureOnly: true,
      exclude: [
        'node_modules/',
        'test/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/fixtures/**'
      ],
      thresholds: {
        global: {
          branches: 90,
          functions: 95,
          lines: 95,
          statements: 95
        },
        // Per-file thresholds for critical modules
        './src/pdf/': {
          branches: 95,
          functions: 100,
          lines: 100,
          statements: 100
        },
        './src/cli/security/': {
          branches: 95,
          functions: 100,
          lines: 100,
          statements: 100
        }
      }
    },
    
    // Test configuration
    include: ['test/**/*.test.ts'],
    exclude: ['test/fixtures/**', 'test/mocks/**'],
    testTimeout: 30000, // 30 seconds for integration tests
    
    // Parallel execution
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 4,
        minThreads: 1
      }
    },
    
    // Reporting
    reporter: ['verbose', 'json'],
    outputFile: 'test-results.json',
    
    // Global setup
    setupFiles: ['./test/test-utils/setup/global-setup.ts']
  },
  
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/test': resolve(__dirname, './test')
    }
  }
});
```

### 2.2 Test Utilities Setup

```typescript
// test/test-utils/setup/global-setup.ts

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// Global test setup
beforeAll(async () => {
  // Initialize test environment
  process.env.NODE_ENV = 'test';
  process.env.PDF_PARSER_MAX_SIZE = '10485760'; // 10MB for testing
  process.env.PDF_PARSER_TIMEOUT = '5000'; // 5 seconds for testing
  
  // Setup test directories
  await setupTestDirectories();
});

afterAll(async () => {
  // Cleanup test environment
  await cleanupTestDirectories();
});

beforeEach(async () => {
  // Reset mocks and environment before each test
  await resetMocks();
});

afterEach(async () => {
  // Cleanup after each test
  await cleanupTestFiles();
});

async function setupTestDirectories(): Promise<void> {
  const fs = require('fs').promises;
  const path = require('path');
  
  const testDirs = [
    'test/temp',
    'test/output',
    'test/logs',
    'test/data/constants'
  ];
  
  for (const dir of testDirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }
}

async function cleanupTestDirectories(): Promise<void> {
  const fs = require('fs').promises;
  const path = require('path');
  
  const tempDirs = [
    'test/temp',
    'test/output',
    'test/logs'
  ];
  
  for (const dir of tempDirs) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }
  }
}

async function resetMocks(): Promise<void> {
  // Reset all mocks between tests
  vi.clearAllMocks();
  vi.restoreAllMocks();
}

async function cleanupTestFiles(): Promise<void> {
  // Clean up any test-specific files
  const fs = require('fs').promises;
  const glob = require('glob');
  
  const tempFiles = await glob('test/temp/**/*');
  for (const file of tempFiles) {
    try {
      await fs.unlink(file);
    } catch (error) {
      // File might already be deleted
    }
  }
}
```

### 2.3 Custom Matchers

```typescript
// test/test-utils/matchers/index.ts

import { expect } from 'vitest';
import { SecurityViolation, ErrorSeverity } from '../../src/types';

// Custom matcher for security violations
expect.extend({
  toContainSecurityViolation(
    received: SecurityViolation[],
    expectedType: string,
    expectedSeverity?: ErrorSeverity
  ) {
    const violation = received.find(v => 
      v.type === expectedType && 
      (!expectedSeverity || v.severity === expectedSeverity)
    );

    const pass = !!violation;
    
    return {
      pass,
      message: () => pass
        ? `Expected not to contain security violation of type "${expectedType}"`
        : `Expected to contain security violation of type "${expectedType}"${expectedSeverity ? ` with severity "${expectedSeverity}"` : ''}`
    };
  },

  toBeValidPDFContent(received: string) {
    const hasValidHeader = received.startsWith('%PDF-');
    const hasValidEOF = received.includes('%%EOF');
    
    const pass = hasValidHeader && hasValidEOF;
    
    return {
      pass,
      message: () => pass
        ? `Expected content not to be a valid PDF`
        : `Expected content to be a valid PDF with header and EOF marker`
    };
  },

  toMatchDatePattern(received: string) {
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const isValidFormat = datePattern.test(received);
    const isValidDate = !isNaN(Date.parse(received));
    
    const pass = isValidFormat && isValidDate;
    
    return {
      pass,
      message: () => pass
        ? `Expected "${received}" not to be a valid date`
        : `Expected "${received}" to be a valid date in YYYY-MM-DD format`
    };
  },

  toBeWithinRange(
    received: number,
    min: number,
    max: number
  ) {
    const pass = received >= min && received <= max;
    
    return {
      pass,
      message: () => pass
        ? `Expected ${received} not to be within range [${min}, ${max}]`
        : `Expected ${received} to be within range [${min}, ${max}]`
    };
  }
});

// Export custom matchers types
declare module 'vitest' {
  interface Assertion<T = any> {
    toContainSecurityViolation(type: string, severity?: ErrorSeverity): T;
    toBeValidPDFContent(): T;
    toMatchDatePattern(): T;
    toBeWithinRange(min: number, max: number): T;
  }
}
```

## 3. Unit Testing Strategy

### 3.1 PDF Parser Unit Tests

```typescript
// test/unit/pdf/SecurePDFParser.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SecurePDFParser } from '../../../src/pdf/SecurePDFParser';
import { SecurityEventType, SecuritySeverity } from '../../../src/pdf/SecurityLogger';
import { createMockPDFFile, createMaliciousPDFFile } from '../../fixtures/pdf-fixture';

describe('SecurePDFParser', () => {
  let parser: SecurePDFParser;

  beforeEach(() => {
    parser = new SecurePDFParser({
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxPages: 100,
      scanTimeout: 5000, // 5 seconds
      memoryLimit: 256 * 1024 * 1024 // 256MB
    });
  });

  describe('Input Validation', () => {
    it('should reject path traversal attempts', async () => {
      const maliciousPaths = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32\\config\\sam',
        '/etc/shadow',
        'C:\\Windows\\System32\\drivers\\etc\\hosts'
      ];

      for (const path of maliciousPaths) {
        const result = await parser.parsePDF(path);
        expect(result.success).toBe(false);
        expect(result.errors).toContain(
          expect.objectContaining({
            message: expect.stringContaining('Path traversal')
          })
        );
      }
    });

    it('should reject oversized files', async () => {
      const oversizedPath = await createMockPDFFile({
        size: 20 * 1024 * 1024 // 20MB
      });

      const result = await parser.parsePDF(oversizedPath);
      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        expect.objectContaining({
          message: expect.stringContaining('exceeds maximum allowed')
        })
      );
    });

    it('should reject invalid PDF signatures', async () => {
      const invalidPath = await createMockPDFFile({
        content: 'This is not a PDF file',
        filename: 'invalid.pdf'
      });

      const result = await parser.parsePDF(invalidPath);
      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        expect.objectContaining({
          message: 'Invalid PDF file signature'
        })
      );
    });
  });

  describe('Security Scanning', () => {
    it('should detect JavaScript in PDFs', async () => {
      const maliciousPath = await createMaliciousPDFFile({
        javascript: true
      });

      const result = await parser.parsePDF(maliciousPath);
      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('malicious content');
    });

    it('should detect embedded executables', async () => {
      const maliciousPath = await createMaliciousPDFFile({
        embeddedFile: 'malware.exe'
      });

      const result = await parser.parsePDF(maliciousPath);
      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('malicious content');
    });

    it('should scan for suspicious patterns', async () => {
      const suspiciousContent = `
        %PDF-1.4
        1 0 obj
        << /Type /Catalog /Pages 2 0 R /OpenAction << /S /JavaScript /JS (app.alert('XSS')) >> >>
        endobj
      `;

      const suspiciousPath = await createMockPDFFile({
        content: suspiciousContent
      });

      const result = await parser.parsePDF(suspiciousPath);
      expect(result.success).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Memory Management', () => {
    it('should respect memory limits', async () => {
      const largePath = await createMockPDFFile({
        pageCount: 1000 // Large number of pages
      });

      // Mock high memory usage
      const originalUsage = process.memoryUsage;
      let callCount = 0;
      process.memoryUsage = vi.fn(() => ({
        rss: 1024 * 1024 * 1024,
        heapTotal: 1024 * 1024 * 1024,
        heapUsed: callCount++ < 5 ? 200 * 1024 * 1024 : 300 * 1024 * 1024, // Exceed limit
        external: 0,
        arrayBuffers: 0
      }));

      const result = await parser.parsePDF(largePath);
      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('Memory limit exceeded');

      // Restore original function
      process.memoryUsage = originalUsage;
    });
  });

  describe('Timeout Protection', () => {
    it('should timeout on slow processing', async () => {
      const slowPath = await createMockPDFFile({
        content: 'Content that causes slow processing',
        filename: 'slow.pdf'
      });

      const slowParser = new SecurePDFParser({
        scanTimeout: 100 // 100ms timeout
      });

      // Mock slow processing
      const startTime = Date.now();
      const result = await slowParser.parsePDF(slowPath);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(200); // Should timeout quickly
      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('timeout');
    });
  });

  describe('Output Sanitization', () => {
    it('should sanitize extracted text', async () => {
      const maliciousContent = `
        <script>alert('XSS')</script>
        javascript:void(0)
        data:text/html,<script>alert(1)</script>
      `;

      const maliciousPath = await createMockPDFFile({
        content: maliciousContent
      });

      const result = await parser.parsePDF(maliciousPath);
      
      if (result.success) {
        expect(result.content).not.toContain('<script>');
        expect(result.content).not.toContain('javascript:');
        expect(result.content).not.toContain('data:text/html');
      }
    });
  });
});
```

### 3.2 Template Engine Unit Tests

```typescript
// test/unit/templates/RevueTemplate.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { RevueTemplateExecutor } from '../../../src/templates/revue/RevueTemplateExecutor';
import { REVUE_TEMPLATE_CONFIG } from '../../../src/templates/revue/RevueTemplate';
import { createMockExecutionContext } from '../../fixtures/template-fixture';

describe('RevueTemplateExecutor', () => {
  let executor: RevueTemplateExecutor;

  beforeEach(() => {
    executor = new RevueTemplateExecutor();
  });

  describe('Template Configuration', () => {
    it('should have valid Revue template configuration', () => {
      expect(REVUE_TEMPLATE_CONFIG.id).toBe('revue-cinema-toronto');
      expect(REVUE_TEMPLATE_CONFIG.name).toBe('Revue Cinema Toronto');
      expect(REVUE_TEMPLATE_CONFIG.theatreType).toBe('independent');
    });

    it('should have proper security configuration', () => {
      const security = REVUE_TEMPLATE_CONFIG.security;
      
      expect(security.maxExecutionTimeMs).toBeLessThanOrEqual(30000);
      expect(security.maxMemoryMB).toBeLessThanOrEqual(512);
      expect(security.allowedOperations).toContain('text_extraction');
      expect(security.regexPatterns.forbiddenPatterns.length).toBeGreaterThan(0);
    });

    it('should have proper validation rules', () => {
      const validation = REVUE_TEMPLATE_CONFIG.validation;
      
      expect(validation.requiredFields).toContain('title');
      expect(validation.requiredFields).toContain('date');
      expect(validation.requiredFields).toContain('time');
      expect(validation.fieldValidators.title).toBeDefined();
      expect(validation.fieldValidators.date).toBeDefined();
      expect(validation.fieldValidators.time).toBeDefined();
    });
  });

  describe('PDF Processing', () => {
    it('should extract movie titles correctly', async () => {
      const pdfContent = `
        THE SEVEN SAMURAI (1954)
        Dir. Akira Kurosawa
        207 min
        
        MON 28 @ 7:30 PM
        TUE 1 @ 7:30 PM
        Introduced by Sprog
      `;

      const context = createMockExecutionContext(pdfContent);
      const result = await executor.execute(context);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.length).toBe(1);
      
      const movie = result.data![0];
      expect(movie.movie.title).toBe('THE SEVEN SAMURAI');
      expect(movie.movie.year).toBe(1954);
      expect(movie.movie.director).toBe('Akira Kurosawa');
      expect(movie.movie.runtime).toBe(207);
    });

    it('should extract screening times correctly', async () => {
      const pdfContent = `
        THE SEVEN SAMURAI (1954)
        
        MON 28 @ 7:30 PM
        TUE 1 @ 7:30 PM
        WED 2 @ 9:00 PM
      `;

      const context = createMockExecutionContext(pdfContent);
      const result = await executor.execute(context);

      expect(result.success).toBe(true);
      const screenings = result.data![0].screenings;
      expect(screenings).toHaveLength(3);
      
      expect(screenings[0].date).toMatchDatePattern();
      expect(screenings[0].time).toBe('19:30');
      expect(screenings[1].time).toBe('19:30');
      expect(screenings[2].time).toBe('21:00');
    });

    it('should extract curator information', async () => {
      const pdfContent = `
        THE SEVEN SAMURAI (1954)
        
        Introduced by Sprog
        Curated by Greg Woods
        Hosted by Rae
      `;

      const context = createMockExecutionContext(pdfContent);
      const result = await executor.execute(context);

      expect(result.success).toBe(true);
      const curators = result.data![0].curators;
      expect(curators.length).toBeGreaterThanOrEqual(1);
      expect(curators.some(c => c.name === 'Sprog')).toBe(true);
    });

    it('should handle special screening formats', async () => {
      const pdfContent = `
        BLADE RUNNER (1982)
        
        35mm presentation
        MON 28 @ 9:30 PM
      `;

      const context = createMockExecutionContext(pdfContent);
      const result = await executor.execute(context);

      expect(result.success).toBe(true);
      const screenings = result.data![0].screenings;
      expect(screenings[0].format?.name).toContain('35mm');
      expect(screenings[0].format?.type).toBe('film');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed PDF content gracefully', async () => {
      const malformedContent = 'This is not a valid PDF structure';
      const context = createMockExecutionContext(malformedContent);
      
      const result = await executor.execute(context);
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should use fallback strategies for missing screenings', async () => {
      const pdfContent = `
        THE SEVEN SAMURAI (1954)
        Dir. Akira Kurosawa
        
        No screening times listed
      `;

      const context = createMockExecutionContext(pdfContent);
      const result = await executor.execute(context);

      // Should have warnings about fallback strategies
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.code.includes('FALLBACK'))).toBe(true);
    });

    it('should validate required fields', async () => {
      const invalidContent = `
        Invalid movie entry without proper structure
      `;

      const context = createMockExecutionContext(invalidContent);
      const result = await executor.execute(context);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.message.includes('title'))).toBe(true);
    });
  });

  describe('Security', () => {
    it('should enforce execution time limits', async () => {
      // Mock slow execution
      const context = createMockExecutionContext('content', {
        enforceTimeout: true,
        timeoutMs: 100
      });

      const result = await executor.execute(context);
      
      expect(result.securityReport.maxExecutionTime).toBeLessThanOrEqual(200);
      if (!result.success) {
        expect(result.errors[0].message).toContain('timeout');
      }
    });

    it('should detect regex complexity attacks', async () => {
      const complexPattern = '.*(.*)*.*.*.*.*.*.*.*.*(.*)'; // Catastrophic backtracking
      const context = createMockExecutionContext(`content with ${complexPattern}`);

      const result = await executor.execute(context);
      
      expect(result.securityReport.violations.some(v => 
        v.type === 'regex_complexity'
      )).toBe(true);
    });
  });
});
```

## 4. Security Testing Strategy

### 4.1 Input Validation Security Tests

```typescript
// test/security/input-validation/validation.test.ts

import { describe, it, expect } from 'vitest';
import { SecurityValidator } from '../../../src/cli/security/validator';
import { ParseArguments } from '../../../src/cli/args';

describe('Input Validation Security Tests', () => {
  let validator: SecurityValidator;

  beforeEach(() => {
    validator = new SecurityValidator();
  });

  describe('Path Traversal Protection', () => {
    it('should block basic path traversal attempts', async () => {
      const maliciousPaths = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32\\config\\sam',
        '....//....//....//etc/passwd',
        '..%2F..%2F..%2Fetc%2Fpasswd',
        '..%5c..%5c..%5cwindows%5csystem32'
      ];

      for (const path of maliciousPaths) {
        const args: ParseArguments = {
          pdfFile: path,
          template: 'test',
          outputFormat: 'json',
          constantsPath: './data/',
          maxSize: 50,
          timeout: 30,
          enableOCR: true,
          strictMode: false,
          showProgress: false,
          dryRun: false,
          saveConstants: false
        };

        const result = await validator.validateInputs(args);
        expect(result.safe).toBe(false);
        expect(result.violations).toContainSecurityViolation('path_traversal', 'critical');
      }
    });

    it('should block URL-based paths', async () => {
      const urlPaths = [
        'file:///etc/passwd',
        'http://example.com/malicious.pdf',
        'ftp://attacker.com/payload.pdf',
        'data://text/plain,payload'
      ];

      for (const path of urlPaths) {
        const args: ParseArguments = {
          pdfFile: path,
          template: 'test',
          outputFormat: 'json',
          constantsPath: './data/',
          maxSize: 50,
          timeout: 30,
          enableOCR: true,
          strictMode: false,
          showProgress: false,
          dryRun: false,
          saveConstants: false
        };

        const result = await validator.validateInputs(args);
        expect(result.safe).toBe(false);
      }
    });

    it('should block null byte injection', async () => {
      const nullBytePaths = [
        'malicious.pdf\x00.jpg',
        'config.json\x00.pdf',
        'safe.pdf\x00../malicious.exe'
      ];

      for (const path of nullBytePaths) {
        const args: ParseArguments = {
          pdfFile: path,
          template: 'test',
          outputFormat: 'json',
          constantsPath: './data/',
          maxSize: 50,
          timeout: 30,
          enableOCR: true,
          strictMode: false,
          showProgress: false,
          dryRun: false,
          saveConstants: false
        };

        const result = await validator.validateInputs(args);
        expect(result.safe).toBe(false);
      }
    });
  });

  describe('Template Injection Protection', () => {
    it('should block script injection in templates', async () => {
      const maliciousTemplates = [
        '<script>alert("XSS")</script>',
        'javascript:alert("XSS")',
        'data:text/html,<script>alert(1)</script>',
        'vbscript:msgbox("XSS")',
        '${7*7}', // Expression injection
        '`whoami`', // Command injection
        'test; rm -rf /', // Command separator
        'test && cat /etc/passwd'
      ];

      for (const template of maliciousTemplates) {
        const args: ParseArguments = {
          pdfFile: 'test.pdf',
          template: template,
          outputFormat: 'json',
          constantsPath: './data/',
          maxSize: 50,
          timeout: 30,
          enableOCR: true,
          strictMode: false,
          showProgress: false,
          dryRun: false,
          saveConstants: false
        };

        const result = await validator.validateInputs(args);
        expect(result.safe).toBe(false);
        expect(result.violations).toContainSecurityViolation('injection_attempt', 'critical');
      }
    });

    it('should block SQL injection patterns', async () => {
      const sqlTemplates = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "1'; UPDATE passwords SET password='hacked' WHERE 1=1; --"
      ];

      for (const template of sqlTemplates) {
        const args: ParseArguments = {
          pdfFile: 'test.pdf',
          template: template,
          outputFormat: 'json',
          constantsPath: './data/',
          maxSize: 50,
          timeout: 30,
          enableOCR: true,
          strictMode: false,
          showProgress: false,
          dryRun: false,
          saveConstants: false
        };

        const result = await validator.validateInputs(args);
        expect(result.safe).toBe(false);
      }
    });
  });

  describe('Resource Limit Validation', () => {
    it('should flag excessive resource limits', async () => {
      const args: ParseArguments = {
        pdfFile: 'test.pdf',
        template: 'test',
        outputFormat: 'json',
        constantsPath: './data/',
        maxSize: 1000, // Excessive 1GB
        timeout: 3600, // Excessive 1 hour
        enableOCR: true,
        strictMode: false,
        showProgress: false,
        dryRun: false,
        saveConstants: false
      };

      const result = await validator.validateInputs(args);
      
      // Should not be blocked but should generate warnings
      expect(result.violations).toContainSecurityViolation('excessive_file_size', 'medium');
      expect(result.violations).toContainSecurityViolation('excessive_timeout', 'medium');
    });
  });
});
```

### 4.2 Resource Exhaustion Tests

```typescript
// test/security/resource-exhaustion/limits.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SecurePDFParser } from '../../../src/pdf/SecurePDFParser';

describe('Resource Exhaustion Security Tests', () => {
  let parser: SecurePDFParser;

  beforeEach(() => {
    parser = new SecurePDFParser({
      maxFileSize: 50 * 1024 * 1024, // 50MB
      maxPages: 100,
      scanTimeout: 30000, // 30 seconds
      memoryLimit: 512 * 1024 * 1024 // 512MB
    });
  });

  describe('Memory Exhaustion Protection', () => {
    it('should limit memory usage during parsing', async () => {
      // Mock memory usage that exceeds limit
      const originalUsage = process.memoryUsage;
      let callCount = 0;
      
      process.memoryUsage = vi.fn(() => {
        callCount++;
        return {
          rss: 1024 * 1024 * 1024,
          heapTotal: 1024 * 1024 * 1024,
          heapUsed: callCount < 10 ? 200 * 1024 * 1024 : 600 * 1024 * 1024, // Exceed limit
          external: 0,
          arrayBuffers: 0
        };
      });

      const result = await parser.parsePDF('test/fixtures/large.pdf');
      
      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('Memory limit exceeded');
      
      process.memoryUsage = originalUsage;
    });

    it('should prevent infinite loops through timeout', async () => {
      // Mock infinite processing
      const mockProcess = vi.fn().mockImplementation(() => {
        // Simulate infinite loop
        return new Promise(() => {}); // Never resolves
      });

      const slowParser = new SecurePDFParser({
        maxFileSize: 10 * 1024 * 1024,
        maxPages: 10,
        scanTimeout: 100, // 100ms timeout
        memoryLimit: 256 * 1024 * 1024
      });

      const startTime = Date.now();
      const result = await slowParser.parsePDF('test/fixtures/infinite.pdf');
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(200); // Should timeout
      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('timeout');
    });
  });

  describe('File Size Limits', () => {
    it('should reject files exceeding size limit', async () => {
      // This would be implemented with actual large file creation
      // For now, we'll mock the file size check
      const mockStats = {
        isFile: () => true,
        size: 100 * 1024 * 1024 // 100MB, exceeds 50MB limit
      };

      vi.mock('fs', () => ({
        promises: {
          stat: () => Promise.resolve(mockStats),
          readFile: () => Promise.resolve('content')
        }
      }));

      const result = await parser.parsePDF('oversized.pdf');
      
      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('exceeds maximum allowed');
    });
  });

  describe('Page Count Limits', () => {
    it('should reject PDFs with too many pages', async () => {
      // Mock PDF with excessive page count
      const result = await parser.parsePDF('test/fixtures/many-pages.pdf');
      
      // Should either fail or limit processing
      expect(result.securityReport.maxPages).toBeLessThanOrEqual(100);
    });
  });
});
```

## 5. Performance Testing

### 5.1 Load Testing

```typescript
// test/performance/load/parallel-processing.test.ts

import { describe, it, expect } from 'vitest';
import { CinemaParser } from '../../../src/parser/CinemaParser';
import { ConstantsManager } from '../../../src/constants/ConstantsManager';

describe('Load Testing', () => {
  const parser = new CinemaParser(new ConstantsManager());

  it('should handle multiple concurrent PDF processing', async () => {
    const pdfFiles = Array.from({ length: 10 }, (_, i) => `test/fixtures/test${i}.pdf`);
    
    const startTime = Date.now();
    
    const promises = pdfFiles.map(async (pdfFile, index) => {
      const result = await parser.parsePDF(pdfFile, {
        template: 'revue-cinema',
        enableOCR: false,
        strictMode: false,
        timeout: 10000,
        maxSize: 10 * 1024 * 1024
      });
      
      return { index, result };
    });

    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;
    
    // Should complete within reasonable time
    expect(duration).toBeLessThan(30000); // 30 seconds
    
    // All should succeed or fail gracefully
    results.forEach(({ index, result }) => {
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });
    
    console.log(`Processed ${pdfFiles.length} files in ${duration}ms`);
  });

  it('should maintain performance under sustained load', async () => {
    const iterations = 5;
    const filesPerIteration = 5;
    
    const durations: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const pdfFiles = Array.from({ length: filesPerIteration }, (_, j) => 
        `test/fixtures/load-test-${i}-${j}.pdf`
      );
      
      const startTime = Date.now();
      
      const promises = pdfFiles.map(pdfFile =>
        parser.parsePDF(pdfFile, {
          template: 'revue-cinema',
          enableOCR: false,
          strictMode: false,
          timeout: 10000,
          maxSize: 10 * 1024 * 1024
        })
      );
      
      await Promise.all(promises);
      const duration = Date.now() - startTime;
      durations.push(duration);
    }
    
    // Performance should not degrade significantly
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const maxDuration = Math.max(...durations);
    
    expect(maxDuration / avgDuration).toBeLessThan(2); // Not more than 2x slower
    console.log(`Average duration: ${avgDuration}ms, Max: ${maxDuration}ms`);
  });
});
```

## 6. CI/CD Integration

### 6.1 GitHub Actions Workflow

```yaml
# .github/workflows/test.yml

name: Test Suite

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Setup Bun
      uses: oven-sh/setup-bun@v1
      with:
        bun-version: latest
    
    - name: Install dependencies
      run: bun install
    
    - name: Run linting
      run: bun run lint
    
    - name: Run type checking
      run: bun run typecheck
    
    - name: Run security audit
      run: bun audit
    
    - name: Run unit tests
      run: bun run test:unit -- --coverage
    
    - name: Run integration tests
      run: bun run test:integration
    
    - name: Run security tests
      run: bun run test:security
    
    - name: Run performance tests
      run: bun run test:performance
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
        flags: unittests
        name: codecov-umbrella

  security-scan:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@master
      with:
        scan-type: 'fs'
        scan-ref: '.'
        format: 'sarif'
        output: 'trivy-results.sarif'
    
    - name: Upload Trivy scan results
      uses: github/codeql-action/upload-sarif@v2
      with:
        sarif_file: 'trivy-results.sarif'

  performance-benchmarks:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Setup Bun
      uses: oven-sh/setup-bun@v1
    
    - name: Install dependencies
      run: bun install
    
    - name: Run benchmarks
      run: bun run benchmark
    
    - name: Store benchmark results
      uses: benchmark-action/github-action-benchmark@v1
      with:
        tool: 'bun'
        output-file-path: benchmark-results.json
```

This comprehensive testing strategy ensures the cinema PDF parser system maintains high quality, security, and performance standards through rigorous automated testing at all levels.