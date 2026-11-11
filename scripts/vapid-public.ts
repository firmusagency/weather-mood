/*
 * Prints the public VAPID key that belongs to the private key in VAPID_PRIVATE_KEY (nothing when the
 * secret is missing or unusable). The deploy workflow feeds it to the page build, so the page always
 * subscribes browsers with the key the evening script can sign for: one setting, no pair to keep in sync.
 * The public key is not a secret: it is embedded in the page every guest loads.
 */
import { extractPrivateKey, publicKeyFor } from './push';

const key = extractPrivateKey(process.env.VAPID_PRIVATE_KEY);
const pub = key ? publicKeyFor(key) : null;
if (pub) process.stdout.write(pub);
