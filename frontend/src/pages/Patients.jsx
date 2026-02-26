import { useEffect, useState } from 'react';
import { Table, Button, Space, Card, Input, Drawer, Form, Select, DatePicker, message } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { getPatients, createPatient, updatePatient, deletePatient } from '../api/client';
import dayjs from 'dayjs';

export default function Patients() {
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
      const res = await getPatients({ page, limit: 15, search: search || undefined });
      setData(res.data);
      setTotal(res.total);
    } catch { /* ignore */ }
  };

  useEffect(() => { loadData(); }, [page, search]);

  const openCreate = () => { setEditing(null); form.resetFields(); setDrawerOpen(true); };
  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      ...record,
      date_of_birth: record.date_of_birth ? dayjs(record.date_of_birth) : null,
    });
    setDrawerOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (values.date_of_birth) values.date_of_birth = values.date_of_birth.format('YYYY-MM-DD');
      setLoading(true);
      if (editing) {
        await updatePatient(editing.uuid, values);
        message.success('Patient updated');
      } else {
        await createPatient(values);
        message.success('Patient created');
      }
      setDrawerOpen(false);
      loadData();
    } catch (err) {
      if (err.error) message.error(err.error);
    } finally { setLoading(false); }
  };

  const handleDelete = async (uuid) => {
    await deletePatient(uuid);
    message.success('Patient deactivated');
    loadData();
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Phone', dataIndex: 'phone', key: 'phone' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Gender', dataIndex: 'gender', key: 'gender' },
    { title: 'DOB', dataIndex: 'date_of_birth', key: 'dob', render: (v) => v || '-' },
    {
      title: 'Actions', key: 'actions', render: (_, row) => (
        <Space>
          <Button size="small" onClick={() => openEdit(row)}>Edit</Button>
          <Button size="small" danger onClick={() => handleDelete(row.uuid)}>Deactivate</Button>
        </Space>
      ),
    },
  ];

  return (
    <Card title="Patient Management" extra={
      <Space>
        <Input.Search placeholder="Search..." onSearch={setSearch} allowClear style={{ width: 240 }} />
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add Patient</Button>
      </Space>
    }>
      <Table dataSource={data} columns={columns} rowKey="uuid" size="small"
        pagination={{ current: page, pageSize: 15, total, onChange: setPage }} />

      <Drawer title={editing ? 'Edit Patient' : 'Add Patient'} width={420} open={drawerOpen} onClose={() => setDrawerOpen(false)}
        footer={<Space><Button onClick={() => setDrawerOpen(false)}>Cancel</Button><Button type="primary" loading={loading} onClick={handleSubmit}>Save</Button></Space>}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="phone" label="Phone"><Input /></Form.Item>
          <Form.Item name="email" label="Email"><Input /></Form.Item>
          <Form.Item name="gender" label="Gender"><Select allowClear options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }]} /></Form.Item>
          <Form.Item name="date_of_birth" label="Date of Birth"><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="id_number" label="ID Number"><Input /></Form.Item>
          <Form.Item name="notes" label="Notes"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Drawer>
    </Card>
  );
}
