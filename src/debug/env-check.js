// Debug script to check environment variables
console.log('=== Environment Variables Debug ===');
console.log('NODE_ENV:', import.meta.env.NODE_ENV);
console.log('MODE:', import.meta.env.MODE);
console.log('DEV:', import.meta.env.DEV);
console.log('PROD:', import.meta.env.PROD);
console.log('');

console.log('=== Vite Environment Variables ===');
Object.keys(import.meta.env)
  .filter(key => key.startsWith('VITE_'))
  .sort()
  .forEach(key => {
    const value = import.meta.env[key];
    // Mask sensitive values
    if (key.includes('PROJECT_ID') || key.includes('PRIVATE') || key.includes('KEY')) {
      console.log(`${key}:`, value ? `${value.substring(0, 8)}...` : 'NOT SET');
    } else {
      console.log(`${key}:`, value || 'NOT SET');
    }
  });

console.log('');
console.log('=== Critical Checks ===');
console.log('VITE_REOWN_PROJECT_ID present:', !!import.meta.env.VITE_REOWN_PROJECT_ID);
console.log('VITE_RPC_URL_HARMONY present:', !!import.meta.env.VITE_RPC_URL_HARMONY);
console.log('VITE_CHAIN_ID present:', !!import.meta.env.VITE_CHAIN_ID);

export default function debugEnv() {
  return {
    hasProjectId: !!import.meta.env.VITE_REOWN_PROJECT_ID,
    hasRpcUrl: !!import.meta.env.VITE_RPC_URL_HARMONY,
    chainId: import.meta.env.VITE_CHAIN_ID,
    mode: import.meta.env.MODE,
    dev: import.meta.env.DEV
  };
}