const { Doctor, SystemConfig } = require('../models');
const logger = require('../utils/logger');

class DurationService {
  constructor() {
    // In-memory map of meetingUuid -> { warn5, warn1, autoEnd }
    this.activeTimers = new Map();
  }

  /**
   * Resolve the effective max duration for a meeting.
   * Priority: explicit request > doctor preference > scenario config > system default
   */
  async resolveMaxDuration({ requestedDuration, doctorUuid, scenario }) {
    if (requestedDuration && requestedDuration > 0) return requestedDuration;

    const doctor = await Doctor.findOne({ where: { uuid: doctorUuid } });
    if (doctor && doctor.max_meeting_duration) return doctor.max_meeting_duration;

    const scenarioConfig = await SystemConfig.findOne({
      where: { config_key: `scenario_${scenario}_duration` },
    });
    if (scenarioConfig) return parseInt(scenarioConfig.config_value, 10);

    const defaultConfig = await SystemConfig.findOne({
      where: { config_key: 'default_max_duration_minutes' },
    });
    return defaultConfig ? parseInt(defaultConfig.config_value, 10) : 30;
  }

  /**
   * Start a server-side timer that will auto-end the meeting.
   * Emits Socket.io warnings at 5 min and 1 min before end.
   */
  startTimer(meetingUuid, maxDurationMinutes, io, endCallback) {
    const durationMs = maxDurationMinutes * 60 * 1000;
    const timers = {};

    // Warning at 5 minutes before end (only if duration > 5 min)
    if (maxDurationMinutes > 5) {
      timers.warn5 = setTimeout(() => {
        logger.info(`Meeting ${meetingUuid}: 5 min warning`);
        io.to(`meeting:${meetingUuid}`).emit('meeting:duration-warning', {
          meetingUuid,
          remainingMinutes: 5,
        });
      }, durationMs - 5 * 60 * 1000);
    }

    // Warning at 1 minute before end (only if duration > 1 min)
    if (maxDurationMinutes > 1) {
      timers.warn1 = setTimeout(() => {
        logger.info(`Meeting ${meetingUuid}: 1 min warning`);
        io.to(`meeting:${meetingUuid}`).emit('meeting:duration-warning', {
          meetingUuid,
          remainingMinutes: 1,
        });
      }, durationMs - 60 * 1000);
    }

    // Auto-end at duration limit
    timers.autoEnd = setTimeout(async () => {
      logger.info(`Meeting ${meetingUuid}: auto-ending (timeout)`);
      try {
        await endCallback(meetingUuid, 'timeout');
        io.to(`meeting:${meetingUuid}`).emit('meeting:auto-ended', {
          meetingUuid,
          reason: 'timeout',
        });
      } catch (err) {
        logger.error(`Failed to auto-end meeting ${meetingUuid}:`, err);
      }
      this.activeTimers.delete(meetingUuid);
    }, durationMs);

    this.activeTimers.set(meetingUuid, timers);
    logger.info(`Timer started for meeting ${meetingUuid}: ${maxDurationMinutes} min`);
  }

  /**
   * Cancel timer when meeting ends normally.
   */
  cancelTimer(meetingUuid) {
    const timers = this.activeTimers.get(meetingUuid);
    if (timers) {
      if (timers.warn5) clearTimeout(timers.warn5);
      if (timers.warn1) clearTimeout(timers.warn1);
      if (timers.autoEnd) clearTimeout(timers.autoEnd);
      this.activeTimers.delete(meetingUuid);
      logger.info(`Timer cancelled for meeting ${meetingUuid}`);
    }
  }
}

module.exports = new DurationService();
