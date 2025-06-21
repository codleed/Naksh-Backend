/**
 * Quick Migration Script
 * Applies the easiest error handling improvements to get immediate benefits
 */

const fs = require('fs');
const path = require('path');

const controllersDir = path.join(__dirname, '../controllers');

/**
 * Apply quick fixes to a controller file
 */
function applyQuickFixes(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changes = [];

  // 1. Add asyncHandler import at the top
  if (!content.includes('asyncHandler')) {
    const importLine = "const { asyncHandler } = require('../utils/asyncHandler');\n";
    const firstRequire = content.indexOf("const");
    if (firstRequire !== -1) {
      content = content.slice(0, firstRequire) + importLine + content.slice(firstRequire);
      changes.push('Added asyncHandler import');
    }
  }

  // 2. Add error classes import
  if (!content.includes('ValidationError')) {
    const importLine = "const { ValidationError, NotFoundError, ConflictError, AuthenticationError } = require('../utils/errors');\n";
    const asyncHandlerImport = content.indexOf("const { asyncHandler }");
    if (asyncHandlerImport !== -1) {
      const nextLine = content.indexOf('\n', asyncHandlerImport) + 1;
      content = content.slice(0, nextLine) + importLine + content.slice(nextLine);
      changes.push('Added error classes import');
    }
  }

  // 3. Replace simple 404 responses with NotFoundError
  const notFoundPattern = /return res\.status\(404\)\.json\(\s*{\s*error:\s*['"]([^'"]+)['"]\s*}\s*\);/g;
  content = content.replace(notFoundPattern, (match, message) => {
    changes.push(`Replaced 404 response: ${message}`);
    return `throw new NotFoundError('${message.replace(' not found', '')}');`;
  });

  // 4. Replace simple 400 validation responses
  const validationPattern = /return res\.status\(400\)\.json\(\s*{\s*error:\s*['"]([^'"]+)['"]\s*}\s*\);/g;
  content = content.replace(validationPattern, (match, message) => {
    changes.push(`Replaced validation response: ${message}`);
    return `throw new ValidationError('${message}');`;
  });

  // 5. Replace simple 401 auth responses
  const authPattern = /return res\.status\(401\)\.json\(\s*{\s*error:\s*['"]([^'"]+)['"]\s*}\s*\);/g;
  content = content.replace(authPattern, (match, message) => {
    changes.push(`Replaced auth response: ${message}`);
    return `throw new AuthenticationError('${message}');`;
  });

  // 6. Replace simple 409 conflict responses
  const conflictPattern = /return res\.status\(409\)\.json\(\s*{\s*error:\s*['"]([^'"]+)['"]\s*}\s*\);/g;
  content = content.replace(conflictPattern, (match, message) => {
    changes.push(`Replaced conflict response: ${message}`);
    return `throw new ConflictError('${message}');`;
  });

  return { content, changes };
}

/**
 * Apply quick fixes to all controllers
 */
function runQuickMigration() {
  const files = fs.readdirSync(controllersDir)
    .filter(file => file.endsWith('.js') && !file.includes('refactored'))
    .map(file => ({ name: file, path: path.join(controllersDir, file) }));

  console.log('🚀 RUNNING QUICK MIGRATION\n');
  console.log('This will apply simple error handling improvements without major refactoring.\n');

  const results = [];

  files.forEach(({ name, path: filePath }) => {
    try {
      const { content, changes } = applyQuickFixes(filePath);
      
      if (changes.length > 0) {
        // Create backup
        const backupPath = filePath + '.backup';
        fs.copyFileSync(filePath, backupPath);
        
        // Write updated content
        fs.writeFileSync(filePath, content);
        
        results.push({ name, changes, success: true });
        console.log(`✅ ${name}`);
        changes.forEach(change => console.log(`   • ${change}`));
        console.log(`   📁 Backup created: ${name}.backup\n`);
      } else {
        results.push({ name, changes: [], success: true });
        console.log(`⏭️  ${name} - No quick fixes needed\n`);
      }
    } catch (error) {
      results.push({ name, error: error.message, success: false });
      console.log(`❌ ${name} - Error: ${error.message}\n`);
    }
  });

  // Summary
  const successful = results.filter(r => r.success);
  const withChanges = successful.filter(r => r.changes.length > 0);
  const totalChanges = withChanges.reduce((sum, r) => sum + r.changes.length, 0);

  console.log('📊 QUICK MIGRATION SUMMARY');
  console.log('=' .repeat(30));
  console.log(`Files processed: ${files.length}`);
  console.log(`Files updated: ${withChanges.length}`);
  console.log(`Total improvements: ${totalChanges}`);
  console.log(`Backup files created: ${withChanges.length}`);

  if (withChanges.length > 0) {
    console.log('\n✨ IMMEDIATE BENEFITS:');
    console.log('• Cleaner error responses');
    console.log('• Consistent error format');
    console.log('• Better error logging');
    console.log('• Automatic error transformation');
    
    console.log('\n🔄 TO REVERT CHANGES:');
    console.log('Run: node scripts/restore-backups.js');
    
    console.log('\n📈 NEXT STEPS:');
    console.log('1. Test your API endpoints');
    console.log('2. Gradually add asyncHandler wrappers');
    console.log('3. Remove try-catch blocks as you update functions');
    console.log('4. Add input validation using validation utilities');
  }
}

// Create restore script
function createRestoreScript() {
  const restoreScript = `/**
 * Restore Controller Backups
 * Restores all controller files from their backups
 */

const fs = require('fs');
const path = require('path');

const controllersDir = path.join(__dirname, '../controllers');

function restoreBackups() {
  const backupFiles = fs.readdirSync(controllersDir)
    .filter(file => file.endsWith('.backup'));

  if (backupFiles.length === 0) {
    console.log('No backup files found.');
    return;
  }

  console.log('🔄 RESTORING CONTROLLER BACKUPS\\n');

  backupFiles.forEach(backupFile => {
    const originalFile = backupFile.replace('.backup', '');
    const backupPath = path.join(controllersDir, backupFile);
    const originalPath = path.join(controllersDir, originalFile);

    try {
      fs.copyFileSync(backupPath, originalPath);
      fs.unlinkSync(backupPath);
      console.log(\`✅ Restored \${originalFile}\`);
    } catch (error) {
      console.log(\`❌ Failed to restore \${originalFile}: \${error.message}\`);
    }
  });

  console.log('\\n✨ All backups restored and backup files removed.');
}

if (require.main === module) {
  restoreBackups();
}

module.exports = { restoreBackups };`;

  fs.writeFileSync(path.join(__dirname, 'restore-backups.js'), restoreScript);
}

if (require.main === module) {
  createRestoreScript();
  runQuickMigration();
}

module.exports = { applyQuickFixes, runQuickMigration };