import React from 'react';
import { Task } from '../types';
import { Trash2, Clock, CheckCircle2, Circle, Star, User, Pencil } from 'lucide-react';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';

interface TaskItemProps {
  task: Task;
  onDelete: (id: string) => void | Promise<void>;
  onToggle: (id: string, completed: boolean) => void | Promise<void>;
  onEdit: (task: Task) => void;
}

export default function TaskItem({ task, onDelete, onToggle, onEdit }: TaskItemProps): React.JSX.Element {
  const { user } = useAuth();
  const isCreator = user?.uid === task.createdBy;
  const deadlineDate = task.deadline?.toDate ? task.deadline.toDate() : new Date(task.deadline);
  const isCompleted = task.completedBy?.includes(user?.uid || '');
  const isOverdue = isPast(deadlineDate) && !isCompleted;

  const priorityMeta = {
    low: { color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10', icon: 'M12 17l-5-4h10l-5 4z' },
    medium: { color: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10', icon: 'M12 17l-5-4h10l-5 4z' },
    high: { color: 'text-rose-500 bg-rose-50 dark:bg-rose-500/10', icon: 'M12 17l-5-4h10l-5 4z' }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={cn(
        "group p-6 bg-white dark:bg-zinc-800 rounded-[2.5rem] border-2 border-transparent transition-all hover:border-pink-100 dark:hover:border-pink-500/20 hover:shadow-xl hover:shadow-pink-100/20 dark:hover:shadow-black/40",
        isCompleted && "bg-zinc-50/50 dark:bg-zinc-900/50 grayscale-[0.5] opacity-60",
        isOverdue && "border-rose-100 dark:border-rose-500/30"
      )}
      id={`task-item-${task.id}`}
    >
      <div className="flex items-start gap-4">
        <button
          onClick={() => onToggle(task.id, !isCompleted)}
          className="flex-shrink-0 transition-transform active:scale-75 mt-1"
          id={`toggle-task-${task.id}`}
        >
          {isCompleted ? (
            <div className="w-10 h-10 rounded-2xl bg-brand-pink/20 flex items-center justify-center text-brand-pink shadow-inner">
              <CheckCircle2 className="w-6 h-6 stroke-[3px]" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-2xl bg-zinc-50 dark:bg-zinc-700/50 flex items-center justify-center text-zinc-300 dark:text-zinc-500 group-hover:bg-brand-pink/10 dark:group-hover:bg-brand-pink/20 group-hover:text-brand-pink transition-colors">
              <Circle className="w-6 h-6 stroke-[3px]" />
            </div>
          )}
        </button>

        <div className="flex-grow min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={cn(
              "text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1",
              priorityMeta[task.priority].color
            )}>
              <Star className="w-2.5 h-2.5 fill-current" />
              {task.priority === 'high' ? 'PENTING' : task.priority === 'medium' ? 'NORMAL' : 'SANTAI'}
            </span>
            {isOverdue && !isCompleted && (
              <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-rose-500 text-white animate-pulse">
                Terlewat!
              </span>
            )}
          </div>

          <h3 className={cn(
            "text-lg font-bold text-zinc-800 dark:text-zinc-100 leading-tight mb-2",
            isCompleted && "line-through text-zinc-400 dark:text-zinc-500"
          )} id={`task-title-${task.id}`}>
            {task.title}
          </h3>

          <div className="flex items-center gap-4 text-xs font-bold text-zinc-400 dark:text-zinc-500">
            <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-700/30 px-3 py-1.5 rounded-xl">
              <Clock className="w-3.5 h-3.5" />
              <span className="font-mono">{format(deadlineDate, 'HH:mm')}</span>
              <span className="opacity-30">•</span>
              <span>{format(deadlineDate, 'd MMM', { locale: idLocale })}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end justify-between self-stretch">
          <div className="flex -space-x-2">
             {task.completedBy && task.completedBy.length > 0 && (
               <div className="w-6 h-6 rounded-xl bg-brand-mint flex items-center justify-center text-[10px] text-zinc-700 border-2 border-white dark:border-zinc-800 font-black shadow-sm" title={`${task.completedBy.length} orang sudah selesai`}>
                 {task.completedBy.length}
               </div>
             )}
             <div className="w-6 h-6 rounded-xl bg-brand-blue flex items-center justify-center text-[10px] text-white border-2 border-white dark:border-zinc-800 font-black shadow-sm" title={`Ditambahkan oleh ${task.createdByName}`}>
               {task.createdByName.charAt(0)}
             </div>
          </div>
          
          <div className="flex items-center gap-1">
            {isCreator && (
              <button
                onClick={() => onEdit(task)}
                className="p-2 transition-all text-zinc-300 dark:text-zinc-600 hover:text-brand-blue hover:bg-brand-blue/10 rounded-xl"
                title="Edit Tugas"
                id={`edit-task-${task.id}`}
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
            {isCreator && (
              <button
                onClick={() => onDelete(task.id)}
                className="p-2 transition-all text-zinc-300 dark:text-zinc-600 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl"
                title="Hapus Tugas"
                id={`delete-task-${task.id}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
