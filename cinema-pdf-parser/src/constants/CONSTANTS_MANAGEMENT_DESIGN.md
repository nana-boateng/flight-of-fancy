# Constants Management System Design

## Executive Summary

This document defines a comprehensive constants management system for the cinema PDF parser that provides automatic discovery, secure storage, and intelligent management of cinema-related entities such as curators, screening formats, series, and collectives. The system uses TypeScript enums for type safety with JSON persistence, AES-256-GCM encryption for security, and automatic conflict resolution.

## 1. System Architecture

### 1.1 Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                Constants Management System                  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Constants     │  │   Secure        │  │   Auto          │ │
│  │   Manager       │  │   Storage       │  │   Detector      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│           │                     │                     │         │
│           └─────────────────────┼─────────────────────┘         │
│                                 ▼                               │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              Security & Validation Layer                  │ │
│  │  - Encryption  - Integrity Checks  - Access Control      │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                 ▼                               │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │           Conflict Resolution & Versioning                 │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐│ │
│  │  │   Similarity    │  │   Version       │  │   Rollback  ││ │
│  │  │   Algorithms    │  │   Management    │  │   Handler   ││ │
│  │  └─────────────────┘  └─────────────────┘  └─────────────┘│ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Technology Stack

- **Type Safety**: TypeScript enums + interfaces
- **Persistence**: JSON files with AES-256-GCM encryption
- **Security**: Encryption at rest + integrity verification
- **Auto-Discovery**: Pattern matching + confidence scoring
- **Conflict Resolution**: Similarity algorithms + versioning

## 2. TypeScript Type Definitions

### 2.1 Core Type Definitions

```typescript
// src/constants/types.ts

/**
 * Core constants interface
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
 * Types of constants managed by the system
 */
export enum ConstantType {
  CURATOR = 'curator',
  FORMAT = 'format',
  SERIES = 'series',
  COLLECTIVE = 'collective',
  GENRE = 'genre',
  LANGUAGE = 'language'
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
  MANUAL = 'manual',           // Manually added
  AUTO_DETECTED = 'auto_detected', // Auto-discovered from PDF
  IMPORTED = 'imported',         // Imported from external source
  API = 'api'                   // From external API
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

export enum ValidationType {
  REGEX = 'regex',
  LENGTH = 'length',
  ENUM = 'enum',
  CUSTOM = 'custom'
}

/**
 * Specialized constant types
 */
export interface CuratorConstant extends BaseConstant {
  readonly type: ConstantType.CURATOR;
  readonly collective?: string;
  readonly role?: string;
  readonly bio?: string;
}

export interface FormatConstant extends BaseConstant {
  readonly type: ConstantType.FORMAT;
  readonly formatType: FormatType;
  readonly technicalSpecs?: TechnicalSpecs;
}

export enum FormatType {
  DIGITAL = 'digital',
  FILM = 'film',
  SPECIAL = 'special'
}

export interface TechnicalSpecs {
  readonly resolution?: string;
  readonly aspectRatio?: string;
  readonly audioFormat?: string;
  readonly subtitles?: boolean;
}

export interface SeriesConstant extends BaseConstant {
  readonly type: ConstantType.SERIES;
  readonly curator?: string;
  readonly startDate?: Date;
  readonly endDate?: Date;
  readonly frequency?: SeriesFrequency;
}

export enum SeriesFrequency {
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUAL = 'annual',
  IRREGULAR = 'irregular'
}

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

export interface StoreMetadata {
  readonly version: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly totalConstants: number;
  readonly checksum: string;
  readonly encryptionKeyVersion: number;
}
```

### 2.2 Detection and Resolution Types

```typescript
// src/constants/detection/types.ts

/**
 * Auto-detection configuration
 */
export interface DetectionConfig {
  readonly enabled: boolean;
  readonly confidenceThreshold: number;
  readonly similarityThreshold: number;
  readonly patterns: DetectionPatterns;
  readonly machineLearning?: MLDetectionConfig;
}

export interface DetectionPatterns {
  readonly curators: readonly CuratorPattern[];
  readonly formats: readonly FormatPattern[];
  readonly series: readonly SeriesPattern[];
  readonly collectives: readonly CollectivePattern[];
}

export interface CuratorPattern {
  readonly regex: string;
  readonly flags: string;
  readonly context: ContextRule;
  readonly confidence: number;
  readonly examples: readonly string[];
}

export interface ContextRule {
  readonly requiredWords?: readonly string[];
  readonly forbiddenWords?: readonly string[];
  readonly position?: TextPosition;
  readonly surroundingText?: SurroundingTextRule;
}

export enum TextPosition {
  START_OF_LINE = 'start_of_line',
  END_OF_LINE = 'end_of_line',
  ANYWHERE = 'anywhere',
  BEFORE_DATE = 'before_date',
  AFTER_MOVIE_TITLE = 'after_movie_title'
}

export interface SurroundingTextRule {
  readonly before?: string;
  readonly after?: string;
  readonly distance?: number;
}

export interface FormatPattern {
  readonly regex: string;
  readonly flags: string;
  readonly formatType: FormatType;
  readonly keywords: readonly string[];
  readonly confidence: number;
}

export interface SeriesPattern {
  readonly regex: string;
  readonly flags: string;
  readonly context: ContextRule;
  readonly confidence: number;
  readonly recurringIndicators: readonly string[];
}

export interface CollectivePattern {
  readonly regex: string;
  readonly flags: string;
  readonly context: ContextRule;
  readonly confidence: number;
  readonly memberIndicators: readonly string[];
}

/**
 * Machine learning detection configuration
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

export interface DetectedConstant {
  readonly type: ConstantType;
  readonly value: string;
  readonly confidence: number;
  readonly sourceLocation: TextLocation;
  readonly context: string;
  readonly matchedPattern: string;
}

export interface DetectionError {
  readonly message: string;
  readonly pattern?: string;
  readonly location?: TextLocation;
}

/**
 * Conflict resolution types
 */
export interface ConflictResolution {
  readonly strategy: ConflictStrategy;
  readonly similarityScore: number;
  readonly resolution: ConflictResult;
}

export enum ConflictStrategy {
  MERGE = 'merge',
  REPLACE = 'replace',
  KEEP_BOTH = 'keep_both',
  MANUAL_REVIEW = 'manual_review'
}

export interface ConflictResult {
  readonly action: ConflictStrategy;
  readonly modifiedConstant?: BaseConstant;
  readonly createdConstant?: BaseConstant;
  readonly reason: string;
}

/**
 * Similarity calculation results
 */
export interface SimilarityResult {
  readonly score: number;
  readonly algorithm: SimilarityAlgorithm;
  readonly details: SimilarityDetails;
}

export enum SimilarityAlgorithm {
  LEVENSHTEIN = 'levenshtein',
  JARO_WINKLER = 'jaro_winkler',
  COSINE = 'cosine',
  JACCARD = 'jaccard',
  HYBRID = 'hybrid'
}

export interface SimilarityDetails {
  readonly commonWords: readonly string[];
  readonly lengthDifference: number;
  readonly characterSimilarity: number;
  readonly wordSimilarity: number;
}
```

## 3. Core Implementation

### 3.1 Constants Manager

```typescript
// src/constants/ConstantsManager.ts

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';

export class ConstantsManager {
  private store: ConstantsStore;
  private encryptionKey: Buffer;
  private readonly storePath: string;
  private detectionConfig: DetectionConfig;

  constructor(
    storePath: string = './data/constants/store.json.enc',
    encryptionKey?: string
  ) {
    this.storePath = storePath;
    this.encryptionKey = encryptionKey 
      ? Buffer.from(encryptionKey, 'hex')
      : this.generateEncryptionKey();
    
    this.detectionConfig = {
      enabled: true,
      confidenceThreshold: 0.7,
      similarityThreshold: 0.8,
      patterns: this.getDefaultPatterns(),
      machineLearning: {
        enabled: false, // Can be enabled with ML model
        modelPath: './models/constants-detection.model',
        confidenceThreshold: 0.8
      }
    };

    this.store = this.createEmptyStore();
  }

  /**
   * Initialize the constants store
   */
  async initialize(): Promise<void> {
    try {
      await this.loadStore();
    } catch (error) {
      console.warn('Failed to load constants store, creating new one:', error.message);
      await this.saveStore();
    }
  }

  /**
   * Add a new constant
   */
  async addConstant<T extends BaseConstant>(
    constant: Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'version'>
  ): Promise<string> {
    // Validate constant
    await this.validateConstant(constant);

    // Generate ID
    const id = this.generateId(constant.name, constant.type);

    // Check for conflicts
    const existingConstant = this.getConstant(constant.type, id);
    if (existingConstant) {
      const resolution = await this.resolveConflict(existingConstant, constant as T);
      return this.applyConflictResolution(resolution, id, constant as T);
    }

    // Create constant with metadata
    const newConstant: T = {
      ...constant,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1
    } as T;

    // Add to store
    this.addToStore(newConstant);
    
    // Save to disk
    await this.saveStore();

    return id;
  }

  /**
   * Get a constant by type and ID
   */
  getConstant<T extends BaseConstant>(
    type: ConstantType, 
    id: string
  ): T | undefined {
    const typeStore = this.getTypeStore(type);
    return typeStore[id] as T;
  }

  /**
   * Search constants by name or aliases
   */
  searchConstants(
    type: ConstantType,
    query: string,
    fuzzy: boolean = true
  ): BaseConstant[] {
    const typeStore = this.getTypeStore(type);
    const results: BaseConstant[] = [];

    for (const constant of Object.values(typeStore)) {
      const nameMatch = this.matchString(constant.name, query, fuzzy);
      const aliasMatch = constant.metadata.aliases.some(alias => 
        this.matchString(alias, query, fuzzy)
      );

      if (nameMatch || aliasMatch) {
        results.push(constant);
      }
    }

    return results.sort((a, b) => b.metadata.confidence - a.metadata.confidence);
  }

  /**
   * Auto-detect constants from text
   */
  async detectConstants(text: string): Promise<DetectionResult> {
    if (!this.detectionConfig.enabled) {
      return {
        detectedConstants: [],
        confidence: 0,
        processingTime: 0,
        errors: []
      };
    }

    const startTime = Date.now();
    const detectedConstants: DetectedConstant[] = [];
    const errors: DetectionError[] = [];

    try {
      // Detect curators
      const curatorResults = await this.detectCurators(text);
      detectedConstants.push(...curatorResults);

      // Detect formats
      const formatResults = await this.detectFormats(text);
      detectedConstants.push(...formatResults);

      // Detect series
      const seriesResults = await this.detectSeries(text);
      detectedConstants.push(...seriesResults);

      // Detect collectives
      const collectiveResults = await this.detectCollectives(text);
      detectedConstants.push(...collectiveResults);

      // Filter by confidence threshold
      const filteredConstants = detectedConstants.filter(
        dc => dc.confidence >= this.detectionConfig.confidenceThreshold
      );

      const processingTime = Date.now() - startTime;
      const overallConfidence = this.calculateOverallConfidence(filteredConstants);

      return {
        detectedConstants: filteredConstants,
        confidence: overallConfidence,
        processingTime,
        errors
      };

    } catch (error) {
      errors.push({
        message: `Detection failed: ${error.message}`
      });

      return {
        detectedConstants: [],
        confidence: 0,
        processingTime: Date.now() - startTime,
        errors
      };
    }
  }

  /**
   * Process detected constants and add them to the store
   */
  async processDetectedConstants(
    detectedConstants: DetectedConstant[]
  ): Promise<ProcessDetectedResult> {
    const added: string[] = [];
    const conflicts: ConflictResolution[] = [];
    const errors: string[] = [];

    for (const detected of detectedConstants) {
      try {
        // Create constant from detection
        const constant = await this.createConstantFromDetection(detected);
        
        // Add to store (will handle conflicts)
        const id = await this.addConstant(constant);
        added.push(id);

      } catch (error) {
        errors.push(`Failed to process ${detected.value}: ${error.message}`);
      }
    }

    return { added, conflicts, errors };
  }

  /**
   * Export constants to JSON (unencrypted)
   */
  async exportConstants(format: 'json' | 'csv' = 'json'): Promise<string> {
    const exportData = {
      version: this.store.metadata.version,
      exportedAt: new Date().toISOString(),
      constants: {
        curators: Object.values(this.store.curators),
        formats: Object.values(this.store.formats),
        series: Object.values(this.store.series),
        collectives: Object.values(this.store.collectives),
        genres: Object.values(this.store.genres),
        languages: Object.values(this.store.languages)
      }
    };

    if (format === 'json') {
      return JSON.stringify(exportData, null, 2);
    } else {
      return this.convertToCSV(exportData.constants);
    }
  }

  /**
   * Import constants from JSON
   */
  async importConstants(jsonData: string, merge: boolean = true): Promise<ImportResult> {
    try {
      const importData = JSON.parse(jsonData);
      const imported: string[] = [];
      const conflicts: string[] = [];
      const errors: string[] = [];

      for (const [type, constants] of Object.entries(importData.constants)) {
        for (const constant of constants as BaseConstant[]) {
          try {
            const id = await this.addConstant(constant);
            imported.push(id);
          } catch (error) {
            if (error.message.includes('conflict')) {
              conflicts.push(constant.name);
            } else {
              errors.push(`${constant.name}: ${error.message}`);
            }
          }
        }
      }

      return { imported, conflicts, errors };

    } catch (error) {
      throw new Error(`Import failed: ${error.message}`);
    }
  }

  // Private helper methods

  private generateEncryptionKey(): Buffer {
    return randomBytes(32); // 256-bit key for AES-256
  }

  private createEmptyStore(): ConstantsStore {
    return {
      curators: {},
      formats: {},
      series: {},
      collectives: {},
      genres: {},
      languages: {},
      metadata: {
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        totalConstants: 0,
        checksum: '',
        encryptionKeyVersion: 1
      }
    };
  }

  private async saveStore(): Promise<void> {
    try {
      // Serialize store
      const jsonData = JSON.stringify(this.store, null, 2);
      
      // Encrypt data
      const encryptedData = await this.encryptData(jsonData);
      
      // Write to file
      await fs.writeFile(this.storePath, encryptedData);
      
      // Update metadata
      this.store.metadata.updatedAt = new Date();
      this.store.metadata.checksum = createHash('sha256').update(jsonData).digest('hex');
      
    } catch (error) {
      throw new Error(`Failed to save constants store: ${error.message}`);
    }
  }

  private async loadStore(): Promise<void> {
    try {
      // Read encrypted file
      const encryptedData = await fs.readFile(this.storePath);
      
      // Decrypt data
      const jsonData = await this.decryptData(encryptedData);
      
      // Parse and validate
      const storeData = JSON.parse(jsonData);
      this.store = this.validateStoreData(storeData);
      
    } catch (error) {
      throw new Error(`Failed to load constants store: ${error.message}`);
    }
  }

  private async encryptData(data: string): Promise<Buffer> {
    const iv = randomBytes(16); // AES block size
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(data, 'utf8'),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    // Prepend IV and auth tag to encrypted data
    return Buffer.concat([iv, authTag, encrypted]);
  }

  private async decryptData(encryptedData: Buffer): Promise<string> {
    const iv = encryptedData.slice(0, 16);
    const authTag = encryptedData.slice(16, 32);
    const ciphertext = encryptedData.slice(32);
    
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    
    return decipher.update(ciphertext) + decipher.final('utf8');
  }

  private generateId(name: string, type: ConstantType): string {
    const normalized = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    
    const timestamp = Date.now().toString(36);
    return `${normalized}_${timestamp}`;
  }

  private getTypeStore(type: ConstantType): Record<string, BaseConstant> {
    switch (type) {
      case ConstantType.CURATOR:
        return this.store.curators;
      case ConstantType.FORMAT:
        return this.store.formats;
      case ConstantType.SERIES:
        return this.store.series;
      case ConstantType.COLLECTIVE:
        return this.store.collectives;
      case ConstantType.GENRE:
        return this.store.genres;
      case ConstantType.LANGUAGE:
        return this.store.languages;
      default:
        throw new Error(`Unknown constant type: ${type}`);
    }
  }

  private addToStore(constant: BaseConstant): void {
    const typeStore = this.getTypeStore(constant.type);
    typeStore[constant.id] = constant;
    this.store.metadata.totalConstants++;
  }

  private matchString(str: string, query: string, fuzzy: boolean): boolean {
    if (!fuzzy) {
      return str.toLowerCase().includes(query.toLowerCase());
    }

    // Simple fuzzy matching - can be enhanced with proper algorithms
    const strLower = str.toLowerCase();
    const queryLower = query.toLowerCase();
    
    // Exact match
    if (strLower.includes(queryLower)) {
      return true;
    }
    
    // Contains all characters in order
    let queryIndex = 0;
    for (let i = 0; i < strLower.length && queryIndex < queryLower.length; i++) {
      if (strLower[i] === queryLower[queryIndex]) {
        queryIndex++;
      }
    }
    
    return queryIndex === queryLower.length;
  }

  private calculateOverallConfidence(detectedConstants: DetectedConstant[]): number {
    if (detectedConstants.length === 0) {
      return 0;
    }

    const totalConfidence = detectedConstants.reduce(
      (sum, dc) => sum + dc.confidence, 
      0
    );

    return totalConfidence / detectedConstants.length;
  }

  // Additional implementation methods would be included here...
  // - validateConstant
  // - resolveConflict
  // - applyConflictResolution
  // - detectCurators
  // - detectFormats
  // - detectSeries
  // - detectCollectives
  // - createConstantFromDetection
  // - convertToCSV
  // - validateStoreData
  // - getDefaultPatterns

  private async validateConstant(constant: Partial<BaseConstant>): Promise<void> {
    if (!constant.name || constant.name.trim().length === 0) {
      throw new Error('Constant name is required');
    }

    if (!constant.type) {
      throw new Error('Constant type is required');
    }

    if (!constant.metadata) {
      throw new Error('Constant metadata is required');
    }

    if (constant.metadata.confidence < 0 || constant.metadata.confidence > 1) {
      throw new Error('Confidence must be between 0 and 1');
    }
  }

  private async resolveConflict<T extends BaseConstant>(
    existing: T,
    incoming: T
  ): Promise<ConflictResolution> {
    // Calculate similarity
    const similarity = this.calculateSimilarity(existing.name, incoming.name);
    
    if (similarity.score >= this.detectionConfig.similarityThreshold) {
      return {
        strategy: ConflictStrategy.MERGE,
        similarityScore: similarity.score,
        resolution: {
          action: ConflictStrategy.MERGE,
          modifiedConstant: this.mergeConstants(existing, incoming),
          reason: `High similarity (${similarity.score.toFixed(2)}) detected`
        }
      };
    } else {
      return {
        strategy: ConflictStrategy.KEEP_BOTH,
        similarityScore: similarity.score,
        resolution: {
          action: ConflictStrategy.KEEP_BOTH,
          reason: `Low similarity (${similarity.score.toFixed(2)}) - keeping both`
        }
      };
    }
  }

  private calculateSimilarity(str1: string, str2: string): SimilarityResult {
    // Simplified Levenshtein distance calculation
    const distance = this.levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
    const maxLength = Math.max(str1.length, str2.length);
    const similarity = maxLength > 0 ? 1 - (distance / maxLength) : 1;

    return {
      score: similarity,
      algorithm: SimilarityAlgorithm.LEVENSHTEIN,
      details: {
        commonWords: this.findCommonWords(str1, str2),
        lengthDifference: Math.abs(str1.length - str2.length),
        characterSimilarity: similarity,
        wordSimilarity: this.wordSimilarity(str1, str2)
      }
    };
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() =>
      Array(str1.length + 1).fill(null)
    );

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  private findCommonWords(str1: string, str2: string): string[] {
    const words1 = str1.toLowerCase().split(/\s+/);
    const words2 = str2.toLowerCase().split(/\s+/);
    
    return words1.filter(word => words2.includes(word));
  }

  private wordSimilarity(str1: string, str2: string): number {
    const words1 = str1.toLowerCase().split(/\s+/);
    const words2 = str2.toLowerCase().split(/\s+/);
    const common = this.findCommonWords(str1, str2);
    const total = new Set([...words1, ...words2]).size;
    
    return total > 0 ? common.length / total : 0;
  }

  private mergeConstants<T extends BaseConstant>(existing: T, incoming: T): T {
    // Merge logic - keep higher confidence, combine aliases
    const merged: any = { ...existing };

    if (incoming.metadata.confidence > existing.metadata.confidence) {
      merged.name = incoming.name;
      merged.metadata.confidence = incoming.metadata.confidence;
    }

    // Merge aliases
    merged.metadata.aliases = [
      ...new Set([...existing.metadata.aliases, ...incoming.metadata.aliases])
    ];

    // Update timestamps
    merged.updatedAt = new Date();
    merged.version = existing.version + 1;

    return merged;
  }

  private async applyConflictResolution<T extends BaseConstant>(
    resolution: ConflictResolution,
    id: string,
    constant: T
  ): Promise<string> {
    switch (resolution.resolution.action) {
      case ConflictStrategy.MERGE:
        if (resolution.resolution.modifiedConstant) {
          this.addToStore(resolution.resolution.modifiedConstant);
          await this.saveStore();
          return resolution.resolution.modifiedConstant.id;
        }
        break;
        
      case ConflictStrategy.REPLACE:
        // Replace existing with new
        this.addToStore({ ...constant, id });
        await this.saveStore();
        return id;
        
      case ConflictStrategy.KEEP_BOTH:
        // Add with different ID
        const newId = this.generateId(constant.name + '_alt', constant.type);
        this.addToStore({ ...constant, id: newId });
        await this.saveStore();
        return newId;
        
      default:
        throw new Error(`Unsupported conflict resolution strategy: ${resolution.resolution.action}`);
    }
    
    throw new Error('Failed to apply conflict resolution');
  }

  private getDefaultPatterns(): DetectionPatterns {
    return {
      curators: [
        {
          regex: '(?:Introduced by|Curated by|Hosted by|Presented by)\\s+([^\\n]+)',
          flags: 'gi',
          context: { position: TextPosition.ANYWHERE },
          confidence: 0.9,
          examples: ['Introduced by Sprog', 'Curated by Greg Woods']
        },
        {
          regex: '^([A-Z][a-z]+ [A-Z][a-z]+)\\s*[:\\-]',
          flags: 'gm',
          context: { position: TextPosition.START_OF_LINE },
          confidence: 0.7,
          examples: ['Sprog:', 'Rae -']
        }
      ],
      formats: [
        {
          regex: '\\b(35mm|70mm|16mm)\\b',
          flags: 'gi',
          formatType: FormatType.FILM,
          keywords: ['mm', 'film'],
          confidence: 0.95
        },
        {
          regex: '\\b(DCP|Digital|4K|HD|Blu-ray)\\b',
          flags: 'gi',
          formatType: FormatType.DIGITAL,
          keywords: ['digital', 'resolution'],
          confidence: 0.9
        }
      ],
      series: [
        {
          regex: '\\b(Series|Festival|Retrospective)\\s*:\\s*([^\\n]+)',
          flags: 'gi',
          context: { position: TextPosition.ANYWHERE },
          confidence: 0.8,
          recurringIndicators: ['weekly', 'monthly', 'every']
        }
      ],
      collectives: [
        {
          regex: '\\b(presents|in association with)\\s+([^\\n]+)',
          flags: 'gi',
          context: { position: TextPosition.ANYWHERE },
          confidence: 0.7,
          memberIndicators: ['collective', 'group', 'society']
        }
      ]
    };
  }

  // Placeholder methods for detection implementations
  private async detectCurators(text: string): Promise<DetectedConstant[]> {
    // Implementation would use pattern matching
    return [];
  }

  private async detectFormats(text: string): Promise<DetectedConstant[]> {
    // Implementation would use pattern matching
    return [];
  }

  private async detectSeries(text: string): Promise<DetectedConstant[]> {
    // Implementation would use pattern matching
    return [];
  }

  private async detectCollectives(text: string): Promise<DetectedConstant[]> {
    // Implementation would use pattern matching
    return [];
  }

  private async createConstantFromDetection(detected: DetectedConstant): Promise<BaseConstant> {
    // Implementation would convert detected constant to appropriate type
    return {
      id: '', // Will be generated
      name: detected.value,
      type: detected.type,
      metadata: {
        source: ConstantSource.AUTO_DETECTED,
        confidence: detected.confidence,
        aliases: [],
        tags: ['auto-detected']
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1
    };
  }

  private convertToCSV(constants: any): string {
    // CSV conversion implementation
    return '';
  }

  private validateStoreData(data: any): ConstantsStore {
    // Store validation implementation
    return data as ConstantsStore;
  }
}

// Supporting interfaces
export interface ProcessDetectedResult {
  readonly added: readonly string[];
  readonly conflicts: readonly ConflictResolution[];
  readonly errors: readonly string[];
}

export interface ImportResult {
  readonly imported: readonly string[];
  readonly conflicts: readonly string[];
  readonly errors: readonly string[];
}

export interface TextLocation {
  readonly page: number;
  readonly line: number;
  readonly characterStart: number;
  readonly characterEnd: number;
  readonly context: string;
}
```

## 4. Security Features

### 4.1 Encryption at Rest

```typescript
// src/constants/SecureStorage.ts

export class SecureStorage {
  private readonly encryptionKey: Buffer;
  private readonly algorithm = 'aes-256-gcm';

  constructor(encryptionKey: Buffer) {
    this.encryptionKey = encryptionKey;
  }

  async encrypt(data: string): Promise<Buffer> {
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.encryptionKey, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(data, 'utf8'),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    return Buffer.concat([iv, authTag, encrypted]);
  }

  async decrypt(encryptedData: Buffer): Promise<string> {
    const iv = encryptedData.slice(0, 16);
    const authTag = encryptedData.slice(16, 32);
    const ciphertext = encryptedData.slice(32);
    
    const decipher = createDecipheriv(this.algorithm, this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    
    try {
      return decipher.update(ciphertext) + decipher.final('utf8');
    } catch (error) {
      throw new Error('Decryption failed - invalid data or corrupted file');
    }
  }

  verifyIntegrity(data: string, expectedChecksum: string): boolean {
    const actualChecksum = createHash('sha256').update(data).digest('hex');
    return actualChecksum === expectedChecksum;
  }
}
```

This comprehensive constants management system provides secure, intelligent, and automatic management of cinema-related entities while maintaining enterprise-grade security and data integrity.