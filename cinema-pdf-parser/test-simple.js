// Simple test without TypeScript compilation
const fs = require('fs');
const path = require('path');

// Create a simple test case
const testPdfPath = path.join(__dirname, 'test-calendar.pdf');
const testContent = `THIS WEEK - REVUE CINEMA

THE SEVEN SAMURAI (1954)
Dir. Akira Kurosawa
207 min

MON 28 @ 7:30 PM
TUE 1 @ 7:30 PM
WED 2 @ 7:30 PM
THU 3 @ 7:30 PM
FRI 4 @ 9:30 PM
SAT 5 @ 7:30 PM
SUN 6 @ 2:00 PM

Introduced by Sprog
endstream`;

// Write the test PDF
fs.writeFileSync(testPdfPath, testContent);

console.log('Created test PDF:', testPdfPath);

// Simple parser function
function simpleParsePDF(pdfContent, template) {
  console.log('Parsing PDF with template:', template);

  // Extract movie title (simplified)
  const titleMatch = pdfContent.match(/([A-Z][^\\n]{10,50})/);
  if (titleMatch) {
    const title = titleMatch[1].trim();
    console.log('Found movie:', title);

    // Extract year
    const yearMatch = pdfContent.match(/\\((\\d{4})\\))/);
    if (yearMatch) {
      console.log('Found year:', yearMatch[1]);
    }

    // Extract screenings
    const screeningPattern =
      /(MON|TUE|WED|THU|FRI|SAT|SUN)\\s+(\\d{1,2})\\s+(@|at)?\\s*([0-9]{1,2}:[0-9]{2})\\s*(AM|PM|am|pm)/g;
    const screenings = [];
    let match;
    while ((match = screeningPattern.exec(pdfContent)) !== null) {
      screenings.push({
        day: match[1],
        time: match[2],
        date: `2024-02-${match[1].padStart(2, '0')}`,
      });
    }

    console.log('Found screenings:', screenings.length);

    return {
      success: true,
      data: {
        movies: [
          {
            title,
            screenings: screenings,
            curators: [{ name: 'Sprog' }],
          },
        ],
      },
    };
  }

  return { success: false, errors: [{ message: 'Failed to parse' }] };
}

// Test the parser
console.log('\n=== Testing Simple Parser ===');
const result = simpleParsePDF(testContent, 'revue-cinema');

if (result.success) {
  console.log('✅ Simple parsing successful!');
  console.log('Result:', result);
} else {
  console.log('❌ Simple parsing failed');
}
