import { useEffect, useState } from 'react';
import { Table, Button, Space, Card, Input, Drawer, Form, InputNumber, Tag, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { getDoctors, createDoctor, updateDoctor, deleteDoctor, toggleDoctorStatus } from '../api/client';
import useSocket from '../hooks/useSocket';

export default function Doctors() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const loadData = async () => {
    try {
      const res = await getDoctors({ page, limit: 15, search: search || undefined });
      setData(res.data);
      setTotal(res.total);
    } catch { /* ignore */ }
  };

  useEffect(() => { loadData(); }, [page, search]);
  useSocket({ 'doctor:status-changed': loadData });

  const openCreate = () => { setEditing(null); form.resetFields(); setDrawerOpen(true); };
  const openEdit = (record) => { setEditing(record); form.setFieldsValue(record); setDrawerOpen(true); };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      if (editing) {
        await updateDoctor(editing.uuid, values);
        message.success('Doctor updated');
      } else {
        await createDoctor(values);
        message.success('Doctor created');
      }
      setDrawerOpen(false);
      loadData();
    } catch (err) {
      if (err.error) message.error(err.error);
    } finally { setLoading(false); }
  };

  const handleToggleStatus = async (uuid) => {
    await toggleDoctorStatus(uuid);
    loadData();
  };

  const handleDelete = async (uuid) => {
    await deleteDoctor(uuid);
    message.success('Doctor deactivated');
    loadData();
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Specialty', dataIndex: 'specialty', key: 'specialty' },
    { title: 'Department', dataIndex: 'department', key: 'department' },
    { title: 'Title', dataIndex: 'title', key: 'title' },
    { title: 'Phone', dataIndex: 'phone', key: 'phone' },
    { title: 'Max Duration', dataIndex: 'max_meeting_duration', key: 'dur', render: (v) => v ? `${v} min` : 'Default' },
    { title: 'Status', dataIndex: 'is_online', key: 'online', render: (v) => v ? <Tag color="green">Online</Tag> : <Tag>Offline</Tag> },
    {
      title: 'Actions', key: 'actions', render: (_, row) => (
        <Space>
          <Button size="small" onClick={() => handleToggleStatus(row.uuid)}>
            {row.is_online ? 'Set Offline' : 'Set Online'}
          </Button>
          <Button size="small" onClick={() => openEdit(row)}>Edit</Button>
          <Button size="small" danger onClick={() => handleDelete(row.uuid)}>Deactivate</Button>
        </Space>
      ),
    },
  ];

  return (
    <Card title="Doctor Management" extra={
      <Space>
        <Input.Search placeholder="Search..." onSearch={setSearch} allowClear style={{ width: 240 }} />
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add Doctor</Button>
      </Space>
    }>
      <Table dataSource={data} columns={columns} rowKey="uuid" size="small"
        pagination={{ current: page, pageSize: 15, total, onChange: setPage }} />

      <Drawer title={editing ? 'Edit Doctor' : 'Add Doctor'} width={420} open={drawerOpen} onClose={() => setDrawerOpen(false)}
        footer={<Space><Button onClick={() => setDrawerOpen(false)}>Cancel</Button><Button type="primary" loading={loading} onClick={handleSubmit}>Save</Button></Space>}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="specialty" label="Specialty"><Input /></Form.Item>
          <Form.Item name="department" label="Department"><Input /></Form.Item>
          <Form.Item name="title" label="Title"><Input /></Form.Item>
          <Form.Item name="phone" label="Phone"><Input /></Form.Item>
          <Form.Item name="email" label="Email"><Input /></Form.Item>
          <Form.Item name="max_meeting_duration" label="Max Duration Override (minutes)">
            <InputNumber min={1} max={120} style={{ width: '100%' }} placeholder="Leave empty for system default" />
          </Form.Item>
        </Form>
      </Drawer>
    </Card>
  );
}
