// Output Generator with validation and security
import type {
  CinemaCalendarOutput,
  ExtractedScreeningData,
  OutputFormat,
  OutputResult,
} from '../types';

/**
 * Output Generator with security sanitization
 */
export class OutputGenerator {
  /**
   * Generate output in the specified format
   */
  async generate(
    data: ExtractedScreeningData[],
    format: OutputFormat = 'json'
  ): Promise<CinemaCalendarOutput> {
    // Create structured output
    const output: CinemaCalendarOutput = {
      metadata: this.createMetadata(),
      theatre: this.createTheatreInfo(),
      period: this.createPeriod(data),
      movies: this.processMovies(data),
      constants: this.createConstantsReference(data),
      processing: this.createProcessingInfo(),
    };

    return output;
  }

  /**
   * Create output metadata
   */
  private createMetadata() {
    return {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      sourceFile: {
        name: 'calendar.pdf', // Would be extracted from actual file
        size: 2048576, // Would be extracted from actual file
        hash: 'a1b2c3d4e5f6', // Would be calculated from actual file
        pages: 2,
      },
      parser: {
        version: '1.0.0',
        template: 'revue-cinema-toronto',
        confidence: 0.95,
      },
    };
  }

  /**
   * Create theatre information
   */
  private createTheatreInfo() {
    return {
      id: 'revue_cinema',
      name: 'Revue Cinema',
      location: {
        address: '400 Roncesvalles Ave',
        city: 'Toronto',
        province: 'ON',
        country: 'Canada',
      },
      contact: {
        website: 'https://revuecinema.ca',
        phone: '416-531-9957',
      },
    };
  }

  /**
   * Create calendar period
   */
  private createPeriod(data: ExtractedScreeningData[]) {
    // Extract dates from screenings to determine period
    const dates: string[] = [];

    for (const screening of data) {
      for (const screening of screening.screenings) {
        dates.push(screening.date.toISOString().split('T')[0]);
      }
    }

    if (dates.length === 0) {
      return {
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        type: 'weekly',
      };
    }

    dates.sort();
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];

    // Determine type based on date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    let type: 'weekly' | 'monthly' | 'custom' = 'weekly';
    if (daysDiff > 7 && daysDiff <= 31) {
      type = 'monthly';
    } else if (daysDiff > 31) {
      type = 'custom';
    }

    return {
      startDate,
      endDate,
      type,
    };
  }

  /**
   * Process movies for output
   */
  private processMovies(data: ExtractedScreeningData[]) {
    return data.map((screening) => ({
      id: this.generateId('movie'),
      movie: {
        title: this.sanitizeText(screening.movie.title),
        year: screening.movie.year,
        director: screening.movie.director
          ? this.sanitizeText(screening.movie.director)
          : undefined,
        runtime: screening.movie.runtime,
        language: screening.movie.language,
        genre: screening.movie.genre,
        country: screening.movie.country,
        sourceLocation: screening.movie.sourceLocation,
      },
      screenings: screening.screenings.map((s) => ({
        id: this.generateId('screening'),
        date: s.date.toISOString().split('T')[0],
        time: s.time,
        format: s.format
          ? {
              id: this.generateId('format'),
              name: this.sanitizeText(s.format || ''),
              type: this.getFormatType(s.format || ''),
            }
          : undefined,
        price: s.price ? this.sanitizeText(s.price) : undefined,
        notes: s.notes ? this.sanitizeText(s.notes) : undefined,
        sourceLocation: s.sourceLocation,
      })),
      curators: screening.curators.map((c) => ({
        id: this.generateId('curator'),
        name: this.sanitizeText(c.name),
        collective: c.collective
          ? {
              id: this.generateId('collective'),
              name: this.sanitizeText(c.collective),
            }
          : undefined,
        role: c.role ? this.sanitizeText(c.role) : undefined,
        sourceLocation: c.sourceLocation,
      })),
      specialEvents: screening.specialEvents?.map((e) => ({
        id: this.generateId('event'),
        name: this.sanitizeText(e.name),
        type: this.getEventType(e.type),
        description: e.description ? this.sanitizeText(e.description) : undefined,
        series: e.series
          ? {
              id: this.generateId('series'),
              name: this.sanitizeText(e.series),
            }
          : undefined,
        sourceLocation: e.sourceLocation,
      })),
      metadata: {
        extractionMethod: screening.metadata.extractionMethod,
        confidence: screening.metadata.confidence,
        sourcePages: screening.metadata.sourcePages,
        processingTime: screening.metadata.processingTime,
        validationWarnings: [],
        extractionIssues: [],
      },
    }));
  }

  /**
   * Create constants reference section
   */
  private createConstantsReference(data: ExtractedScreeningData[]) {
    // Extract unique constants from data
    const formats = new Set<string>();
    const curators = new Set<string>();
    const collectives = new Set<string>();
    const series = new Set<string>();

    for (const screening of data) {
      for (const s of screening.screenings) {
        if (s.format) {
          formats.add(s.format);
        }
      }

      for (const c of screening.curators) {
        curators.add(c.name);
        if (c.collective) {
          collectives.add(c.collective);
        }
      }

      for (const e of screening.specialEvents || []) {
        if (e.series) {
          series.add(e.series);
        }
      }
    }

    return {
      formats: Array.from(formats).map((name) => ({
        id: this.generateId('format'),
        name: this.sanitizeText(name),
        type: 'format',
        isNew: false,
      })),
      curators: Array.from(curators).map((name) => ({
        id: this.generateId('curator'),
        name: this.sanitizeText(name),
        type: 'curator',
        isNew: false,
      })),
      collectives: Array.from(collectives).map((name) => ({
        id: this.generateId('collective'),
        name: this.sanitizeText(name),
        type: 'collective',
        isNew: false,
      })),
      series: Array.from(series).map((name) => ({
        id: this.generateId('series'),
        name: this.sanitizeText(name),
        type: 'series',
        isNew: false,
      })),
    };
  }

  /**
   * Create processing information
   */
  private createProcessingInfo() {
    return {
      totalProcessingTime: 2500, // Would be calculated
      memoryUsed: process.memoryUsage().heapUsed,
      stepsCompleted: ['pdf_parsing', 'template_execution', 'output_generation'],
      errors: [],
      warnings: [],
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(type: string): string {
    return `${type}_${Date.now().toString(36)}`;
  }

  /**
   * Sanitize text to prevent XSS
   */
  private sanitizeText(text: string): string {
    if (!text) return text;

    // Remove dangerous characters and scripts
    let sanitized = text.replace(/<script[^>]*>.*?<\/script>/gi, '');
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/vbscript:/gi, '');
    sanitized = sanitized.replace(/on\\w+=/gi, '');

    // Escape HTML characters
    sanitized = sanitized.replace(/</g, '&lt;');
    sanitized = sanitized.replace(/>/g, '&gt;');
    sanitized = sanitized.replace(/"/g, '&quot;');
    sanitized = sanitized.replace(/'/g, '&#39;');

    // Remove control characters
    sanitized = sanitized.replace(/[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]/g, '');

    return sanitized.trim();
  }

  /**
   * Get format type from format string
   */
  private getFormatType(format: string): string {
    if (format.toLowerCase().includes('35mm') || format.toLowerCase().includes('70mm')) {
      return 'film';
    }
    return 'digital';
  }

  /**
   * Get event type from event type string
   */
  private getEventType(eventType: string): string {
    if (eventType.includes('SPECIAL') || eventType.includes('PRESENTATION')) {
      return 'special_presentation';
    } else if (eventType.includes('DOUBLE')) {
      return 'double_bill';
    } else if (eventType.includes('RETROSPECTIVE')) {
      return 'retrospective';
    } else if (eventType.includes('CULT')) {
      return 'cult_film';
    }
    return 'special';
  }
}
