import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Tag, Space, Card, Select, Drawer, Form, InputNumber, Switch, Input, message, Modal, Typography } from 'antd';
import { PlusOutlined, CopyOutlined } from '@ant-design/icons';
import { getMeetings, createMeeting, startMeeting, endMeeting, cancelMeeting, getDoctors, getPatients } from '../api/client';
import useSocket from '../hooks/useSocket';
import dayjs from 'dayjs';

const { Paragraph } = Typography;

const statusColors = {
  scheduled: 'blue', waiting: 'orange', in_progress: 'green',
  completed: 'default', cancelled: 'red', expired: 'volcano',
};

const scenarioOptions = [
  { value: 'general', label: 'General Consultation' },
  { value: 'followup', label: 'Follow-up' },
  { value: 'specialist', label: 'Specialist' },
  { value: 'emergency', label: 'Emergency' },
];

export default function Meetings() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [resultModal, setResultModal] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const loadData = async (p = page, s = statusFilter) => {
    try {
      const res = await getMeetings({ page: p, limit: 15, status: s });
      setData(res.data);
      setTotal(res.total);
    } catch { /* ignore */ }
  };

  useEffect(() => { loadData(); }, [page, statusFilter]);
  useSocket({ 'meeting:created': () => loadData(), 'meeting:started': () => loadData(), 'meeting:ended': () => loadData(), 'meeting:cancelled': () => loadData() });

  const openDrawer = async () => {
    const [d, p] = await Promise.all([getDoctors({ limit: 100 }), getPatients({ limit: 100 })]);
    setDoctors(d.data || []);
    setPatients(p.data || []);
    form.resetFields();
    setDrawerOpen(true);
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const res = await createMeeting(values);
      message.success('Meeting created');
      setDrawerOpen(false);
      setResultModal(res);
      loadData();
    } catch (err) {
      if (err.error) message.error(err.error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (uuid, action) => {
    try {
      if (action === 'start') await startMeeting(uuid);
      else if (action === 'end') await endMeeting(uuid, 'normal');
      else if (action === 'cancel') await cancelMeeting(uuid);
      message.success(`Meeting ${action}ed`);
      loadData();
    } catch (err) {
      message.error(err.error || 'Action failed');
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'uuid', key: 'uuid', width: 100, render: (v) => v?.slice(0, 8) },
    { title: 'Doctor', dataIndex: ['doctor', 'name'], key: 'doctor' },
    { title: 'Patient', dataIndex: ['patient', 'name'], key: 'patient' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (s) => <Tag color={statusColors[s]}>{s}</Tag> },
    { title: 'Scenario', dataIndex: 'scenario', key: 'scenario' },
    { title: 'Max Dur', dataIndex: 'max_duration_minutes', key: 'dur', render: (v) => `${v}m` },
    { title: 'Actual Dur', dataIndex: 'duration_seconds', key: 'actual', render: (v) => v ? `${Math.floor(v / 60)}m` : '-' },
    { title: 'Created', dataIndex: 'created_at', key: 'created', render: (v) => dayjs(v).format('MM-DD HH:mm') },
    {
      title: 'Actions', key: 'actions', render: (_, row) => (
        <Space size="small">
          {row.status === 'scheduled' && <Button size="small" type="primary" onClick={() => handleAction(row.uuid, 'start')}>Start</Button>}
          {row.status === 'in_progress' && <Button size="small" danger onClick={() => handleAction(row.uuid, 'end')}>End</Button>}
          {['scheduled', 'waiting'].includes(row.status) && <Button size="small" onClick={() => handleAction(row.uuid, 'cancel')}>Cancel</Button>}
          {row.status === 'in_progress' && <Button size="small" onClick={() => navigate(`/meetings/${row.uuid}`)}>Room</Button>}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title="Meeting Management"
        extra={
          <Space>
            <Select allowClear placeholder="Filter status" value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} style={{ width: 160 }} options={[
              { value: 'scheduled', label: 'Scheduled' }, { value: 'in_progress', label: 'In Progress' },
              { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' },
            ]} />
            <Button type="primary" icon={<PlusOutlined />} onClick={openDrawer}>Create Consultation</Button>
          </Space>
        }
      >
        <Table dataSource={data} columns={columns} rowKey="uuid" size="small"
          pagination={{ current: page, pageSize: 15, total, onChange: setPage }} />
      </Card>

      <Drawer title="Create Consultation" width={480} open={drawerOpen} onClose={() => setDrawerOpen(false)}
        footer={<Space><Button onClick={() => setDrawerOpen(false)}>Cancel</Button><Button type="primary" loading={loading} onClick={handleCreate}>Create</Button></Space>}>
        <Form form={form} layout="vertical" initialValues={{ scenario: 'general', is_encrypted: true }}>
          <Form.Item name="patient_uuid" label="Patient" rules={[{ required: true }]}>
            <Select showSearch placeholder="Select patient" optionFilterProp="label"
              options={patients.map((p) => ({ value: p.uuid, label: `${p.name} (${p.phone || p.email || ''})` }))} />
          </Form.Item>
          <Form.Item name="doctor_uuid" label="Doctor" rules={[{ required: true }]}>
            <Select showSearch placeholder="Select doctor" optionFilterProp="label"
              options={doctors.map((d) => ({ value: d.uuid, label: `${d.name} - ${d.specialty || ''} ${d.is_online ? '[Online]' : ''}` }))} />
          </Form.Item>
          <Form.Item name="scenario" label="Scenario">
            <Select options={scenarioOptions} />
          </Form.Item>
          <Form.Item name="max_duration" label="Max Duration (minutes, leave empty for auto)">
            <InputNumber min={1} max={120} style={{ width: '100%' }} placeholder="Auto-resolve from config" />
          </Form.Item>
          <Form.Item name="is_encrypted" label="Encrypted Room" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Drawer>

      <Modal title="Meeting Created" open={!!resultModal} onOk={() => setResultModal(null)} onCancel={() => setResultModal(null)} width={600}>
        {resultModal && (
          <div>
            <p><strong>Meeting UUID:</strong> {resultModal.meeting?.uuid}</p>
            <p><strong>Room:</strong> {resultModal.meeting?.room_name}</p>
            <p><strong>Max Duration:</strong> {resultModal.meeting?.max_duration_minutes} minutes</p>
            <p><strong>Encrypted:</strong> {resultModal.meeting?.is_encrypted ? 'Yes' : 'No'}</p>
            <Card size="small" title="Doctor Join Link" style={{ marginBottom: 12 }}>
              <Paragraph copyable={{ text: resultModal.doctorJoinUrl }} ellipsis={{ rows: 2 }}>{resultModal.doctorJoinUrl}</Paragraph>
            </Card>
            <Card size="small" title="Patient Join Link">
              <Paragraph copyable={{ text: resultModal.patientJoinUrl }} ellipsis={{ rows: 2 }}>{resultModal.patientJoinUrl}</Paragraph>
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
}
