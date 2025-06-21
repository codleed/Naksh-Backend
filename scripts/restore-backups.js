/**
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

  console.log('🔄 RESTORING CONTROLLER BACKUPS\n');

  backupFiles.forEach(backupFile => {
    const originalFile = backupFile.replace('.backup', '');
    const backupPath = path.join(controllersDir, backupFile);
    const originalPath = path.join(controllersDir, originalFile);

    try {
      fs.copyFileSync(backupPath, originalPath);
      fs.unlinkSync(backupPath);
      console.log(`✅ Restored ${originalFile}`);
    } catch (error) {
      console.log(`❌ Failed to restore ${originalFile}: ${error.message}`);
    }
  });

  console.log('\n✨ All backups restored and backup files removed.');
}

if (require.main === module) {
  restoreBackups();
}

module.exports = { restoreBackups };