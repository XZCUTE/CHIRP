// Rate Limiter Utility
// Prevents brute-force attacks by limiting actions to 75 requests per minute.
// Since we are using Firebase (Serverless), this is a client-side implementation.
// For full security, this should be enforced by Firebase Security Rules or Cloud Functions.

export const checkRateLimit = (actionKey) => {
  const limit = 75; // Max requests
  const windowMs = 60 * 1000; // 1 minute in milliseconds
  const now = Date.now();
  
  // key for localStorage (e.g., 'rate_limit_login', 'rate_limit_signup')
  const storageKey = `rate_limit_${actionKey}`;
  
  // Get existing timestamps
  const storedTimestamps = JSON.parse(localStorage.getItem(storageKey) || '[]');
  
  // Filter out timestamps older than the window
  const validTimestamps = storedTimestamps.filter(timestamp => now - timestamp < windowMs);
  
  if (validTimestamps.length >= limit) {
    // Return remaining time in seconds
    const oldestTimestamp = validTimestamps[0];
    const resetTime = oldestTimestamp + windowMs;
    const remainingSeconds = Math.ceil((resetTime - now) / 1000);
    return { allowed: false, remainingSeconds };
  }
  
  // Add current timestamp and save
  validTimestamps.push(now);
  localStorage.setItem(storageKey, JSON.stringify(validTimestamps));
  
  return { allowed: true };
};
