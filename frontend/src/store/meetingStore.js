import { create } from 'zustand';

const useMeetingStore = create((set) => ({
  activeMeetings: [],
  stats: { totalToday: 0, activeNow: 0, onlineDoctors: 0, avgDurationMinutes: 0 },

  setActiveMeetings: (meetings) => set({ activeMeetings: meetings }),
  setStats: (stats) => set({ stats }),

  addMeeting: (meeting) =>
    set((state) => ({ activeMeetings: [meeting, ...state.activeMeetings] })),

  removeMeeting: (uuid) =>
    set((state) => ({
      activeMeetings: state.activeMeetings.filter((m) => m.uuid !== uuid),
    })),

  updateMeetingStatus: (uuid, status) =>
    set((state) => ({
      activeMeetings: state.activeMeetings.map((m) =>
        m.uuid === uuid ? { ...m, status } : m
      ),
    })),
}));

export default useMeetingStore;
