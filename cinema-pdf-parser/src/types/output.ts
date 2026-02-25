// Output schema and data models

import { BaseError, ErrorSeverity, TextLocation } from './common';

/**
 * Main output structure for parsed cinema data
 */
export interface CinemaCalendarOutput {
  readonly metadata: OutputMetadata;
  readonly theatre: TheatreInfo;
  readonly period: CalendarPeriod;
  readonly movies: MovieScreening[];
  readonly constants: ConstantsReference;
  readonly processing: ProcessingInfo;
}

/**
 * Metadata about the output file
 */
export interface OutputMetadata {
  readonly version: string;
  readonly generatedAt: string; // ISO 8601 timestamp
  readonly sourceFile: SourceFileInfo;
  readonly parser: ParserInfo;
}

/**
 * Source file information
 */
export interface SourceFileInfo {
  readonly name: string;
  readonly size: number;
  readonly hash: string; // SHA-256 for integrity
  readonly pages: number;
}

/**
 * Parser information
 */
export interface ParserInfo {
  readonly version: string;
  readonly template: string;
  readonly confidence: number; // Overall confidence 0-1
}

/**
 * Theatre information
 */
export interface TheatreInfo {
  readonly id: string;
  readonly name: string;
  readonly location: TheatreLocation;
  readonly contact?: TheatreContact;
}

/**
 * Theatre location
 */
export interface TheatreLocation {
  readonly address: string;
  readonly city: string;
  readonly province: string;
  readonly country: string;
  readonly coordinates?: Coordinates;
}

/**
 * Geographic coordinates
 */
export interface Coordinates {
  readonly latitude: number;
  readonly longitude: number;
}

/**
 * Theatre contact information
 */
export interface TheatreContact {
  readonly website?: string;
  readonly phone?: string;
  readonly email?: string;
}

/**
 * Calendar period covered by the PDF
 */
export interface CalendarPeriod {
  readonly startDate: string; // ISO 8601 date
  readonly endDate: string; // ISO 8601 date
  readonly type: 'weekly' | 'monthly' | 'custom';
}

/**
 * Movie screening information
 */
export interface MovieScreening {
  readonly id: string;
  readonly movie: Movie;
  readonly screenings: Screening[];
  readonly curators: CuratorReference[];
  readonly specialEvents?: SpecialEvent[];
  readonly metadata: ScreeningMetadata;
}

/**
 * Movie details
 */
export interface Movie {
  readonly title: string;
  readonly year?: number;
  readonly director?: string;
  readonly runtime?: number; // in minutes
  readonly language?: string;
  readonly genre?: string;
  readonly country?: string;
  readonly sourceLocation: TextLocation;
}

/**
 * Individual screening information
 */
export interface Screening {
  readonly id: string;
  readonly date: string; // ISO 8601 date
  readonly time: string; // HH:MM format
  readonly format?: ScreeningFormat;
  readonly price?: string;
  readonly notes?: string;
  readonly sourceLocation: TextLocation;
}

/**
 * Screening format information
 */
export interface ScreeningFormat {
  readonly id: string; // References constants
  readonly name: string;
  readonly type: FormatType;
  readonly notes?: string;
}

/**
 * Format types
 */
export enum FormatType {
  DIGITAL = 'digital',
  FILM = 'film',
  SPECIAL = 'special',
}

/**
 * Curator reference information
 */
export interface CuratorReference {
  readonly id: string; // References constants
  readonly name: string;
  readonly collective?: CollectiveReference;
  readonly role?: string;
  readonly sourceLocation: TextLocation;
}

/**
 * Collective reference information
 */
export interface CollectiveReference {
  readonly id: string; // References constants
  readonly name: string;
  readonly description?: string;
}

/**
 * Special event information
 */
export interface SpecialEvent {
  readonly id: string;
  readonly name: string;
  readonly type: EventType;
  readonly description?: string;
  readonly series?: SeriesReference;
  readonly sourceLocation: TextLocation;
}

/**
 * Event types
 */
export enum EventType {
  SPECIAL_PRESENTATION = 'special_presentation',
  DOUBLE_BILL = 'double_bill',
  FESTIVAL = 'festival',
  RETROSPECTIVE = 'retrospective',
  GUEST_QA = 'guest_qa',
  LIVE_ACCOMPANIMENT = 'live_accompaniment',
}

/**
 * Series reference information
 */
export interface SeriesReference {
  readonly id: string; // References constants
  readonly name: string;
  readonly description?: string;
  readonly curator?: string;
}

/**
 * Screening metadata
 */
export interface ScreeningMetadata {
  readonly extractionMethod: string;
  readonly confidence: number; // 0-1
  readonly sourcePages: number[];
  readonly processingTime: number; // in milliseconds
  readonly validationWarnings?: string[];
  extractionIssues?: string[];
}

/**
 * Constants reference section
 */
export interface ConstantsReference {
  readonly formats: ConstantReference[];
  readonly curators: ConstantReference[];
  readonly collectives: ConstantReference[];
  readonly series: ConstantReference[];
}

/**
 * Constant reference
 */
export interface ConstantReference {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly isNew: boolean; // True if discovered in current parsing
}

/**
 * Processing information
 */
export interface ProcessingInfo {
  readonly totalProcessingTime: number; // in milliseconds
  readonly memoryUsed: number; // in bytes
  readonly stepsCompleted: string[];
  readonly errors: ProcessingError[];
  readonly warnings: ProcessingWarning[];
}

/**
 * Processing error
 */
export interface ProcessingError {
  readonly code: string;
  readonly message: string;
  readonly severity: ErrorSeverity;
  readonly timestamp: string;
  readonly step?: string;
}

/**
 * Processing warning
 */
export interface ProcessingWarning {
  readonly code: string;
  readonly message: string;
  readonly severity: ErrorSeverity;
  readonly timestamp: string;
  readonly step?: string;
}

/**
 * Output generation result
 */
export interface OutputResult {
  readonly success: boolean;
  readonly data?: string;
  readonly format: OutputFormat;
  readonly errors: OutputError[];
  readonly warnings: OutputWarning[];
}

/**
 * Output formats
 */
export enum OutputFormat {
  JSON = 'json',
  CSV = 'csv',
  XML = 'xml',
}

/**
 * Output error
 */
export interface OutputError extends BaseError {
  readonly name: 'OutputError';
  readonly field?: string;
}

/**
 * Output warning
 */
export interface OutputWarning extends BaseError {
  readonly name: 'OutputWarning';
  readonly field?: string;
}
