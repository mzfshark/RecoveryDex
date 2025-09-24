// Debug AppKit exports
import * as AppKit from '@reown/appkit/react';

console.log('[Debug] Available AppKit exports:', Object.keys(AppKit));

// Test individual imports
try {
  const { useAppKitAccount } = AppKit;
  console.log('[Debug] useAppKitAccount:', typeof useAppKitAccount);
} catch (e) {
  console.error('[Debug] useAppKitAccount error:', e);
}

try {
  const { useAppKitModal } = AppKit;
  console.log('[Debug] useAppKitModal:', typeof useAppKitModal);
} catch (e) {
  console.error('[Debug] useAppKitModal error:', e);
}

try {
  const { createAppKit } = AppKit;
  console.log('[Debug] createAppKit:', typeof createAppKit);
} catch (e) {
  console.error('[Debug] createAppKit error:', e);
}

export default AppKit;