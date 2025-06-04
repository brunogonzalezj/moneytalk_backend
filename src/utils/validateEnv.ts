/**
 * Validates environment variables required for the application
 * @throws Error if any required environment variable is missing
 */
export const validateEnv = (): void => {
  const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'OPENAI_API_KEY',
    'CORS_ORIGIN',
  ];

  const missingEnvVars = requiredEnvVars.filter(
    (envVar) => !process.env[envVar]
  );

  if (missingEnvVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingEnvVars.join(', ')}`
    );
  }
};
