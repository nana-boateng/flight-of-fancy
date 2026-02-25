// Constants management related types

/**
 * Base constants interface
 */
export interface BaseConstant {
  readonly id: string;
  readonly name: string;
  readonly type: ConstantType;
  readonly metadata: ConstantMetadata;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}

/**
 * Types of constants managed by system
 */
export enum ConstantType {
  CURATOR = 'curator',
  FORMAT = 'format',
  SERIES = 'series',
  COLLECTIVE = 'collective',
  GENRE = 'genre',
  LANGUAGE = 'language',
}

/**
 * Constant metadata
 */
export interface ConstantMetadata {
  readonly description?: string;
  readonly aliases: readonly string[];
  readonly source: ConstantSource;
  readonly confidence: number;
  readonly tags: readonly string[];
  readonly validationRules?: ValidationRule[];
}

/**
 * Source of constant discovery
 */
export enum ConstantSource {
  MANUAL = 'manual',
  AUTO_DETECTED = 'auto_detected',
  IMPORTED = 'imported',
  API = 'api',
}

/**
 * Validation rules for constants
 */
export interface ValidationRule {
  readonly type: ValidationType;
  readonly pattern?: string;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly allowedValues?: readonly string[];
}

/**
 * Validation types
 */
export enum ValidationType {
  REGEX = 'regex',
  LENGTH = 'length',
  ENUM = 'enum',
  CUSTOM = 'custom',
}

/**
 * Curator constant
 */
export interface CuratorConstant extends BaseConstant {
  readonly type: ConstantType.CURATOR;
  readonly collective?: string;
  readonly role?: string;
  readonly bio?: string;
}

/**
 * Format constant
 */
export interface FormatConstant extends BaseConstant {
  readonly type: ConstantType.FORMAT;
  readonly formatType: FormatType;
  readonly technicalSpecs?: TechnicalSpecs;
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
 * Technical specifications
 */
export interface TechnicalSpecs {
  readonly resolution?: string;
  readonly aspectRatio?: string;
  readonly audioFormat?: string;
  readonly subtitles?: boolean;
}

/**
 * Series constant
 */
export interface SeriesConstant extends BaseConstant {
  readonly type: ConstantType.SERIES;
  readonly curator?: string;
  readonly startDate?: Date;
  readonly endDate?: Date;
  readonly frequency?: SeriesFrequency;
}

/**
 * Series frequency
 */
export enum SeriesFrequency {
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUAL = 'annual',
  IRREGULAR = 'irregular',
}

/**
 * Collective constant
 */
export interface CollectiveConstant extends BaseConstant {
  readonly type: ConstantType.COLLECTIVE;
  readonly members?: readonly string[];
  readonly founded?: Date;
  readonly website?: string;
  readonly contact?: string;
}

/**
 * Constants store configuration
 */
export interface ConstantsStore {
  readonly curators: Record<string, CuratorConstant>;
  readonly formats: Record<string, FormatConstant>;
  readonly series: Record<string, SeriesConstant>;
  readonly collectives: Record<string, CollectiveConstant>;
  readonly genres: Record<string, BaseConstant>;
  readonly languages: Record<string, BaseConstant>;
  readonly metadata: StoreMetadata;
}

/**
 * Store metadata
 */
export interface StoreMetadata {
  readonly version: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly totalConstants: number;
  readonly checksum: string;
  readonly encryptionKeyVersion: number;
}

/**
 * Detection configuration
 */
export interface DetectionConfig {
  readonly enabled: boolean;
  readonly confidenceThreshold: number;
  readonly similarityThreshold: number;
  readonly patterns: DetectionPatterns;
  readonly machineLearning?: MLDetectionConfig;
}

/**
 * Detection patterns
 */
export interface DetectionPatterns {
  readonly curators: readonly CuratorPattern[];
  readonly formats: readonly FormatPattern[];
  readonly series: readonly SeriesPattern[];
  readonly collectives: readonly CollectivePattern[];
}

/**
 * Curator pattern
 */
export interface CuratorPattern {
  readonly regex: string;
  readonly flags: string;
  readonly context: ContextRule;
  readonly confidence: number;
  readonly examples: readonly string[];
}

/**
 * Context rule
 */
export interface ContextRule {
  readonly requiredWords?: readonly string[];
  readonly forbiddenWords?: readonly string[];
  readonly position?: TextPosition;
  readonly surroundingText?: SurroundingTextRule;
}

/**
 * Text position
 */
export enum TextPosition {
  START_OF_LINE = 'start_of_line',
  END_OF_LINE = 'end_of_line',
  ANYWHERE = 'anywhere',
  BEFORE_DATE = 'before_date',
  AFTER_MOVIE_TITLE = 'after_movie_title',
}

/**
 * Surrounding text rule
 */
export interface SurroundingTextRule {
  readonly before?: string;
  readonly after?: string;
  readonly distance?: number;
}

/**
 * Format pattern
 */
export interface FormatPattern {
  readonly regex: string;
  readonly flags: string;
  readonly formatType: FormatType;
  readonly keywords: readonly string[];
  readonly confidence: number;
}

/**
 * Series pattern
 */
export interface SeriesPattern {
  readonly regex: string;
  readonly flags: string;
  readonly context: ContextRule;
  readonly confidence: number;
  readonly recurringIndicators: readonly string[];
}

/**
 * Collective pattern
 */
export interface CollectivePattern {
  readonly regex: string;
  readonly flags: string;
  readonly context: ContextRule;
  readonly confidence: number;
  readonly memberIndicators: readonly string[];
}

/**
 * ML detection configuration
 */
export interface MLDetectionConfig {
  readonly enabled: boolean;
  readonly modelPath: string;
  readonly confidenceThreshold: number;
  readonly trainingData?: string;
}

/**
 * Detection result
 */
export interface DetectionResult {
  readonly detectedConstants: DetectedConstant[];
  readonly confidence: number;
  readonly processingTime: number;
  readonly errors: DetectionError[];
}

/**
 * Detected constant
 */
export interface DetectedConstant {
  readonly type: ConstantType;
  readonly value: string;
  readonly confidence: number;
  readonly sourceLocation: any;
  readonly context: string;
  readonly matchedPattern: string;
}

/**
 * Detection error
 */
export interface DetectionError {
  readonly message: string;
  readonly pattern?: string;
  readonly location?: any;
}

/**
 * Conflict resolution
 */
export interface ConflictResolution {
  readonly strategy: ConflictStrategy;
  readonly similarityScore: number;
  readonly resolution: ConflictResult;
}

/**
 * Conflict strategies
 */
export enum ConflictStrategy {
  MERGE = 'merge',
  REPLACE = 'replace',
  KEEP_BOTH = 'keep_both',
  MANUAL_REVIEW = 'manual_review',
}

/**
 * Conflict result
 */
export interface ConflictResult {
  readonly action: ConflictStrategy;
  readonly modifiedConstant?: BaseConstant;
  readonly createdConstant?: BaseConstant;
  readonly reason: string;
}

/**
 * Similarity result
 */
export interface SimilarityResult {
  readonly score: number;
  readonly algorithm: SimilarityAlgorithm;
  readonly details: SimilarityDetails;
}

/**
 * Similarity algorithms
 */
export enum SimilarityAlgorithm {
  LEVENSHTEIN = 'levenshtein',
  JARO_WINKLER = 'jaro_winkler',
  COSINE = 'cosine',
  JACCARD = 'jaccard',
  HYBRID = 'hybrid',
}

/**
 * Similarity details
 */
export interface SimilarityDetails {
  readonly commonWords: readonly string[];
  readonly lengthDifference: number;
  readonly characterSimilarity: number;
  readonly wordSimilarity: number;
}

/**
 * Import/Export result
 */
export interface ProcessDetectedResult {
  readonly added: readonly string[];
  readonly conflicts: readonly ConflictResolution[];
  readonly errors: readonly string[];
}

/**
 * Import result
 */
export interface ImportResult {
  readonly imported: readonly string[];
  readonly conflicts: readonly string[];
  readonly errors: readonly string[];
}
