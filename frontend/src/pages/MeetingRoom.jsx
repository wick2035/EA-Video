import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Tag, Button, Statistic, Alert, message, Space, Modal, notification } from 'antd';
import { getMeeting, getMeetingJoinInfo, endMeeting } from '../api/client';
import useSocket from '../hooks/useSocket';
import dayjs from 'dayjs';

const statusColors = {
  scheduled: 'blue', waiting: 'orange', in_progress: 'green',
  completed: 'default', cancelled: 'red', expired: 'volcano',
};

export default function MeetingRoom() {
  const { uuid } = useParams();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState(null);
  const [joinInfo, setJoinInfo] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [warning, setWarning] = useState(null);
  const [jitsiReady, setJitsiReady] = useState(false);

  const jitsiContainerRef = useRef(null);
  const jitsiApiRef = useRef(null);
  const timerRef = useRef(null);

  const jitsiDomain = (import.meta.env.VITE_JITSI_DOMAIN || 'meet.localhost:8443');

  // --- Load Jitsi External API script ---
  useEffect(() => {
    if (window.JitsiMeetExternalAPI) {
      setJitsiReady(true);
      return;
    }
    const script = document.createElement('script');
    script.src = `https://${jitsiDomain}/external_api.js`;
    script.async = true;
    script.onload = () => setJitsiReady(true);
    script.onerror = () => message.error('Failed to load Jitsi API script');
    document.head.appendChild(script);
  }, [jitsiDomain]);

  // --- Load meeting data ---
  useEffect(() => {
    loadMeeting();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [uuid]);

  const loadMeeting = async () => {
    try {
      const m = await getMeeting(uuid);
      setMeeting(m);
      if (m.status === 'in_progress' && m.actual_start_at) {
        startCountdown(m.actual_start_at, m.max_duration_minutes);
      }
      if (['scheduled', 'in_progress'].includes(m.status)) {
        try {
          const info = await getMeetingJoinInfo(uuid, 'doctor');
          setJoinInfo(info);
        } catch {
          setJoinInfo(null);
        }
      } else {
        setJoinInfo(null);
      }
    } catch {
      message.error('Failed to load meeting');
    }
  };

  // --- Initialize Jitsi External API ---
  useEffect(() => {
    if (!jitsiReady || !joinInfo || meeting?.status !== 'in_progress' || !jitsiContainerRef.current) {
      return;
    }
    if (jitsiApiRef.current) {
      jitsiApiRef.current.dispose();
      jitsiApiRef.current = null;
    }

    const api = new window.JitsiMeetExternalAPI(jitsiDomain, {
      roomName: joinInfo.roomName,
      jwt: joinInfo.jwt,
      parentNode: jitsiContainerRef.current,
      width: '100%',
      height: '100%',
      configOverwrite: {
        prejoinPageEnabled: false,
        disableDeepLinking: true,
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
      },
    });

    jitsiApiRef.current = api;

    // Ensure iframe has WebRTC permissions (camera/mic in cross-origin iframe)
    const iframe = api.getIFrame();
    if (iframe) {
      iframe.allow = 'camera; microphone; display-capture; autoplay; clipboard-write; encrypted-media';
    }

    return () => {
      if (jitsiApiRef.current) {
        jitsiApiRef.current.dispose();
        jitsiApiRef.current = null;
      }
    };
  }, [jitsiReady, joinInfo, meeting?.status]);

  // --- Force hangup helper ---
  const forceHangup = useCallback(() => {
    if (jitsiApiRef.current) {
      try {
        jitsiApiRef.current.executeCommand('hangup');
      } catch {
        try { jitsiApiRef.current.dispose(); } catch {}
        jitsiApiRef.current = null;
      }
    }
  }, []);

  // --- Countdown timer ---
  const startCountdown = (startAt, maxMinutes) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - new Date(startAt).getTime()) / 1000;
      const remaining = maxMinutes * 60 - elapsed;
      if (remaining <= 0) {
        setCountdown(0);
        clearInterval(timerRef.current);
        forceHangup();
      } else {
        setCountdown(Math.floor(remaining));
      }
    }, 1000);
  };

  // --- Duration warning handler ---
  const handleDurationWarning = useCallback((remainingMinutes) => {
    setWarning(`${remainingMinutes} minute(s) remaining`);

    if (remainingMinutes === 5) {
      notification.warning({
        message: 'Meeting Time Warning',
        description: 'Only 5 minutes remaining in this consultation. Please begin wrapping up.',
        duration: 10,
        placement: 'topRight',
      });
    } else if (remainingMinutes === 1) {
      Modal.warning({
        title: 'Meeting Ending Soon',
        content: 'Only 1 minute remaining! The meeting will be automatically ended when time expires.',
        okText: 'Understood',
      });
    }

    if (jitsiApiRef.current) {
      try {
        jitsiApiRef.current.executeCommand('showNotification', {
          title: 'Time Warning',
          description: `${remainingMinutes} minute(s) remaining in this consultation.`,
          type: 'warning',
          timeout: 'medium',
        });
      } catch {}
    }
  }, []);

  // --- Socket.io events (join both dashboard + meeting room) ---
  useSocket({
    'meeting:duration-warning': (data) => {
      if (data.meetingUuid === uuid) {
        handleDurationWarning(data.remainingMinutes);
      }
    },
    'meeting:auto-ended': (data) => {
      if (data.meetingUuid === uuid) {
        forceHangup();
        Modal.info({
          title: 'Meeting Ended',
          content: 'This meeting has been automatically ended because the allocated time has expired.',
          onOk: () => loadMeeting(),
        });
      }
    },
    'meeting:ended': (data) => {
      if (data.meetingUuid === uuid) loadMeeting();
    },
  }, ['dashboard', { type: 'meeting', id: uuid }]);

  // --- End meeting handler ---
  const handleEnd = async () => {
    try {
      forceHangup();
      await endMeeting(uuid, 'normal');
      message.success('Meeting ended');
      loadMeeting();
    } catch (err) {
      message.error(err.error || 'Failed to end meeting');
    }
  };

  const formatCountdown = (sec) => {
    if (sec === null) return '--:--';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const countdownColor = countdown === null ? '#1890ff' : countdown > 300 ? '#52c41a' : countdown > 60 ? '#faad14' : '#ff4d4f';

  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 180px)' }}>
      {/* Left: Jitsi Room */}
      <div style={{ flex: 7, minHeight: 500 }}>
        {joinInfo && meeting?.status === 'in_progress' ? (
          <div
            ref={jitsiContainerRef}
            style={{ width: '100%', height: '100%', borderRadius: 8, overflow: 'hidden' }}
          />
        ) : (
          <Card style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 18 }}>
                {meeting?.status === 'completed' ? 'Meeting has ended' :
                 meeting?.status === 'cancelled' ? 'Meeting was cancelled' :
                 'Meeting not yet started'}
              </p>
              {joinInfo && meeting?.status === 'scheduled' && (
                <div>
                  <p>Doctor Join URL:</p>
                  <p style={{ wordBreak: 'break-all', fontSize: 12 }}>{joinInfo.joinUrl}</p>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* Right: Info Panel */}
      <div style={{ flex: 3, minWidth: 300 }}>
        <Card title="Meeting Info" size="small" style={{ marginBottom: 16 }}>
          {meeting && (
            <Descriptions column={1} size="small">
              <Descriptions.Item label="UUID">{meeting.uuid?.slice(0, 12)}...</Descriptions.Item>
              <Descriptions.Item label="Status"><Tag color={statusColors[meeting.status]}>{meeting.status}</Tag></Descriptions.Item>
              <Descriptions.Item label="Doctor">{meeting.doctor?.name}</Descriptions.Item>
              <Descriptions.Item label="Patient">{meeting.patient?.name}</Descriptions.Item>
              <Descriptions.Item label="Scenario">{meeting.scenario}</Descriptions.Item>
              <Descriptions.Item label="Encrypted">{meeting.is_encrypted ? 'Yes' : 'No'}</Descriptions.Item>
              <Descriptions.Item label="Max Duration">{meeting.max_duration_minutes} min</Descriptions.Item>
              {meeting.actual_start_at && <Descriptions.Item label="Started">{dayjs(meeting.actual_start_at).format('HH:mm:ss')}</Descriptions.Item>}
            </Descriptions>
          )}
        </Card>

        <Card title="Time Remaining" size="small" style={{ marginBottom: 16, textAlign: 'center' }}>
          <Statistic
            value={formatCountdown(countdown)}
            valueStyle={{ fontSize: 48, color: countdownColor, fontFamily: 'monospace' }}
          />
        </Card>

        {warning && <Alert message={warning} type="warning" showIcon style={{ marginBottom: 16 }} />}

        <Space direction="vertical" style={{ width: '100%' }}>
          {meeting?.status === 'in_progress' && (
            <Button danger block size="large" onClick={handleEnd}>End Meeting</Button>
          )}
          <Button block onClick={() => navigate('/meetings')}>Back to List</Button>
        </Space>
      </div>
    </div>
  );
}
