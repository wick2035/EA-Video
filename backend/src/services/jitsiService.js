const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class JitsiService {
  constructor() {
    this.appId = process.env.JWT_APP_ID;
    this.appSecret = process.env.JWT_APP_SECRET;
    this.jitsiUrl = process.env.JITSI_URL;
  }

  /**
   * Generate an encrypted room name from the meeting UUID.
   * Uses HMAC-SHA256 to derive a deterministic but non-guessable room name.
   */
  generateRoomName(meetingUuid) {
    const hash = crypto
      .createHmac('sha256', this.appSecret)
      .update(meetingUuid)
      .digest('hex')
      .substring(0, 24);
    return `ea-consult-${hash}`;
  }

  /**
   * Generate a Jitsi JWT token for a participant.
   * @param {string} roomName - The Jitsi room name
   * @param {object} user - { uuid, name, email, isModerator }
   * @param {number} expiryMinutes - Token validity in minutes
   * @returns {string} Signed JWT
   */
  generateToken(roomName, user, expiryMinutes = 120) {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      context: {
        user: {
          id: user.uuid,
          name: user.name,
          email: user.email || '',
          avatar: '',
          moderator: user.isModerator || false,
        },
      },
      aud: this.appId,
      iss: this.appId,
      sub: 'meet.jitsi',
      room: roomName,
      exp: now + expiryMinutes * 60,
      iat: now,
      nbf: now,
    };
    return jwt.sign(payload, this.appSecret, { algorithm: 'HS256' });
  }

  /**
   * Build the full Jitsi meeting URL for a participant.
   */
  buildJoinUrl(roomName, token) {
    return `${this.jitsiUrl}/${roomName}?jwt=${token}`;
  }
}

module.exports = new JitsiService();
