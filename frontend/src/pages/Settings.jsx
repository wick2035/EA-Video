import { useEffect, useState } from 'react';
import { Card, Table, Input, Button, message, Tag } from 'antd';
import { getConfigs, updateConfig } from '../api/client';

export default function Settings() {
  const [configs, setConfigs] = useState([]);
  const [editingKey, setEditingKey] = useState(null);
  const [editValue, setEditValue] = useState('');

  const loadData = async () => {
    try {
      const res = await getConfigs();
      setConfigs(res);
    } catch { /* ignore */ }
  };

  useEffect(() => { loadData(); }, []);

  const handleSave = async (key) => {
    try {
      await updateConfig(key, editValue);
      message.success('Config updated');
      setEditingKey(null);
      loadData();
    } catch (err) {
      message.error(err.error || 'Failed to update');
    }
  };

  const categoryColors = {
    meeting: 'blue',
    security: 'red',
    general: 'default',
  };

  const columns = [
    { title: 'Category', dataIndex: 'category', key: 'category', render: (v) => <Tag color={categoryColors[v] || 'default'}>{v}</Tag> },
    { title: 'Key', dataIndex: 'config_key', key: 'key' },
    {
      title: 'Value', dataIndex: 'config_value', key: 'value',
      render: (v, row) =>
        editingKey === row.config_key ? (
          <Input size="small" value={editValue} onChange={(e) => setEditValue(e.target.value)} style={{ width: 200 }} />
        ) : (
          <strong>{v}</strong>
        ),
    },
    { title: 'Description', dataIndex: 'description', key: 'desc' },
    {
      title: 'Actions', key: 'actions',
      render: (_, row) =>
        editingKey === row.config_key ? (
          <>
            <Button size="small" type="primary" onClick={() => handleSave(row.config_key)} style={{ marginRight: 8 }}>Save</Button>
            <Button size="small" onClick={() => setEditingKey(null)}>Cancel</Button>
          </>
        ) : (
          <Button size="small" onClick={() => { setEditingKey(row.config_key); setEditValue(row.config_value); }}>Edit</Button>
        ),
    },
  ];

  return (
    <Card title="System Configuration">
      <Table dataSource={configs} columns={columns} rowKey="config_key" pagination={false} size="small" />
    </Card>
  );
}
