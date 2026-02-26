import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Tag, Button, Statistic, Alert, message, Space } from 'antd';
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
  const iframeRef = useRef(null);
  const timerRef = useRef(null);

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
      // Get doctor join info for iframe
      const info = await getMeetingJoinInfo(uuid, 'doctor');
      setJoinInfo(info);
    } catch {
      message.error('Failed to load meeting');
    }
  };

  const startCountdown = (startAt, maxMinutes) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - new Date(startAt).getTime()) / 1000;
      const remaining = maxMinutes * 60 - elapsed;
      if (remaining <= 0) {
        setCountdown(0);
        clearInterval(timerRef.current);
      } else {
        setCountdown(Math.floor(remaining));
      }
    }, 1000);
  };

  useSocket({
    'meeting:duration-warning': (data) => {
      if (data.meetingUuid === uuid) setWarning(`${data.remainingMinutes} minute(s) remaining`);
    },
    'meeting:auto-ended': (data) => {
      if (data.meetingUuid === uuid) {
        message.info('Meeting auto-ended (timeout)');
        loadMeeting();
      }
    },
    'meeting:ended': (data) => {
      if (data.meetingUuid === uuid) loadMeeting();
    },
  });

  const handleEnd = async () => {
    try {
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

  const jitsiDomain = (import.meta.env.VITE_JITSI_DOMAIN || 'meet.localhost:8443');

  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 180px)' }}>
      {/* Left: Jitsi Room */}
      <div style={{ flex: 7, minHeight: 500 }}>
        {joinInfo && meeting?.status === 'in_progress' ? (
          <iframe
            ref={iframeRef}
            src={joinInfo.joinUrl}
            style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8 }}
            allow="camera; microphone; display-capture; autoplay; clipboard-write"
            allowFullScreen
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
