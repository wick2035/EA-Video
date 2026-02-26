const http = require('http');
const logger = require('../utils/logger');

const PROSODY_HOST = process.env.PROSODY_HOST || 'xmpp.meet.jitsi';
const PROSODY_HTTP_PORT = process.env.PROSODY_HTTP_PORT || 5280;
const MUC_DOMAIN = process.env.XMPP_MUC_DOMAIN || 'muc.meet.jitsi';

class ProsodyService {
  /**
   * Destroy a MUC room on Prosody, kicking all participants.
   * Uses custom mod_end_meeting Prosody module (loaded via XMPP_MUC_MODULES).
   * Fails gracefully — room will be cleaned up by Prosody when all participants leave.
   */
  async destroyRoom(roomName) {
    return new Promise((resolve, reject) => {
      const path = `/end-meeting/destroy?${encodeURIComponent(roomName)}`;

      const req = http.request({
        hostname: PROSODY_HOST,
        port: PROSODY_HTTP_PORT,
        path,
        method: 'GET',
        headers: { Host: MUC_DOMAIN },
        timeout: 5000,
      }, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            logger.info(`Prosody room destroyed: ${roomName}`);
            resolve();
          } else if (res.statusCode === 404) {
            // Room already gone — not an error
            logger.info(`Prosody room already gone: ${roomName}`);
            resolve();
          } else {
            logger.warn(`Prosody destroy room ${roomName} returned ${res.statusCode}: ${body}`);
            reject(new Error(`Prosody returned ${res.statusCode}`));
          }
        });
      });

      req.on('error', (err) => {
        logger.warn(`Prosody destroy room ${roomName} failed: ${err.message}`);
        reject(err);
      });

      req.on('timeout', () => {
        req.destroy();
        logger.warn(`Prosody destroy room ${roomName} timed out`);
        reject(new Error('Prosody request timed out'));
      });

      req.end();
    });
  }
}

module.exports = new ProsodyService();
