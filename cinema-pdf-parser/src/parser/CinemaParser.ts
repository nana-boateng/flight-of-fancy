// Main Cinema Parser orchestrator
import type {
  CinemaParserConfig,
  CinemaParserResult,
  CinemaCalendarOutput,
  BaseConstant,
  BaseError,
} from '../types';

import { PDFParserFactory } from '../pdf/SecurePDFParser';
import { ConstantsManager } from '../constants/ConstantsManager';
import { RevueTemplateExecutor } from '../templates/revue/RevueTemplateExecutor';
import { OutputGenerator } from '../output/OutputGenerator';

/**
 * Main Cinema Parser orchestrator
 */
export class CinemaParser {
  private readonly pdfParser: ReturnType<typeof PDFParserFactory.getParser>;
  private readonly constantsManager: ConstantsManager;
  private readonly templateExecutor: RevueTemplateExecutor;
  private readonly outputGenerator: OutputGenerator;

  constructor(constantsManager?: ConstantsManager) {
    this.pdfParser = PDFParserFactory.getParser();
    this.constantsManager = constantsManager || new ConstantsManager();
    this.templateExecutor = new RevueTemplateExecutor();
    this.outputGenerator = new OutputGenerator();
  }

  /**
   * Parse a PDF file with the given configuration
   */
  async parsePDF(filePath: string, config: CinemaParserConfig): Promise<CinemaParserResult> {
    try {
      // Initialize constants manager if not provided
      await this.constantsManager.initialize();

      // Parse PDF
      const pdfResult = await this.pdfParser.parsePDF(filePath);

      if (!pdfResult.success) {
        return {
          success: false,
          errors: pdfResult.errors.map((error) => ({
            ...error,
            name: 'BaseError',
          })),
          warnings: pdfResult.warnings.map((warning) => ({
            ...warning,
            name: 'BaseError',
          })),
        };
      }

      // Determine template based on configuration
      const templateConfig = this.getTemplateConfig(config.template);

      // Execute template
      const templateResult = await this.templateExecutor.execute({
        templateId: config.template,
        pdfContent: pdfResult.content,
        metadata: pdfResult.metadata,
        securityContext: pdfResult.security,
        executionOptions: {
          strictValidation: config.strictMode || false,
          enableFallbacks: true,
          logLevel: 'info' as any,
          onProgress: config.onProgress,
        },
      });

      if (!templateResult.success) {
        return {
          success: false,
          errors: templateResult.errors.map((error) => ({
            ...error,
            name: 'BaseError',
          })),
          warnings: templateResult.warnings.map((warning) => ({
            ...warning,
            name: 'BaseError',
          })),
        };
      }

      // Detect and process new constants
      let newConstants: BaseConstant[] = [];
      if (templateResult.data) {
        const detectedConstants = await this.constantsManager.detectConstants(pdfResult.content);
        const processResult = await this.constantsManager.processDetectedConstants(
          detectedConstants.detectedConstants
        );

        // Get the newly added constants
        for (const id of processResult.added) {
          const constant = this.constantsManager.getConstant('curator' as any, id);
          if (constant) {
            newConstants.push(constant);
          }
        }
      }

      // Generate output
      const outputData = await this.outputGenerator.generate(
        templateResult.data || [],
        config.outputFormat || 'json'
      );

      return {
        success: true,
        data: outputData,
        newConstants,
        errors: [],
        warnings: [],
      };
    } catch (error: any) {
      return {
        success: false,
        errors: [
          {
            code: 'CINEMA_PARSER_ERROR',
            message: `Cinema parser failed: ${error.message}`,
            severity: 'critical' as any,
            timestamp: new Date(),
            name: 'BaseError',
          },
        ],
        warnings: [],
      };
    }
  }

  /**
   * Get template configuration for the given template string
   */
  private getTemplateConfig(templateString: string): any {
    // Parse template string to determine theatre and specific configuration
    const [theatre, ...options] = templateString.split(':');

    switch (theatre.toLowerCase()) {
      case 'revue':
      case 'revue-cinema':
        return this.getRevueConfig(options);

      default:
        throw new Error(`Unknown template: ${templateString}`);
    }
  }

  /**
   * Get Revue Cinema configuration
   */
  private getRevueConfig(options: string[]): any {
    return {
      id: 'revue-cinema-toronto',
      name: 'Revue Cinema Toronto',
      version: '1.0.0',
      theatreType: 'independent',
      security: {
        maxExecutionTimeMs: 20000,
        maxMemoryMB: 256,
        allowedOperations: [
          'text_extraction',
          'regex_match',
          'date_parsing',
          'string_manipulation',
        ],
        regexPatterns: {
          maxComplexity: 500,
          timeoutMs: 5000,
          forbiddenPatterns: ['<script', 'javascript:', 'vbscript:'],
          maxBacktracking: 1000,
        },
        fileSystemAccess: {
          allowTempFiles: true,
          maxTempFileSize: 10485760, // 10MB
          allowedDirectories: ['/tmp', './temp'],
          sandboxEnabled: true,
        },
      },
      validation: {
        requiredFields: ['title', 'date', 'time'],
        strictMode: false,
        fieldValidators: {
          title: {
            type: 'string',
            required: true,
            minLength: 1,
            maxLength: 200,
          },
          date: {
            type: 'date',
            required: true,
            pattern: '^\\d{4}-\\d{2}-\\d{2}$',
          },
          time: {
            type: 'string',
            required: true,
            pattern: '^(0?[1-9]|1[0-2]):[0-5][0-9]\\s?(AM|PM|am|pm)$',
          },
        },
      },
      algorithm: {
        type: 'hybrid',
        steps: [
          {
            id: 'text_cleaning',
            type: 'text_cleaning',
            timeoutMs: 2000,
            config: {
              removeExtraWhitespace: true,
              normalizeLineEndings: true,
              removeControlChars: true,
            },
          },
          {
            id: 'movie_extraction',
            type: 'data_extraction',
            timeoutMs: 5000,
            config: {
              extractionRules: [
                {
                  name: 'title_and_year',
                  regex: '^([^\\n]+?)\\s*(?:\\((\\d{4})\\))?[\\s\\n]*',
                  groups: { title: 1, year: 2 },
                },
              ],
            },
          },
        ],
      },
    };
  }

  /**
   * Validate configuration
   */
  private validateConfig(config: CinemaParserConfig): void {
    if (!config.template) {
      throw new Error('Template is required');
    }

    if (config.timeout && config.timeout < 1000) {
      throw new Error('Timeout must be at least 1 second');
    }

    if (config.timeout && config.timeout > 300000) {
      throw new Error('Timeout cannot exceed 5 minutes');
    }

    if (config.maxSize && config.maxSize < 1024) {
      throw new Error('Maximum file size must be at least 1KB');
    }

    if (config.maxSize && config.maxSize > 100 * 1024 * 1024) {
      throw new Error('Maximum file size cannot exceed 100MB');
    }
  }
}
