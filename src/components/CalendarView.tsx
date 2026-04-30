import React from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { Task } from '../types';
import { format, isSameDay, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import './CalendarView.css';

interface CalendarViewProps {
  tasks: Task[];
}

export default function CalendarView({ tasks }: CalendarViewProps) {
  const tileContent = ({ date, view }: { date: Date; view: string }) => {
    if (view === 'month') {
      const dayTasks = tasks.filter((t) => {
        const deadlineDate = t.deadline?.toDate ? t.deadline.toDate() : new Date(t.deadline);
        return isSameDay(deadlineDate, date);
      });
      if (dayTasks.length > 0) {
        return (
          <div className="flex justify-center mt-1 gap-0.5">
            {dayTasks.slice(0, 3).map((t) => (
              <div 
                key={t.id} 
                className={`w-1.5 h-1.5 rounded-full ${
                  t.priority === 'high' ? 'bg-pink-400' : 
                  t.priority === 'medium' ? 'bg-blue-400' : 'bg-green-400'
                }`} 
              />
            ))}
            {dayTasks.length > 3 && <div className="text-[8px] font-bold text-zinc-400 line-none">+</div>}
          </div>
        );
      }
    }
    return null;
  };

  return (
    <div className="card-cute p-6 overflow-hidden">
      <Calendar 
        locale="id-ID"
        tileContent={tileContent}
        className="mytugas-calendar"
        next2Label={null}
        prev2Label={null}
      />
      <div className="mt-6 flex gap-4 text-xs font-bold text-zinc-400 dark:text-zinc-500 justify-center">
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-pink-400" /> Tinggi</div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-400" /> Sedang</div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-400" /> Rendah</div>
      </div>
    </div>
  );
}
