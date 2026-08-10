const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const basePath = path.join(__dirname, '..', 'src');

const moves = [
  { from: 'lib/db.ts', to: 'infrastructure/database/db.ts' },
  { from: 'lib/services/wallet.service.ts', to: 'modules/wallet/domain/wallet.service.ts' },
  { from: 'lib/services/ledger.service.ts', to: 'modules/ledger/domain/ledger.service.ts' },
  { from: 'lib/services/payout.service.ts', to: 'modules/payout/domain/payout.service.ts' },
  { from: 'lib/services/audit.service.ts', to: 'modules/audit/domain/audit.service.ts' },
  { from: 'lib/services/merchant.service.ts', to: 'modules/merchant/domain/merchant.service.ts' },
  { from: 'lib/orchestrators/payout.orchestrator.ts', to: 'modules/payout/application/payout.orchestrator.ts' },
  { from: 'lib/providers/provider.interface.ts', to: 'modules/provider/core/provider.interface.ts' },
  { from: 'lib/providers/payout-provider.interface.ts', to: 'modules/provider/core/payout-provider.interface.ts' },
  { from: 'lib/providers/mock.provider.ts', to: 'modules/provider/adapters/mock.provider.ts' },
  { from: 'lib/api-auth.ts', to: 'modules/auth/application/api-auth.service.ts' },
  { from: 'lib/auth.ts', to: 'modules/auth/infrastructure/auth.ts' },
  { from: 'lib/auth-client.ts', to: 'modules/auth/infrastructure/auth-client.ts' },
  { from: 'schemas/auth.ts', to: 'modules/auth/schemas/auth.schema.ts' },
  { from: 'lib/utils/logger.ts', to: 'infrastructure/logger/logger.ts' },
  { from: 'lib/utils/decimal.ts', to: 'shared/utils/decimal.ts' },
  { from: 'lib/utils/rate-limit.ts', to: 'shared/utils/rate-limit.ts' },
  { from: 'lib/utils.ts', to: 'shared/utils/utils.ts' },
  { from: 'lib/responses.ts', to: 'shared/utils/responses.ts' },
  { from: 'types/api.ts', to: 'shared/types/api.ts' }
];

const importReplacements = moves.map(move => {
  const fromImport = '@/' + move.from.replace(/\.ts$/, '');
  const toImport = '@/' + move.to.replace(/\.ts$/, '');
  return { fromImport, toImport };
});

function walk(dir, callback) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filepath = path.join(dir, file);
    if (fs.statSync(filepath).isDirectory()) {
      walk(filepath, callback);
    } else if (filepath.endsWith('.ts') || filepath.endsWith('.tsx')) {
      callback(filepath);
    }
  }
}

// 1. Move files
for (const move of moves) {
  const fromPath = path.join(basePath, move.from);
  const toPath = path.join(basePath, move.to);
  const toDir = path.dirname(toPath);
  
  if (!fs.existsSync(toDir)) {
    fs.mkdirSync(toDir, { recursive: true });
  }
  
  if (fs.existsSync(fromPath)) {
    execSync(`git mv "${fromPath}" "${toPath}"`);
    console.log(`Moved ${move.from} to ${move.to}`);
  } else {
    console.warn(`File ${fromPath} does not exist`);
  }
}

// 2. Update imports
walk(basePath, (filepath) => {
  let content = fs.readFileSync(filepath, 'utf8');
  let changed = false;
  
  for (const rep of importReplacements) {
    // Replace all occurrences of the import string in quotes
    const regex = new RegExp(`(['"])${rep.fromImport}(['"])`, 'g');
    if (regex.test(content)) {
      content = content.replace(regex, `$1${rep.toImport}$2`);
      changed = true;
    }
  }
  
  if (changed) {
    fs.writeFileSync(filepath, content, 'utf8');
    console.log(`Updated imports in ${filepath}`);
  }
});
