import bcrypt from 'bcrypt';

/**
 * Compares a password with a hash
 * @param password Plain text password
 * @param hash Hashed password
 * @returns Boolean indicating if password matches hash
 */
export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};
