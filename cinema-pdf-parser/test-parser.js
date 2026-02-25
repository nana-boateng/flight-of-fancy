// Test the parser with sample data
const fs = require('fs');
const path = require('path');

// Create a simple test PDF content
const samplePDFContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog
/Pages 2 0 R
/MediaBox [0 0 612 792]
/Contents 2 0 R
<< /Length 48
>>stream
BT
/Times-Roman
37 Tf
0 0 Td
(THIS WEEK - REVUE CINEMA)

/F1 12 Tf
0 16 Td
THE SEVEN SAMURAI (1954)

1 0 Td
Dir. Akira Kurosawa

1 0 Td
207 min

1 0 Td

/F1 12 Tf
0 32 Td
MON 28 @ 7:30 PM

/F1 12 Tf
0 48 Td
TUE 1 @ 7:30 PM

/F1 12 Tf
0 64 Td
WED 2 @ 7:30 PM

/F1 12 Tf
0 80 Td
THU 3 @ 7:30 PM

/F1 12 Tf
0 96 Td
FRI 4 @ 9:30 PM

/F1 12 Tf
0 112 Td
SAT 5 @ 7:30 PM

/F1 12 Tf
0 128 Td
SUN 6 @ 2:00 PM

/F1 12 Tf
0 144 Td
Introduced by Sprog

endstream
endobj
trailer
<<
/Size 612 792
/Root 2 0 R
/Info 2 0 R
/ID [<73e6dd1e9d9c17>]
>>
startxref
%%EOF`;

// Write the test PDF
const testPdfPath = path.join(__dirname, 'test-calendar.pdf');
fs.writeFileSync(testPdfPath, samplePDFContent);

console.log('Created test PDF:', testPdfPath);

// Test the parser
async function testParser() {
  const { CinemaParser } = require('./dist/index.js');

  const parser = new CinemaParser();

  try {
    const result = await parser.parsePDF(testPdfPath, {
      template: 'revue-cinema',
      enableOCR: true,
      strictMode: false,
      timeout: 30000,
      maxSize: 50 * 1024 * 1024,
      outputFormat: 'json',
      onProgress: (stage, progress) => {
        console.log(`[${stage}] ${progress.toFixed(1)}%`);
      },
    });

    console.log('\n=== PARSER RESULT ===');
    if (result.success) {
      console.log('✅ Success!');
      console.log('Movies found:', result.data?.movies?.length || 0);
      console.log(
        'Screenings found:',
        result.data?.movies?.reduce((sum, m) => sum + (m.screenings?.length || 0), 0) || 0
      );

      if (result.data?.movies?.[0]) {
        const movie = result.data.movies[0];
        console.log('\nMovie:', movie.movie.title);
        console.log('Year:', movie.movie.year);
        console.log('Director:', movie.movie.director);
        console.log('Screenings:', movie.screenings.length);

        movie.screenings.forEach((screening) => {
          console.log(`  ${screening.date} at ${screening.time}`);
        });
      }
    } else {
      console.log('❌ Failed:');
      result.errors?.forEach((error) => {
        console.log(`  ${error.code}: ${error.message}`);
      });
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the test
testParser();
