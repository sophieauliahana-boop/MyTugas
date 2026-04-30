import React, { useState } from 'react';
import { Priority, Task } from '../types';
import { Plus, X, Calendar, Clock, Star } from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';

interface TaskFormProps {
  onAdd: (task: { title: string; deadline: string; priority: Priority }) => void;
  onClose: () => void;
  initialData?: Task;
}

export default function TaskForm({ onAdd, onClose, initialData }: TaskFormProps) {
  const [title, setTitle] = useState(initialData?.title || '');
  
  const getInitialDate = () => {
    if (initialData) {
      const d = initialData.deadline?.toDate ? initialData.deadline.toDate() : new Date(initialData.deadline);
      return format(d, 'yyyy-MM-dd');
    }
    return format(new Date(), 'yyyy-MM-dd');
  };

  const getInitialTime = () => {
    if (initialData) {
      const d = initialData.deadline?.toDate ? initialData.deadline.toDate() : new Date(initialData.deadline);
      return format(d, 'HH:mm');
    }
    return format(new Date(), 'HH:mm');
  };

  const [date, setDate] = useState(getInitialDate());
  const [time, setTime] = useState(getInitialTime());
  const [priority, setPriority] = useState<Priority>(initialData?.priority || 'medium');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const deadline = new Date(`${date}T${time}`).toISOString();
    onAdd({ title, deadline, priority });
    onClose();
  };

  const priorities: { value: Priority; label: string; color: string }[] = [
    { value: 'low', label: 'Rendah', color: 'bg-brand-mint text-emerald-800' },
    { value: 'medium', label: 'Sedang', color: 'bg-brand-blue text-blue-800' },
    { value: 'high', label: 'Tinggi', color: 'bg-brand-pink text-rose-800' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="p-8 bg-white dark:bg-zinc-800 rounded-[3rem] shadow-2xl border border-pink-100 dark:border-pink-500/10 max-w-md w-full mx-auto relative overflow-hidden transition-colors"
      id="task-form-container"
    >
      {/* Decorative circle */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-brand-pink/20 rounded-full blur-2xl" />
      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-brand-blue/20 rounded-full blur-2xl" />

      <div className="flex justify-between items-center mb-8 relative z-10">
        <div>
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-blue-400" id="form-title">
            {initialData ? 'Ubah Tugas' : 'Tambah Tugas'}
          </h2>
          <p className="text-zinc-400 dark:text-zinc-500 text-sm font-medium mt-1">
            {initialData ? 'Perbarui detail tugasmu! ✏️' : 'Isi detail tugasmu yuk! ✨'}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-3 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 rounded-2xl transition-colors group"
          id="close-form-btn"
        >
          <X className="w-6 h-6 text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-500" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 relative z-10" id="add-task-form">
        <div className="space-y-2">
          <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-500 uppercase tracking-[0.15em] ml-1">Nama Tugas</label>
          <input
            autoFocus
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Misal: Tugas Informatika"
            className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-900 border-2 border-transparent focus:border-brand-pink/30 rounded-3xl focus:outline-none transition-all text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-300 dark:placeholder:text-zinc-700 font-medium"
            required
            id="task-title-input"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-500 uppercase tracking-[0.15em] ml-1">Prioritas</label>
          <div className="flex gap-3">
            {priorities.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPriority(p.value)}
                className={cn(
                  "flex-1 py-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                  priority === p.value 
                    ? p.color + " shadow-md border-2 border-transparent" 
                    : "bg-zinc-50 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-600 border-2 border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-700/30"
                )}
              >
                <Star className={cn("w-3.5 h-3.5", priority === p.value ? "fill-current" : "")} />
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-500 uppercase tracking-[0.15em] ml-1 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-brand-pink" /> Tanggal
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-900 border-2 border-transparent focus:border-brand-pink/30 rounded-3xl focus:outline-none transition-all text-zinc-800 dark:text-zinc-100 font-medium"
              required
              id="task-date-input"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-500 uppercase tracking-[0.15em] ml-1 flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-blue" /> Waktu
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-900 border-2 border-transparent focus:border-brand-pink/30 rounded-3xl focus:outline-none transition-all text-zinc-800 dark:text-zinc-100 font-medium"
              required
              id="task-time-input"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-5 bg-gradient-to-r from-pink-400 to-pink-500 hover:from-pink-500 hover:to-pink-600 text-white font-bold rounded-3xl shadow-[0_10px_20px_rgba(255,181,215,0.4)] dark:shadow-pink-500/10 transition-all flex items-center justify-center gap-3 mt-6 active:scale-95 text-lg"
          id="submit-task-btn"
        >
          <Plus className="w-6 h-6 stroke-[3px]" />
          Simpan Tugas
        </button>
      </form>
    </motion.div>
  );
}
