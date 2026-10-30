const { writeFileSync, mkdirSync } = require('fs');
const { join } = require('path');

const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const content = `export const environment = {
  production: true,
  supabaseUrl: '${process.env.SUPABASE_URL}',
  supabaseAnonKey: '${process.env.SUPABASE_ANON_KEY}',
};
`;

const dir = join(__dirname, '..', 'src', 'environments');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'environment.ts'), content);
console.log('Generated src/environments/environment.ts');
