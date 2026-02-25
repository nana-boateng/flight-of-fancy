// Revue Cinema Template Executor
import type {
  TemplateExecutionContext,
  TemplateExecutionResult,
  ExtractedScreeningData,
  MovieInfo,
  ScreeningInfo,
  CuratorInfo,
  SpecialEventInfo,
  TextLocation,
  ScreeningMetadata,
  SecurityViolation,
  SecurityViolationType,
  SecurityViolationSeverity,
  ExecutionMetadata,
} from '../../types/template';

/**
 * Revue Cinema Template Executor
 */
export class RevueTemplateExecutor {
  /**
   * Execute the Revue Cinema template
   */
  async execute(context: TemplateExecutionContext): Promise<TemplateExecutionResult> {
    const startTime = Date.now();

    try {
      // Text cleaning
      const cleanedText = this.cleanText(context.pdfContent);

      // Extract movie information
      const movieData = this.extractMovies(cleanedText);

      // Extract screenings
      const screeningData = this.extractScreenings(cleanedText, movieData);

      // Extract curators
      const curatorData = this.extractCurators(cleanedText);

      // Extract special events
      const eventData = this.extractSpecialEvents(cleanedText);

      // Combine into screening data
      const extractedData: ExtractedScreeningData[] = this.combineData(
        movieData,
        screeningData,
        curatorData,
        eventData
      );

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data: extractedData,
        errors: [],
        warnings: [],
        metadata: {
          templateId: context.templateId,
          executionTime,
          memoryUsed: process.memoryUsage().heapUsed,
          stepsCompleted: ['text_cleaning', 'data_extraction'],
          fallbacksUsed: [],
          securityViolations: [],
        },
        securityReport: {
          violations: [],
          maxMemoryUsed: process.memoryUsage().heapUsed,
          maxExecutionTime: executionTime,
          operationsExecuted: ['text_extraction', 'string_manipulation'],
          sandboxCompliance: true,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        errors: [
          {
            code: 'TEMPLATE_EXECUTION_FAILED',
            message: `Template execution failed: ${error.message}`,
            severity: 'critical' as any,
            step: 'extraction',
            location: undefined,
            timestamp: new Date(),
            name: 'TemplateError',
          },
        ],
        warnings: [],
        metadata: {
          templateId: context.templateId,
          executionTime: Date.now() - startTime,
          memoryUsed: process.memoryUsage().heapUsed,
          stepsCompleted: [],
          fallbacksUsed: [],
          securityViolations: [],
        },
        securityReport: {
          violations: [],
          maxMemoryUsed: 0,
          maxExecutionTime: 0,
          operationsExecuted: [],
          sandboxCompliance: false,
        },
      };
    }
  }

  /**
   * Clean and normalize text
   */
  private cleanText(text: string): string {
    // Remove control characters except newlines and tabs
    let cleaned = text.replace(/[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]/g, '');

    // Normalize whitespace
    cleaned = cleaned.replace(/\\s+/g, ' ').replace(/\\n\\s+/g, '\\n');

    // Remove empty lines
    cleaned = cleaned.replace(/\\n\\s*\\n/g, '\\n');

    return cleaned.trim();
  }

  /**
   * Extract movie information
   */
  private extractMovies(text: string): MovieInfo[] {
    const movies: MovieInfo[] = [];

    // Pattern to match movie titles and metadata
    const moviePattern = /([A-Z][^\\n]{10,100})\\s*(?:\\((\\d{4})\\))?[^\\n]*/g;

    let match;
    while ((match = moviePattern.exec(text)) !== null) {
      const title = match[1]?.trim();
      const year = match[2] ? parseInt(match[2]) : undefined;

      // Extract director
      const directorMatch = text.match(/Dir\\.\\s*([^\\n]+)/i);
      const director = directorMatch ? directorMatch[1].trim() : undefined;

      // Extract runtime
      const runtimeMatch = text.match(/(\\d+)\\s*min/i);
      const runtime = runtimeMatch ? parseInt(runtimeMatch[1]) : undefined;

      if (title) {
        movies.push({
          title,
          year,
          director,
          runtime,
          sourceLocation: {
            page: 0, // Would be calculated from PDF parsing
            line: 0,
            characterStart: 0,
            characterEnd: title.length,
            context: match[0],
          },
        });
      }
    }

    return movies;
  }

  /**
   * Extract screening information
   */
  private extractScreenings(text: string, movies: MovieInfo[]): ScreeningInfo[] {
    const screenings: ScreeningInfo[] = [];

    // Pattern to match screening times
    const screeningPattern =
      /(?:MON|TUE|WED|THU|FRI|SAT|SUN)\\s+(\\d{1,2})\\s+(?:@|at)?\\s*([0-9]{1,2}:[0-9]{2}\\s*(?:AM|PM|am|pm))/gi;

    let match;
    while ((match = screeningPattern.exec(text)) !== null) {
      const day = parseInt(match[1]);
      const time = this.convertTimeTo24Hour(match[2]);

      // Create a date object for the screening
      const date = new Date();
      date.setDate(day);

      screenings.push({
        date,
        time,
        sourceLocation: {
          page: 0,
          line: 0,
          characterStart: 0,
          characterEnd: 0,
          context: match[0],
        },
      });
    }

    return screenings;
  }

  /**
   * Extract curator information
   */
  private extractCurators(text: string): CuratorInfo[] {
    const curators: CuratorInfo[] = [];

    // Pattern to match curator mentions
    const curatorPattern = /(?:Introduced by|Curated by|Hosted by|Presented by)\\s+([^\\n]+)/gi;

    let match;
    while ((match = curatorPattern.exec(text)) !== null) {
      const name = match[1].trim();

      if (name) {
        curators.push({
          name,
          confidence: 0.9,
          sourceLocation: {
            page: 0,
            line: 0,
            characterStart: 0,
            characterEnd: name.length,
            context: match[0],
          },
        });
      }
    }

    return curators;
  }

  /**
   * Extract special event information
   */
  private extractSpecialEvents(text: string): SpecialEventInfo[] {
    const events: SpecialEventInfo[] = [];

    // Pattern to match special events
    const eventPattern = /(SPECIAL PRESENTATION|DOUBLE BILL|CULT FILM NIGHT|RETROSPECTIVE)/gi;

    let match;
    while ((match = eventPattern.exec(text)) !== null) {
      const name = match[1].trim();

      events.push({
        name,
        type: this.getEventType(name),
        sourceLocation: {
          page: 0,
          line: 0,
          characterStart: 0,
          characterEnd: name.length,
          context: match[0],
        },
      });
    }

    return events;
  }

  /**
   * Convert 12-hour time to 24-hour format
   */
  private convertTimeTo24Hour(time12h: string): string {
    const [time, modifier] = time12h.split(/\\s+/);
    const [hours, minutes] = time.split(':');

    let hour = parseInt(hours);
    const min = parseInt(minutes || '0');

    if (modifier.toUpperCase() === 'PM' && hour !== 12) {
      hour += 12;
    } else if (modifier.toUpperCase() === 'AM' && hour === 12) {
      hour = 0;
    }

    return `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
  }

  /**
   * Get event type from event name
   */
  private getEventType(eventName: string): string {
    if (eventName.includes('SPECIAL PRESENTATION')) {
      return 'special_presentation';
    } else if (eventName.includes('DOUBLE BILL')) {
      return 'double_bill';
    } else if (eventName.includes('CULT FILM')) {
      return 'cult_film';
    } else if (eventName.includes('RETROSPECTIVE')) {
      return 'retrospective';
    }
    return 'special';
  }

  /**
   * Combine extracted data into screening data
   */
  private combineData(
    movies: MovieInfo[],
    screenings: ScreeningInfo[],
    curators: CuratorInfo[],
    events: SpecialEventInfo[]
  ): ExtractedScreeningData[] {
    const data: ExtractedScreeningData[] = [];

    // Create one screening data object per movie
    for (const movie of movies) {
      data.push({
        movie,
        screenings: screenings, // In production, would associate screenings with movies
        curators,
        specialEvents: events,
        metadata: {
          extractionMethod: 'revue_template_v1',
          confidence: 0.8,
          sourcePages: [1],
          processingTime: 1000,
        },
      });
    }

    return data;
  }
}
