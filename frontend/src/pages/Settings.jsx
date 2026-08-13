import React, { useState, useEffect } from 'react';
import { Save, Bell, Trash2, User, Mail, Phone, Calendar, Clock } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Settings() {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState({
    name: user?.name || '',
    whatsapp_number: user?.whatsapp_number || '',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [reminderForm, setReminderForm] = useState({
    issue_id_input: '',
    date: '',
    time: '',
    notify_email: false,
    notify_whatsapp: false,
  });
  const [savingReminder, setSavingReminder] = useState(false);
  const [reminders, setReminders] = useState([]);
  const [loadingReminders, setLoadingReminders] = useState(true);

  const fetchReminders = async () => {
    try {
      const { data } = await api.get('/issues/reminders');
      setReminders(data);
    } catch (err) {
      console.error('Failed to fetch reminders:', err);
    } finally {
      setLoadingReminders(false);
    }
  };

  useEffect(() => { fetchReminders(); }, []);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    if (!profile.name.trim()) { toast.error('Name cannot be empty'); return; }
    setSavingProfile(true);
    try {
      const { data } = await api.patch('/auth/users/me', {
        name: profile.name,
        whatsapp_number: profile.whatsapp_number,
      });
      updateUser(data);
      toast.success('Profile updated successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCreateReminder = async (e) => {
    e.preventDefault();
    const { issue_id_input, date, time, notify_email, notify_whatsapp } = reminderForm;
    if (!issue_id_input) { toast.error('Please enter an issue number'); return; }
    if (!date || !time) { toast.error('Please select date and time'); return; }
    if (!notify_email && !notify_whatsapp) { toast.error('Please choose at least one notification channel'); return; }
    if (notify_whatsapp && !user.whatsapp_number) {
      toast.error('Please save a WhatsApp number in Profile Settings first');
      return;
    }
    setSavingReminder(true);
    try {
      const scheduled_time = `${date}T${time}:00`;
      await api.post('/issues/reminders', {
        issue_id_input: parseInt(issue_id_input),
        scheduled_time,
        notify_email,
        notify_whatsapp,
      });
      toast.success('Reminder scheduled successfully!');
      setReminderForm({ issue_id_input: '', date: '', time: '', notify_email: false, notify_whatsapp: false });
      fetchReminders();
    } catch (err) {
      const errMsg = err.response?.data?.issue_id_input?.[0] || err.response?.data?.message || 'Failed to schedule reminder';
      toast.error(errMsg);
    } finally {
      setSavingReminder(false);
    }
  };

  const handleDeleteReminder = async (id) => {
    try {
      await api.delete(`/issues/reminders/${id}`);
      toast.success('Reminder deleted');
      setReminders(reminders.filter(r => r.id !== id));
    } catch (err) {
      toast.error('Failed to delete reminder');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-4 md:p-6">
      <div>
        <h1 className="text-3xl font-extrabold text-[#1e3a5f]">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Configure your personal profile details and set issue reminders</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#d1dce8]">
              <div className="p-2 bg-blue-50 text-[#4361ee] rounded-lg"><User size={20} /></div>
              <h2 className="text-xl font-bold text-gray-900">Profile Settings</h2>
            </div>
            <form onSubmit={handleProfileSave} className="space-y-5">
              <div>
                <label className="label">Full Name</label>
                <input type="text" className="input" placeholder="e.g. Ashwina J" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
              </div>
              <div>
                <label className="label">WhatsApp Number</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 text-sm">+</span>
                  <input type="tel" className="input pl-7" placeholder="917904179377" value={profile.whatsapp_number.replace(/^\+/, '')} onChange={(e) => setProfile({ ...profile, whatsapp_number: '+' + e.target.value.replace(/\D/g, '') })} />
                </div>
                <p className="text-xs text-gray-400 mt-1">Include country code (e.g. 91 for India) without spacing.</p>
              </div>
              <div className="pt-2">
                <button type="submit" disabled={savingProfile} className="btn-primary w-full flex justify-center py-2.5 font-bold">
                  <Save size={16} />
                  {savingProfile ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#d1dce8]">
            <div className="p-2 bg-blue-50 text-[#f69050] rounded-lg"><Bell size={20} /></div>
            <h2 className="text-xl font-bold text-gray-900">Create Reminder</h2>
          </div>
          <form onSubmit={handleCreateReminder} className="space-y-4">
            <div>
              <label className="label">Issue Number</label>
              <input type="number" className="input" placeholder="e.g. 42" value={reminderForm.issue_id_input} onChange={(e) => setReminderForm({ ...reminderForm, issue_id_input: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label flex items-center gap-1"><Calendar size={13} className="text-gray-500" /> Date</label>
                <input type="date" className="input" value={reminderForm.date} onChange={(e) => setReminderForm({ ...reminderForm, date: e.target.value })} />
              </div>
              <div>
                <label className="label flex items-center gap-1"><Clock size={13} className="text-gray-500" /> Time</label>
                <input type="time" className="input" value={reminderForm.time} onChange={(e) => setReminderForm({ ...reminderForm, time: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label mb-2">Notify Via</label>
              <div className="flex gap-6 mt-1">
                <label className="flex items-center gap-2 text-sm text-gray-700 font-medium cursor-pointer select-none">
                  <input type="checkbox" className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300" checked={reminderForm.notify_email} onChange={(e) => setReminderForm({ ...reminderForm, notify_email: e.target.checked })} />
                  <Mail size={14} className="text-blue-500 inline" /> Email
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 font-medium cursor-pointer select-none">
                  <input type="checkbox" className="w-4 h-4 rounded text-green-600 focus:ring-green-500 border-gray-300" checked={reminderForm.notify_whatsapp} onChange={(e) => setReminderForm({ ...reminderForm, notify_whatsapp: e.target.checked })} />
                  <Phone size={14} className="text-green-500 inline" /> WhatsApp
                </label>
              </div>
            </div>
            <div className="pt-2">
              <button type="submit" disabled={savingReminder} className="btn-primary w-full flex justify-center py-2.5 font-bold" style={{ backgroundColor: '#f69050' }}>
                <Bell size={16} />
                {savingReminder ? 'Saving Reminder...' : 'Save Reminder'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#d1dce8]">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">Active Scheduled Reminders</h2>
          <span className="badge bg-blue-100 text-blue-800">{reminders.length} pending</span>
        </div>
        {loadingReminders ? (
          <div className="py-8 text-center text-gray-500">Loading reminders...</div>
        ) : reminders.length === 0 ? (
          <div className="py-10 text-center border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center">
            <Bell size={32} className="text-gray-300 mb-2" />
            <p className="text-sm font-semibold text-gray-500">No scheduled reminders found</p>
            <p className="text-xs text-gray-400 mt-1">Use the form above to add reminders for your pending issues</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#d1dce8] text-sm text-gray-500">
                  <th className="py-3 px-2 font-semibold">Issue</th>
                  <th className="py-3 px-2 font-semibold">Scheduled Time</th>
                  <th className="py-3 px-2 font-semibold">Channels</th>
                  <th className="py-3 px-2 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d1dce8]">
                {reminders.map((rem) => {
                  const sTime = new Date(rem.scheduled_time);
                  return (
                    <tr key={rem.id} className="text-sm text-gray-800 hover:bg-gray-50">
                      <td className="py-4 px-2">
                        <div className="font-semibold text-[#1e3a5f]">#{rem.issue?.issue_id}</div>
                        <div className="text-xs text-gray-500 font-medium line-clamp-1 max-w-xs">{rem.issue?.title}</div>
                      </td>
                      <td className="py-4 px-2">
                        <div className="font-semibold">{sTime.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1 font-medium mt-0.5">
                          <Clock size={11} /> {sTime.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="py-4 px-2">
                        <div className="flex gap-2">
                          {rem.notify_email && <span className="badge bg-blue-50 text-blue-700 border border-blue-100 flex items-center gap-1"><Mail size={10} /> Email</span>}
                          {rem.notify_whatsapp && <span className="badge bg-green-50 text-green-700 border border-green-100 flex items-center gap-1"><Phone size={10} /> WhatsApp</span>}
                        </div>
                      </td>
                      <td className="py-4 px-2 text-right">
                        <button onClick={() => handleDeleteReminder(rem.id)} className="p-2 hover:bg-red-50 text-red-500 hover:text-red-700 rounded-lg transition-colors inline-flex items-center gap-1" title="Delete Reminder">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}