// Revue Cinema Template Configuration
import type {
  BaseTemplateConfig,
  TheatreType,
  SecurityOperation,
  RegexSecurityConfig,
  FileSystemSecurityConfig,
  ValidationType,
  FieldValidator,
  OutputSchema,
  AlgorithmType,
  StepType,
  AlgorithmStep,
  FallbackStrategy,
  ErrorHandlingConfig,
} from '../../types/template';

export const REVUE_TEMPLATE_CONFIG: BaseTemplateConfig = {
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
      SecurityOperation.STRING_MANIPULATION,
    ],
    regexPatterns: {
      maxComplexity: 500,
      timeoutMs: 5000,
      forbiddenPatterns: [
        '.*\\(.*\\).*\\(.*\\).*\\(.*\\).*', // Excessive nesting
        '.*\\*.*\\*.*\\*.*', // Catastrophic backtracking
        '.*\\{.*\\}.*\\{.*\\}.*', // Nested quantifiers
      ],
      maxBacktracking: 1000,
    },
    fileSystemAccess: {
      allowTempFiles: true,
      maxTempFileSize: 10 * 1024 * 1024, // 10MB
      allowedDirectories: ['/tmp', './temp'],
      sandboxEnabled: true,
    },
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
        pattern: '^[^<>"\\\'\\\\]*$',
        customValidator: 'movieTitle',
      },
      date: {
        type: ValidationType.DATE,
        required: true,
        pattern: '^\\d{4}-\\d{2}-\\d{2}$',
      },
      time: {
        type: ValidationType.STRING,
        required: true,
        pattern: '^(0?[1-9]|1[0-2]):[0-5][0-9]\\s?(AM|PM|am|pm)$',
      },
      curator: {
        type: ValidationType.STRING,
        required: false,
        maxLength: 100,
        customValidator: 'curatorName',
      },
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
            runtime: { type: 'number' },
          },
        },
        screenings: {
          type: 'array',
          items: {
            type: 'object',
            required: ['date', 'time'],
            properties: {
              date: { type: 'string' },
              time: { type: 'string' },
              format: { type: 'string' },
            },
          },
        },
      },
    },
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
          removeControlChars: true,
        },
      },
      {
        id: 'section_detection',
        type: StepType.PATTERN_MATCHING,
        timeoutMs: 3000,
        config: {
          patterns: [
            {
              name: 'movie_section',
              regex: '^(?:THIS WEEK|NEXT WEEK|COMING SOON)[\\s\\S]*?(?=\\n\\n|$)',
              flags: 'im',
            },
          ],
        },
      },
      {
        id: 'movie_extraction',
        type: StepType.DATA_EXTRACTION,
        timeoutMs: 5000,
        config: {
          extractionRules: [
            {
              name: 'title_and_year',
              regex: '^([^\\n]+?)\\s*(?:\\((\\d{4})\\))?[\\s\\n]*',
              groups: { title: 1, year: 2 },
            },
            {
              name: 'director',
              regex: 'Dir\\.\\s*([^\\n]+)',
              groups: { director: 1 },
            },
            {
              name: 'runtime',
              regex: '(\\d+)\\s*min',
              groups: { runtime: 1 },
            },
          ],
        },
      },
      {
        id: 'screening_extraction',
        type: StepType.DATA_EXTRACTION,
        timeoutMs: 4000,
        config: {
          extractionRules: [
            {
              name: 'screenings',
              regex:
                '(?:MON|TUE|WED|THU|FRI|SAT|SUN)\\s+(\\d{1,2})\\s+(?:@|at)?\\s*([0-9]{1,2}:[0-9]{2}\\s*(?:AM|PM|am|pm))',
              groups: { day: 1, time: 2 },
            },
          ],
        },
      },
      {
        id: 'curator_extraction',
        type: StepType.DATA_EXTRACTION,
        timeoutMs: 3000,
        config: {
          extractionRules: [
            {
              name: 'curator',
              regex: '(?:Introduced by|Curated by|Hosted by)\\s+([^\\n]+)',
              groups: { curator: 1 },
            },
          ],
        },
      },
      {
        id: 'date_resolution',
        type: StepType.TRANSFORMATION,
        timeoutMs: 2000,
        config: {
          transformation: 'resolve_relative_dates',
          referenceDate: 'current_week',
          timezone: 'America/Toronto',
        },
      },
      {
        id: 'validation',
        type: StepType.VALIDATION,
        timeoutMs: 2000,
        config: {
          strictMode: true,
          requiredFields: ['title', 'date', 'time'],
          validationRules: [
            { field: 'title', rule: 'movieTitle' },
            { field: 'date', rule: 'validDate' },
            { field: 'time', rule: 'validTime' },
          ],
        },
      },
    ],
    fallbackStrategies: [
      {
        condition: 'no_screenings_found',
        strategy: 'broader_date_patterns',
        config: {
          alternativePatterns: [
            '(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\\s+(\\d{1,2})',
            '(\\d{1,2})/[0-1]?\\d/\\d{4}',
          ],
        },
      },
      {
        condition: 'title_extraction_failed',
        strategy: 'line_based_title_detection',
        config: {
          maxLines: 3,
          titleIndicators: ['Dir.', 'min', 'Canada', 'USA'],
        },
      },
    ],
    errorHandling: {
      retryAttempts: 2,
      retryDelayMs: 1000,
      fallbackEnabled: true,
      errorMapping: {
        regex_timeout: 'use_simpler_patterns',
        date_parse_error: 'use_relative_dates',
        memory_exceeded: 'reduce_text_scope',
      },
    },
  },
};

// Revue-specific types for the template
export interface RevueTemplateConfig extends BaseTemplateConfig {
  readonly theatreType: TheatreType.INDEPENDENT;
}

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

// Revue-specific extensions to the base config
export const REVUE_EXTENDED_CONFIG: RevueTemplateConfig & {
  algorithm: {
    type: AlgorithmType.HYBRID;
    revueSpecific: RevueAlgorithmConfig;
  };
} = {
  ...REVUE_TEMPLATE_CONFIG,
  algorithm: {
    ...REVUE_TEMPLATE_CONFIG.algorithm,
    revueSpecific: {
      pdfStructure: {
        headerPatterns: ['^THE REVUE CINEMA', '^\\d+\\s+RONCESVALLES AVE', '^TORONTO, ON'],
        movieSectionStartPattern: '^THIS WEEK|^NEXT WEEK|^COMING SOON',
        screeningLinePattern: '^(?:MON|TUE|WED|THU|FRI|SAT|SUN)',
        footerPatterns: ['^revuecinema\\.ca', '^@RevueCinema', '^revuecinema'],
        pageBreakHandling: {
          strategy: 'merge',
          mergePatterns: ['-\\s*\\n\\s*', '\\n\\s*\\d+\\s*$'],
        },
      },
      dateParsing: {
        dateFormats: ['YYYY-MM-DD', 'MM/DD/YYYY', 'MMM DD, YYYY'],
        timeFormats: ['h:mm A', 'h:mm a', 'HH:mm'],
        timezoneHandling: {
          defaultTimezone: 'America/Toronto',
          enableDST: true,
          timezonePatterns: {
            EST: 'America/Toronto',
            EDT: 'America/Toronto',
          },
        },
        relativeDateHandling: {
          enabled: true,
          referencePatterns: ['THIS WEEK', 'NEXT WEEK', 'COMING SOON'],
          fallbackStrategy: 'today',
        },
      },
      movieTitleExtraction: {
        titlePatterns: [
          '^([^\\(\\n]+)', // Text before parentheses
          '^([A-Z][^\\n]{10,100})', // Capitalized lines of reasonable length
          '^([^\\n]{20,80})\\s*\\((\\d{4})\\)', // Title with year
        ],
        yearExtractionPatterns: ['\\((\\d{4})\\)', '\\s+(\\d{4})\\s+', '\\.(\\d{4})'],
        runtimeExtractionPatterns: ['(\\d+)\\s*min', '(\\d+)\\s*minutes?', '(\\d+)\\s*mins?'],
        directorExtractionPatterns: [
          'Dir\\.?\\s+([^\\n]+)',
          'Director:\\s+([^\\n]+)',
          'Directed by\\s+([^\\n]+)',
        ],
        cleanupRules: [
          {
            pattern: '^\\s+|\\s+$',
            replacement: '',
            flags: 'g',
          },
          {
            pattern: '\\s+',
            replacement: ' ',
            flags: 'g',
          },
          {
            pattern: '[\\x00-\\x1F\\x7F]',
            replacement: '',
            flags: 'g',
          },
        ],
      },
      curatorMapping: {
        curatorPatterns: [
          {
            pattern: 'Sprog',
            curatorId: 'sprog',
            confidence: 0.95,
          },
          {
            pattern: 'Rae',
            curatorId: 'rae',
            confidence: 0.9,
          },
          {
            pattern: 'Greg Woods',
            curatorId: 'greg_woods',
            confidence: 0.95,
          },
          {
            pattern: 'Kiva',
            curatorId: 'kiva',
            confidence: 0.85,
          },
          {
            pattern: 'Andrew Parker',
            curatorId: 'andrew_parker',
            confidence: 0.9,
          },
          {
            pattern: 'Angelo Muredda',
            curatorId: 'angelo_muredda',
            confidence: 0.9,
          },
          {
            pattern: 'Jason Gorber',
            curatorId: 'jason_gorber',
            confidence: 0.9,
          },
          {
            pattern: 'Chris Knipp',
            curatorId: 'chris_knipp',
            confidence: 0.9,
          },
        ],
        collectiveMapping: {
          'Third Eye Film Festival': 'third_eye',
          'Flesh of the Void': 'flesh_of_the_void',
          'Toronto After Dark': 'toronto_after_dark',
        },
        unknownCuratorHandling: 'create',
      },
      specialEventHandling: {
        eventPatterns: [
          'SPECIAL PRESENTATION',
          'RETROCOMING ATTRACTIONS',
          'DOUBLE BILL',
          'CULT FILM NIGHT',
          'SUNDAY SCREENINGS',
        ],
        screeningTypes: [
          {
            id: 'special_presentation',
            name: 'Special Presentation',
            patterns: ['SPECIAL PRESENTATION', 'SPC. PRESENT.'],
          },
          {
            id: 'double_bill',
            name: 'Double Bill',
            patterns: ['DOUBLE BILL', 'DOUBLE FEATURE', 'DOUBLE'],
          },
          {
            id: 'cult_film',
            name: 'Cult Film Night',
            patterns: ['CULT FILM', 'MIDNIGHT MOVIE'],
          },
        ],
        customHandlers: {
          double_bill: 'handleDoubleBill',
          special_presentation: 'handleSpecialPresentation',
        },
      },
    },
  },
};
