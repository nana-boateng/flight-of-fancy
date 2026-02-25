#!/usr/bin/env node

/**
 * CLI Entry Point for Cinema PDF Parser
 */

// Import the main parser
const { CinemaParser } = require('./dist/index.js');

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: cinema-parser <pdf-file> <template>');
    process.exit(1);
  }

  const [pdfFile, template] = args;

  try {
    const parser = new CinemaParser();

    const result = await parser.parsePDF(pdfFile, {
      template,
      enableOCR: true,
      strictMode: false,
      timeout: 30000,
      maxSize: 50 * 1024 * 1024, // 50MB
      outputFormat: 'json',
      onProgress: (stage, progress) => {
        console.log(`[${stage}] ${progress.toFixed(1)}%`);
      },
    });

    if (result.success) {
      console.log('✅ PDF parsed successfully!');
      console.log(JSON.stringify(result.data, null, 2));
    } else {
      console.error('❌ PDF parsing failed:');
      result.errors.forEach((error) => {
        console.error(`  ${error.code}: ${error.message}`);
      });
    }
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
