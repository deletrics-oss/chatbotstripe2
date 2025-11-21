/**
 * Load environment variables from Replit Secrets
 * In Replit workspaces, secrets are not available via process.env by default
 * This module loads them programmatically
 */

import fs from 'fs';
import path from 'path';

// Check if running in Replit environment
const isReplit = process.env.REPL_ID !== undefined;

if (isReplit) {
  // In Replit, secrets are stored in JSON format in /tmp/.secrets
  const secretsPath = '/tmp/.secrets';
  
  try {
    if (fs.existsSync(secretsPath)) {
      const secretsData = fs.readFileSync(secretsPath, 'utf8');
      const secrets = JSON.parse(secretsData);
      
      // Load all secrets into process.env
      for (const [key, value] of Object.entries(secrets)) {
        if (!process.env[key]) {
          process.env[key] = String(value);
        }
      }
      
      console.log('[loadEnv] Loaded secrets from Replit');
    } else {
      console.warn('[loadEnv] No secrets file found at /tmp/.secrets');
    }
  } catch (error) {
    console.warn('[loadEnv] Error loading secrets:', error);
  }
}

// Also try loading from .env file if it exists (for local development)
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '');
          if (!process.env[key.trim()]) {
            process.env[key.trim()] = value.trim();
          }
        }
      }
    });
    console.log('[loadEnv] Loaded .env file');
  } catch (error) {
    console.warn('[loadEnv] Error loading .env:', error);
  }
}

// Verify DATABASE_URL is loaded
if (!process.env.DATABASE_URL) {
  console.error('[loadEnv] DATABASE_URL not found in environment');
  console.error('[loadEnv] Available env vars:', Object.keys(process.env).filter(k => k.includes('DATA') || k.includes('PG')));
} else {
  console.log('[loadEnv] DATABASE_URL loaded successfully (length:', process.env.DATABASE_URL.length, ')');
}

// Debug PG variables
console.log('[loadEnv] PGHOST:', process.env.PGHOST || 'EMPTY');
console.log('[loadEnv] PGUSER:', process.env.PGUSER || 'EMPTY');
console.log('[loadEnv] PGDATABASE:', process.env.PGDATABASE || 'EMPTY');
console.log('[loadEnv] PGPORT:', process.env.PGPORT || 'EMPTY');
console.log('[loadEnv] PGPASSWORD:', process.env.PGPASSWORD ? '***' : 'EMPTY');

// If DATABASE_URL is empty but PG* variables exist, construct it
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === '') {
  const { PGUSER, PGPASSWORD, PGHOST, PGPORT, PGDATABASE } = process.env;
  
  if (PGUSER && PGHOST && PGDATABASE) {
    const password = PGPASSWORD || '';
    const port = PGPORT || '5432';
    const host = PGHOST || 'localhost';
    
    // Construct PostgreSQL connection string
    process.env.DATABASE_URL = `postgresql://${PGUSER}:${password}@${host}:${port}/${PGDATABASE}`;
    console.log('[loadEnv] Constructed DATABASE_URL from PG* variables');
  }
}
