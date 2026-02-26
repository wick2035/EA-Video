import { useEffect, useState, useCallback } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Button } from 'antd';
import { VideoCameraOutlined, TeamOutlined, ClockCircleOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { getMeetingStats, getActiveMeetings, getMeetings } from '../api/client';
import useSocket from '../hooks/useSocket';
import dayjs from 'dayjs';

const statusColors = {
  scheduled: 'blue',
  waiting: 'orange',
  in_progress: 'green',
  completed: 'default',
  cancelled: 'red',
  expired: 'volcano',
};

export default function Dashboard() {
  const [stats, setStats] = useState({ totalToday: 0, activeNow: 0, onlineDoctors: 0, avgDurationMinutes: 0 });
  const [active, setActive] = useState([]);
  const [recent, setRecent] = useState([]);

  const loadData = useCallback(async () => {
    try {
      const [s, a, r] = await Promise.all([
        getMeetingStats(),
        getActiveMeetings(),
        getMeetings({ status: 'completed', limit: 10 }),
      ]);
      setStats(s);
      setActive(a);
      setRecent(r.data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useSocket({
    'meeting:created': loadData,
    'meeting:started': loadData,
    'meeting:ended': loadData,
    'meeting:auto-ended': loadData,
    'meeting:cancelled': loadData,
    'doctor:status-changed': loadData,
  });

  const activeColumns = [
    { title: 'Meeting ID', dataIndex: 'uuid', key: 'uuid', render: (v) => v?.slice(0, 8) + '...' },
    { title: 'Doctor', dataIndex: ['doctor', 'name'], key: 'doctor' },
    { title: 'Patient', dataIndex: ['patient', 'name'], key: 'patient' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (s) => <Tag color={statusColors[s]}>{s}</Tag> },
    { title: 'Started', dataIndex: 'actual_start_at', key: 'start', render: (v) => v ? dayjs(v).format('HH:mm:ss') : '-' },
    { title: 'Max Duration', dataIndex: 'max_duration_minutes', key: 'dur', render: (v) => `${v} min` },
  ];

  const recentColumns = [
    { title: 'Meeting ID', dataIndex: 'uuid', key: 'uuid', render: (v) => v?.slice(0, 8) + '...' },
    { title: 'Doctor', dataIndex: ['doctor', 'name'], key: 'doctor' },
    { title: 'Patient', dataIndex: ['patient', 'name'], key: 'patient' },
    { title: 'Duration', dataIndex: 'duration_seconds', key: 'dur', render: (v) => v ? `${Math.floor(v / 60)} min` : '-' },
    { title: 'End Reason', dataIndex: 'end_reason', key: 'reason', render: (v) => v || '-' },
    { title: 'Ended At', dataIndex: 'actual_end_at', key: 'end', render: (v) => v ? dayjs(v).format('MM-DD HH:mm') : '-' },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card><Statistic title="Today's Meetings" value={stats.totalToday} prefix={<VideoCameraOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Active Now" value={stats.activeNow} prefix={<PlayCircleOutlined />} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Online Doctors" value={stats.onlineDoctors} prefix={<TeamOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Avg Duration" value={stats.avgDurationMinutes} suffix="min" prefix={<ClockCircleOutlined />} /></Card>
        </Col>
      </Row>

      <Card title="Active Meetings" style={{ marginBottom: 24 }}>
        <Table dataSource={active} columns={activeColumns} rowKey="uuid" pagination={false} size="small" />
      </Card>

      <Card title="Recent Completed">
        <Table dataSource={recent} columns={recentColumns} rowKey="uuid" pagination={false} size="small" />
      </Card>
    </div>
  );
}
