#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up KiiTime project...\n');

// Check if package.json exists
if (!fs.existsSync('package.json')) {
  console.error('❌ package.json not found. Please run this script from the project root.');
  process.exit(1);
}

// Install dependencies
console.log('📦 Installing dependencies...');
try {
  execSync('pnpm install', { stdio: 'inherit' });
  console.log('✅ Dependencies installed successfully!\n');
} catch (error) {
  console.error('❌ Failed to install dependencies:', error.message);
  process.exit(1);
}

// Install additional required packages
console.log('📦 Installing additional packages...');
const additionalPackages = [
  '@react-native-async-storage/async-storage',
  '@tanstack/react-query',
  '@tanstack/react-query-devtools',
  'zustand',
  'react-native-tab-view',
  'react-native-toast-message',
  '@gluestack-ui/themed',
  '@gluestack-ui/config'
];

try {
  execSync(`pnpm add ${additionalPackages.join(' ')}`, { stdio: 'inherit' });
  console.log('✅ Additional packages installed successfully!\n');
} catch (error) {
  console.error('❌ Failed to install additional packages:', error.message);
  process.exit(1);
}

// Create .env file if it doesn't exist
const envPath = path.join(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
  console.log('📝 Creating .env file...');
  const envContent = `# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url_here
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# App Configuration
EXPO_PUBLIC_APP_NAME=KiiTime
`;
  
  fs.writeFileSync(envPath, envContent);
  console.log('✅ .env file created successfully!\n');
}

// Check if assets directory exists
const assetsPath = path.join(process.cwd(), 'assets');
if (!fs.existsSync(assetsPath)) {
  console.log('📁 Creating assets directory...');
  fs.mkdirSync(assetsPath, { recursive: true });
  fs.mkdirSync(path.join(assetsPath, 'fonts'), { recursive: true });
  fs.mkdirSync(path.join(assetsPath, 'images'), { recursive: true });
  console.log('✅ Assets directory created successfully!\n');
}

console.log('🎉 Setup completed successfully!');
console.log('\n📋 Next steps:');
console.log('1. Add your app logo to assets/images/icon.png');
console.log('2. Add your custom font to assets/fonts/');
console.log('3. Configure your Supabase credentials in .env file');
console.log('4. Run "pnpm start" to start the development server');
console.log('\n�� Happy coding!'); 