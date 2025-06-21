/**
 * Migration Script for Controllers
 * Helps identify patterns that need to be updated to use the new error handling system
 */

const fs = require('fs');
const path = require('path');

const controllersDir = path.join(__dirname, '../controllers');

// Patterns to look for in existing controllers
const patterns = {
  tryBlocks: /try\s*{/g,
  catchBlocks: /catch\s*\([^)]*\)\s*{/g,
  statusResponses: /res\.status\(\d+\)\.json\(/g,
  errorResponses: /res\.status\(\d+\)\.json\(\s*{\s*error:/g,
  consoleErrors: /console\.error\(/g,
  prismaErrors: /error\.code\s*===?\s*['"]P\d+['"]/g,
  returnEarly: /return\s+res\.status\(/g
};

function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const fileName = path.basename(filePath);
  
  const analysis = {
    fileName,
    issues: [],
    suggestions: []
  };
  
  // Count try-catch blocks
  const tryMatches = content.match(patterns.tryBlocks) || [];
  const catchMatches = content.match(patterns.catchBlocks) || [];
  
  if (tryMatches.length > 0) {
    analysis.issues.push(`Found ${tryMatches.length} try-catch blocks`);
    analysis.suggestions.push('Consider using asyncHandler wrapper to eliminate try-catch blocks');
  }
  
  // Count status responses
  const statusMatches = content.match(patterns.statusResponses) || [];
  if (statusMatches.length > 0) {
    analysis.issues.push(`Found ${statusMatches.length} manual status responses`);
    analysis.suggestions.push('Use response helpers (res.success, res.notFound, etc.) for consistent responses');
  }
  
  // Count error responses
  const errorMatches = content.match(patterns.errorResponses) || [];
  if (errorMatches.length > 0) {
    analysis.issues.push(`Found ${errorMatches.length} manual error responses`);
    analysis.suggestions.push('Throw specific error classes instead of manual error responses');
  }
  
  // Count console.error calls
  const consoleMatches = content.match(patterns.consoleErrors) || [];
  if (consoleMatches.length > 0) {
    analysis.issues.push(`Found ${consoleMatches.length} console.error calls`);
    analysis.suggestions.push('Remove console.error calls - error middleware handles logging automatically');
  }
  
  // Count Prisma error handling
  const prismaMatches = content.match(patterns.prismaErrors) || [];
  if (prismaMatches.length > 0) {
    analysis.issues.push(`Found ${prismaMatches.length} manual Prisma error handlers`);
    analysis.suggestions.push('Remove manual Prisma error handling - errors are transformed automatically');
  }
  
  // Count early returns
  const returnMatches = content.match(patterns.returnEarly) || [];
  if (returnMatches.length > 0) {
    analysis.issues.push(`Found ${returnMatches.length} early return statements with status`);
    analysis.suggestions.push('Replace early returns with thrown errors for better flow control');
  }
  
  return analysis;
}

function generateMigrationReport() {
  const files = fs.readdirSync(controllersDir)
    .filter(file => file.endsWith('.js') && !file.includes('refactored'))
    .map(file => path.join(controllersDir, file));
  
  const report = {
    totalFiles: files.length,
    analyses: [],
    summary: {
      totalIssues: 0,
      commonPatterns: {}
    }
  };
  
  files.forEach(filePath => {
    const analysis = analyzeFile(filePath);
    report.analyses.push(analysis);
    report.summary.totalIssues += analysis.issues.length;
    
    // Count common patterns
    analysis.issues.forEach(issue => {
      const pattern = issue.split(' ')[1]; // Get the pattern type
      report.summary.commonPatterns[pattern] = (report.summary.commonPatterns[pattern] || 0) + 1;
    });
  });
  
  return report;
}

function printReport(report) {
  console.log('\n🔍 CONTROLLER MIGRATION ANALYSIS REPORT\n');
  console.log('=' .repeat(50));
  
  console.log(`\n📊 SUMMARY:`);
  console.log(`   Total files analyzed: ${report.totalFiles}`);
  console.log(`   Total issues found: ${report.summary.totalIssues}`);
  
  if (Object.keys(report.summary.commonPatterns).length > 0) {
    console.log(`\n📈 COMMON PATTERNS:`);
    Object.entries(report.summary.commonPatterns)
      .sort(([,a], [,b]) => b - a)
      .forEach(([pattern, count]) => {
        console.log(`   ${pattern}: ${count} occurrences`);
      });
  }
  
  console.log(`\n📋 DETAILED ANALYSIS:\n`);
  
  report.analyses.forEach(analysis => {
    if (analysis.issues.length > 0) {
      console.log(`📄 ${analysis.fileName}`);
      console.log('   Issues:');
      analysis.issues.forEach(issue => {
        console.log(`   ❌ ${issue}`);
      });
      console.log('   Suggestions:');
      analysis.suggestions.forEach(suggestion => {
        console.log(`   💡 ${suggestion}`);
      });
      console.log('');
    }
  });
  
  console.log('🚀 MIGRATION STEPS:\n');
  console.log('1. Wrap controller functions with asyncHandler');
  console.log('2. Replace try-catch blocks with direct async/await');
  console.log('3. Replace manual error responses with thrown error classes');
  console.log('4. Replace manual status responses with response helpers');
  console.log('5. Remove console.error calls');
  console.log('6. Remove manual Prisma error handling');
  console.log('7. Add input validation using validation utilities');
  console.log('\n📖 See ERROR_HANDLING_GUIDE.md for detailed migration instructions');
  console.log('\n✨ Example refactored controller: controllers/authController.refactored.js');
}

// Run the analysis
if (require.main === module) {
  try {
    const report = generateMigrationReport();
    printReport(report);
  } catch (error) {
    console.error('Error running migration analysis:', error);
  }
}

module.exports = {
  analyzeFile,
  generateMigrationReport,
  printReport
};