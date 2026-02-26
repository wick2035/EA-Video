import axios from 'axios';

const client = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err.response?.data || err);
  }
);

// --- API functions ---

// Auth
export const login = (data) => client.post('/auth/login', data);

// Patients
export const getPatients = (params) => client.get('/patients', { params });
export const getPatient = (uuid) => client.get(`/patients/${uuid}`);
export const createPatient = (data) => client.post('/patients', data);
export const updatePatient = (uuid, data) => client.put(`/patients/${uuid}`, data);
export const deletePatient = (uuid) => client.delete(`/patients/${uuid}`);

// Doctors
export const getDoctors = (params) => client.get('/doctors', { params });
export const getDoctor = (uuid) => client.get(`/doctors/${uuid}`);
export const createDoctor = (data) => client.post('/doctors', data);
export const updateDoctor = (uuid, data) => client.put(`/doctors/${uuid}`, data);
export const deleteDoctor = (uuid) => client.delete(`/doctors/${uuid}`);
export const getOnlineDoctors = () => client.get('/doctors/online');
export const toggleDoctorStatus = (uuid) => client.patch(`/doctors/${uuid}/status`);

// Meetings
export const getMeetings = (params) => client.get('/meetings', { params });
export const getMeeting = (uuid) => client.get(`/meetings/${uuid}`);
export const createMeeting = (data) => client.post('/meetings', data);
export const startMeeting = (uuid) => client.patch(`/meetings/${uuid}/start`);
export const endMeeting = (uuid, reason) => client.patch(`/meetings/${uuid}/end`, { reason });
export const cancelMeeting = (uuid) => client.patch(`/meetings/${uuid}/cancel`);
export const getMeetingJoinInfo = (uuid, role) => client.get(`/meetings/${uuid}/join/${role}`);
export const getActiveMeetings = () => client.get('/meetings/active');
export const getMeetingStats = () => client.get('/meetings/stats');

// Config
export const getConfigs = () => client.get('/config');
export const updateConfig = (key, value) => client.put(`/config/${key}`, { config_value: value });

export default client;
