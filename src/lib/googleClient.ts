import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env';

let client: OAuth2Client | undefined;

// 'postmessage' is the redirect URI for the popup authorization-code flow
export const getGoogleClient = (): OAuth2Client => {
  client ??= new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, 'postmessage');
  return client;
};
