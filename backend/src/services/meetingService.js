const { v4: uuidv4 } = require('uuid');
const { Meeting, Patient, Doctor, AuditLog } = require('../models');
const jitsiService = require('./jitsiService');
const durationService = require('./durationService');
const logger = require('../utils/logger');

class MeetingService {
  setIo(io) {
    this.io = io;
  }

  /**
   * Create a new consultation meeting.
   */
  async createMeeting({ patientUuid, doctorUuid, scenario = 'general', maxDuration, scheduledAt, isEncrypted = true, notes }) {
    // 1. Validate patient exists
    const patient = await Patient.findOne({ where: { uuid: patientUuid, is_active: 1 } });
    if (!patient) throw new Error('Patient not found or inactive');

    // 2. Validate doctor exists
    const doctor = await Doctor.findOne({ where: { uuid: doctorUuid, is_active: 1 } });
    if (!doctor) throw new Error('Doctor not found or inactive');

    // 3. Check doctor has no active meeting
    const activeMeeting = await Meeting.findOne({
      where: { doctor_uuid: doctorUuid, status: ['scheduled', 'waiting', 'in_progress'] },
    });
    if (activeMeeting) throw new Error('Doctor already has an active meeting');

    // 4. Resolve max duration
    const maxDurationMinutes = await durationService.resolveMaxDuration({
      requestedDuration: maxDuration,
      doctorUuid,
      scenario,
    });

    // 5. Generate meeting UUID and room name
    const meetingUuid = uuidv4();
    const roomName = jitsiService.generateRoomName(meetingUuid);

    // 6. Generate JWTs
    const doctorJwt = jitsiService.generateToken(roomName, {
      uuid: doctor.uuid,
      name: doctor.name,
      email: doctor.email,
      isModerator: true,
    });
    const patientJwt = jitsiService.generateToken(roomName, {
      uuid: patient.uuid,
      name: patient.name,
      email: patient.email,
      isModerator: false,
    });

    // 7. Create meeting record
    const meeting = await Meeting.create({
      uuid: meetingUuid,
      patient_uuid: patientUuid,
      doctor_uuid: doctorUuid,
      room_name: roomName,
      status: 'scheduled',
      scenario,
      max_duration_minutes: maxDurationMinutes,
      scheduled_at: scheduledAt || new Date(),
      is_encrypted: isEncrypted ? 1 : 0,
      notes,
    });

    // 8. Audit log
    await AuditLog.create({
      entity_type: 'meeting',
      entity_uuid: meetingUuid,
      action: 'create',
      actor_type: 'admin',
      details: { patientUuid, doctorUuid, scenario, maxDurationMinutes },
    });

    // 9. Socket.io broadcast
    if (this.io) {
      this.io.to('dashboard').emit('meeting:created', {
        meetingUuid,
        doctorUuid,
        patientUuid,
        status: 'scheduled',
      });
    }

    // 10. Return meeting with join info
    const doctorJoinUrl = jitsiService.buildJoinUrl(roomName, doctorJwt);
    const patientJoinUrl = jitsiService.buildJoinUrl(roomName, patientJwt);

    return {
      meeting: meeting.toJSON(),
      doctorJoinUrl,
      patientJoinUrl,
      doctorJwt,
      patientJwt,
    };
  }

  /**
   * Start a meeting (transition to in_progress).
   */
  async startMeeting(meetingUuid) {
    const meeting = await Meeting.findOne({ where: { uuid: meetingUuid } });
    if (!meeting) throw new Error('Meeting not found');
    if (!['scheduled', 'waiting'].includes(meeting.status)) {
      throw new Error(`Cannot start meeting with status: ${meeting.status}`);
    }

    meeting.status = 'in_progress';
    meeting.actual_start_at = new Date();
    await meeting.save();

    // Start duration timer
    durationService.startTimer(
      meetingUuid,
      meeting.max_duration_minutes,
      this.io,
      (uuid, reason) => this.endMeeting(uuid, reason)
    );

    // Audit
    await AuditLog.create({
      entity_type: 'meeting',
      entity_uuid: meetingUuid,
      action: 'start',
      actor_type: 'system',
    });

    if (this.io) {
      this.io.to('dashboard').emit('meeting:started', {
        meetingUuid,
        startedAt: meeting.actual_start_at,
      });
    }

    return meeting.toJSON();
  }

  /**
   * End a meeting.
   */
  async endMeeting(meetingUuid, reason = 'normal') {
    const meeting = await Meeting.findOne({ where: { uuid: meetingUuid } });
    if (!meeting) throw new Error('Meeting not found');
    if (meeting.status === 'completed' || meeting.status === 'cancelled') {
      return meeting.toJSON();
    }

    const now = new Date();
    meeting.status = 'completed';
    meeting.actual_end_at = now;
    meeting.end_reason = reason;

    if (meeting.actual_start_at) {
      meeting.duration_seconds = Math.floor((now - meeting.actual_start_at) / 1000);
    }
    await meeting.save();

    // Cancel timer
    durationService.cancelTimer(meetingUuid);

    // Audit
    await AuditLog.create({
      entity_type: 'meeting',
      entity_uuid: meetingUuid,
      action: 'end',
      actor_type: 'system',
      details: { reason, duration_seconds: meeting.duration_seconds },
    });

    if (this.io) {
      this.io.to('dashboard').emit('meeting:ended', {
        meetingUuid,
        duration: meeting.duration_seconds,
        reason,
      });
    }

    return meeting.toJSON();
  }

  /**
   * Cancel a meeting.
   */
  async cancelMeeting(meetingUuid) {
    const meeting = await Meeting.findOne({ where: { uuid: meetingUuid } });
    if (!meeting) throw new Error('Meeting not found');
    if (['completed', 'cancelled'].includes(meeting.status)) {
      throw new Error(`Cannot cancel meeting with status: ${meeting.status}`);
    }

    meeting.status = 'cancelled';
    meeting.actual_end_at = new Date();
    meeting.end_reason = 'system';
    await meeting.save();

    durationService.cancelTimer(meetingUuid);

    await AuditLog.create({
      entity_type: 'meeting',
      entity_uuid: meetingUuid,
      action: 'cancel',
      actor_type: 'admin',
    });

    if (this.io) {
      this.io.to('dashboard').emit('meeting:cancelled', { meetingUuid });
    }

    return meeting.toJSON();
  }

  /**
   * Get join info for a role (doctor/patient).
   */
  async getJoinInfo(meetingUuid, role) {
    const meeting = await Meeting.findOne({
      where: { uuid: meetingUuid },
      include: [
        { association: 'patient', attributes: ['uuid', 'name', 'email'] },
        { association: 'doctor', attributes: ['uuid', 'name', 'email'] },
      ],
    });
    if (!meeting) throw new Error('Meeting not found');

    // Block joining meetings that are not in a joinable state
    const joinableStatuses = ['scheduled', 'in_progress'];
    if (!joinableStatuses.includes(meeting.status)) {
      throw new Error(`Meeting is not joinable (status: ${meeting.status})`);
    }

    // Calculate JWT expiry based on remaining meeting time
    let expiryMinutes;
    if (meeting.status === 'in_progress' && meeting.actual_start_at) {
      const elapsedMs = Date.now() - new Date(meeting.actual_start_at).getTime();
      const remainingMs = meeting.max_duration_minutes * 60 * 1000 - elapsedMs;
      expiryMinutes = Math.max(1, Math.ceil(remainingMs / 60000) + 2);
    } else {
      expiryMinutes = meeting.max_duration_minutes + 10;
    }

    const user = role === 'doctor' ? meeting.doctor : meeting.patient;
    const token = jitsiService.generateToken(meeting.room_name, {
      uuid: user.uuid,
      name: user.name,
      email: user.email,
      isModerator: role === 'doctor',
    }, expiryMinutes);
    const joinUrl = jitsiService.buildJoinUrl(meeting.room_name, token);

    return {
      meetingUuid: meeting.uuid,
      roomName: meeting.room_name,
      jwt: token,
      joinUrl,
      role,
      userName: user.name,
      isEncrypted: meeting.is_encrypted,
      maxDurationMinutes: meeting.max_duration_minutes,
      status: meeting.status,
    };
  }

  /**
   * Get dashboard statistics.
   */
  async getStats() {
    const { Op, fn, col } = require('sequelize');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalToday, activeNow, onlineDoctors, avgDuration] = await Promise.all([
      Meeting.count({ where: { created_at: { [Op.gte]: today } } }),
      Meeting.count({ where: { status: 'in_progress' } }),
      Doctor.count({ where: { is_online: 1, is_active: 1 } }),
      Meeting.findOne({
        attributes: [[fn('AVG', col('duration_seconds')), 'avg_duration']],
        where: { status: 'completed', created_at: { [Op.gte]: today } },
        raw: true,
      }),
    ]);

    return {
      totalToday,
      activeNow,
      onlineDoctors,
      avgDurationMinutes: avgDuration?.avg_duration
        ? Math.round(avgDuration.avg_duration / 60)
        : 0,
    };
  }
}

module.exports = new MeetingService();
