import { useState, useEffect, useCallback, useMemo } from 'react';
import { db, auth, signInWithGoogle } from './lib/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove,
  serverTimestamp,
  Timestamp,
  getDocs,
  where
} from 'firebase/firestore';
import { Task, Priority, UserProfile } from './types';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import TaskItem from './components/TaskItem';
import TaskForm from './components/TaskForm';
import ChatRoom from './components/ChatRoom';
import CalendarView from './components/CalendarView';
import { 
  Plus, Bell, ListTodo, Calendar, MessageSquare, 
  Settings as SettingsIcon, LogOut, Heart, 
  BellRing, Hash, ArrowRight, GraduationCap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { isPast, differenceInMinutes } from 'date-fns';
import { cn } from './lib/utils';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function MyTugasApp() {
  const { user, profile, loading, setGroupId, updateSettings } = useAuth();
  const [activeTab, setActiveTab] = useState<'tasks' | 'calendar' | 'chat' | 'settings'>('tasks');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [groupInput, setGroupInput] = useState('');
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  // Apply dark mode
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Load Tasks
  useEffect(() => {
    if (!profile?.groupId) return;
    const tasksRef = collection(db, 'groups', profile.groupId, 'tasks');
    // Security Best Practice: Always query with specific constraints that match rules
    const q = query(
      tasksRef, 
      where('groupId', '==', profile.groupId),
      orderBy('deadline', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Task[];
      setTasks(ts);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `groups/${profile.groupId}/tasks`);
    });

    return unsubscribe;
  }, [profile?.groupId]);

  // Notifications logic
  const sendNotification = useCallback((task: Task) => {
    if (Notification.permission === 'granted') {
      new Notification('Pengingat MyTugas! ⏰', {
        body: `Tugas "${task.title}" harus diselesaikan segera!`,
        icon: '/favicon.ico',
      });
    } else {
      alert(`MyTugas! ⏰: Tugas "${task.title}" jangan sampai lupa!`);
    }
  }, []);

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Alarm interval
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      tasks.forEach(task => {
        const isCompleted = task.completedBy?.includes(user?.uid || '');
        if (isCompleted) return;

        const deadline = task.deadline?.toDate ? task.deadline.toDate() : new Date(task.deadline);
        const diffMin = differenceInMinutes(deadline, now);
        
        const leadTime = profile?.settings?.notificationLeadTime || 10;

        // Check if we already reminded for this task in this session (local)
        const remindedKey = `reminded_${task.id}_${deadline.getTime()}`;
        if (diffMin <= leadTime && diffMin >= 0 && !sessionStorage.getItem(remindedKey)) {
          sendNotification(task);
          sessionStorage.setItem(remindedKey, 'true');
        }
      });
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [tasks, user?.uid, profile?.settings?.notificationLeadTime, sendNotification]);

  const saveTask = async (data: { title: string; deadline: string; priority: Priority }) => {
    if (!profile?.groupId || !user) return;
    
    if (editingTask) {
      const path = `groups/${profile.groupId}/tasks/${editingTask.id}`;
      try {
        await updateDoc(doc(db, path), {
          ...data,
          deadline: Timestamp.fromDate(new Date(data.deadline)),
        });
        setEditingTask(null);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    } else {
      const path = `groups/${profile.groupId}/tasks`;
      try {
        const tasksRef = collection(db, path);
        await addDoc(tasksRef, {
          ...data,
          deadline: Timestamp.fromDate(new Date(data.deadline)), // Store as Firebase Timestamp
          createdBy: user.uid,
          createdByName: profile.displayName || user.displayName || 'Anon',
          groupId: profile.groupId,
          createdAt: serverTimestamp(),
          completedBy: []
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!profile?.groupId) return;
    const path = `groups/${profile.groupId}/tasks/${taskId}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const toggleTask = async (taskId: string, completed: boolean) => {
    if (!profile?.groupId || !user) return;
    const path = `groups/${profile.groupId}/tasks/${taskId}`;
    try {
      const taskRef = doc(db, path);
      if (completed) {
        await updateDoc(taskRef, { completedBy: arrayUnion(user.uid) });
      } else {
        await updateDoc(taskRef, { completedBy: arrayRemove(user.uid) });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const [isAuthLoading, setIsAuthLoading] = useState(false);

  if (loading) {
    return (
      <div className={cn(
        "min-h-screen flex items-center justify-center transition-colors duration-500",
        isDarkMode ? "bg-dark-bg" : "bg-vanilla"
      )}>
        <motion.div 
          animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="w-16 h-16 bg-brand-pink rounded-3xl"
        />
      </div>
    );
  }

  const handleLogin = async () => {
    if (isAuthLoading) return;
    setIsAuthLoading(true);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      if (error.code !== 'auth/cancelled-popup-request' && error.code !== 'auth/popup-closed-by-user') {
        console.error('Login error:', error);
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  if (!user) {
    return (
      <div className={cn(
        "min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-500",
        isDarkMode ? "bg-dark-bg text-dark-text" : "bg-vanilla text-zinc-800"
      )}>
        {/* Playful background decos */}
        <div className="absolute top-20 right-10 w-64 h-64 bg-brand-pink/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-20 left-10 w-64 h-64 bg-brand-blue/20 rounded-full blur-[100px]" />
        
        {/* Theme toggle for landing page */}
        <button 
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="absolute top-6 right-6 p-4 glass rounded-2xl text-zinc-500 dark:text-zinc-400 hover:scale-110 active:scale-95 transition-all shadow-sm"
        >
          {isDarkMode ? '🌞' : '🌙'}
        </button>

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-sm w-full text-center relative z-10"
        >
          <div className="w-24 h-24 bg-brand-pink rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-pink-200 rotate-6 hover:rotate-0 transition-transform">
            <BellRing className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-5xl font-[900] mb-4 tracking-tighter">MyTugas</h1>
          <p className={cn(
            "text-lg font-medium mb-10 leading-relaxed px-4",
            isDarkMode ? "text-zinc-400" : "text-zinc-500"
          )}>
            Kelola tugas kelas makin seru & anti ribet bareng temen-temen! 🌈
          </p>
          <button 
            onClick={handleLogin}
            disabled={isAuthLoading}
            className={cn(
              "w-full py-5 rounded-3xl font-bold flex items-center justify-center gap-3 shadow-2xl hover:scale-[1.02] active:scale-95 transition-all text-lg",
              isDarkMode ? "bg-white text-black" : "bg-zinc-900 text-white",
              isAuthLoading && "opacity-50 cursor-not-allowed"
            )}
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="" />
            {isAuthLoading ? 'Sedang Masuk...' : 'Masuk dengan Google'}
          </button>
        </motion.div>
        
        <p className={cn(
          "mt-12 text-xs font-bold uppercase tracking-[0.2em] flex items-center gap-2",
          isDarkMode ? "text-zinc-600" : "text-zinc-300"
        )}>
          Made with <Heart className="w-3 h-3 fill-current text-pink-400" /> for community
        </p>
      </div>
    );
  }

  if (!profile?.groupId) {
    return (
      <div className={cn(
          "min-h-screen flex flex-col items-center justify-center p-6 transition-colors duration-500",
          isDarkMode ? "bg-dark-bg text-dark-text" : "bg-vanilla text-zinc-800"
        )}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full card-cute p-10 text-center"
        >
          <div className="w-20 h-20 bg-brand-blue/10 rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-brand-blue">
            <Hash className="w-10 h-10 stroke-[2.5px]" />
          </div>
          <h2 className="text-3xl font-[900] mb-3 tracking-tighter">Punya Kode Grup?</h2>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium mb-8">Masukkan kode atau buat grup baru untuk mulai kolaborasi bareng komunitasmu!</p>
          
          <div className="space-y-4">
            <div className="relative">
              <input 
                type="text" 
                value={groupInput}
                onChange={(e) => setGroupInput(e.target.value)}
                placeholder="CONTOH: KELAS-12A"
                className="w-full px-6 py-5 bg-zinc-50 dark:bg-zinc-800 dark:text-white border-2 border-transparent focus:border-brand-blue/30 rounded-[2rem] focus:outline-none text-center font-black tracking-widest text-lg transition-all"
              />
            </div>
            <button 
              onClick={() => {
                const trimmed = groupInput.trim().toUpperCase();
                if (trimmed) setGroupId(trimmed);
              }}
              className="w-full py-5 bg-brand-blue text-white rounded-[2rem] font-black shadow-xl shadow-blue-100 flex items-center justify-center gap-3 active:scale-95 transition-transform"
            >
              Gabung Sekarang <ArrowRight className="w-5 h-5" />
            </button>
            <div className="py-4 flex items-center gap-4">
              <div className="flex-1 h-[1px] bg-zinc-100 dark:bg-zinc-800"></div>
              <span className="text-[10px] font-black text-zinc-300 tracking-widest">ATAU</span>
              <div className="flex-1 h-[1px] bg-zinc-100 dark:bg-zinc-800"></div>
            </div>
            <button 
              onClick={() => setGroupId(`GROUP-${Math.random().toString(36).substring(2, 7).toUpperCase()}`)}
              className="w-full py-4 bg-white dark:bg-zinc-900 border-2 border-zinc-100 dark:border-zinc-800 text-zinc-400 rounded-[2rem] font-bold hover:border-brand-blue/30 hover:text-brand-blue transition-all active:scale-95"
            >
              Buat Grup Baru
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={cn(
      "min-h-screen pb-32 transition-colors duration-500",
      isDarkMode ? "bg-dark-bg text-dark-text" : "bg-vanilla text-zinc-800"
    )}>
      {/* Header */}
      <header className="p-6 pb-2">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white dark:bg-zinc-800 rounded-2xl flex items-center justify-center shadow-lg shadow-black/5 rotate-3 border-2 border-brand-pink/20 overflow-hidden">
              <GraduationCap className="w-8 h-8 text-brand-pink" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-[900] tracking-tighter leading-none text-zinc-900 dark:text-white drop-shadow-sm">MyTugas</h1>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-pink mt-1">{profile.groupId}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="w-12 h-12 glass rounded-2xl flex items-center justify-center text-xl hover:scale-110 active:scale-90 transition-all shadow-sm"
              aria-label="Toggle Theme"
            >
              {isDarkMode ? '🌞' : '🌙'}
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className="w-12 h-12 bg-white dark:bg-zinc-800 rounded-2xl flex items-center justify-center shadow-sm border border-zinc-100 dark:border-zinc-700 hover:scale-110 active:scale-90 transition-all overflow-hidden"
            >
              {profile.photoURL ? <img src={profile.photoURL} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" /> : <SettingsIcon className="w-5 h-5 text-zinc-400" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-6 py-6 mt-4">
        <AnimatePresence mode="wait">
          {activeTab === 'tasks' && (
            <motion.div
              key="tasks"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {tasks.length === 0 ? (
                <div className="text-center py-20 bg-white/50 dark:bg-zinc-800/50 border-4 border-dashed border-zinc-100 dark:border-zinc-700 rounded-[3rem]">
                  <p className="text-3xl mb-4">🪴</p>
                  <p className="text-zinc-400 font-bold text-lg mb-8">Grup ini masih kosong, nih!</p>
                  <button 
                    onClick={() => setShowAddForm(true)}
                    className="px-8 py-4 bg-brand-pink text-white rounded-2xl font-black shadow-xl shadow-pink-100 active:scale-95 transition-transform"
                  >
                    Tambah Tugas Pertama
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {tasks.map(task => (
                    <div key={task.id}>
                      <TaskItem 
                        task={task}
                        onDelete={deleteTask}
                        onToggle={toggleTask}
                        onEdit={(t) => {
                          setEditingTask(t);
                          setShowAddForm(true);
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'calendar' && (
            <motion.div
              key="calendar"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <CalendarView tasks={tasks} />
            </motion.div>
          )}

          {activeTab === 'chat' && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <ChatRoom />
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="card-cute p-8">
                <h3 className="text-xl font-black mb-8 flex items-center gap-3 text-zinc-800 dark:text-zinc-100">
                  <Bell className="w-6 h-6 text-brand-pink" /> Pengaturan Notifikasi
                </h3>
                <div className="space-y-8">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-zinc-400 mb-4">Waktu Pengingat</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[10, 60, 1440].map((min) => (
                        <button
                          key={min}
                          onClick={() => updateSettings({ notificationLeadTime: min })}
                          className={cn(
                            "py-3 rounded-2xl font-bold text-sm transition-all border-2",
                            profile.settings?.notificationLeadTime === min 
                              ? "bg-brand-blue/10 border-brand-blue text-brand-blue shadow-inner"
                              : "bg-zinc-50 dark:bg-zinc-800 border-transparent text-zinc-400"
                          )}
                        >
                          {min === 10 ? '10 Menit' : min === 60 ? '1 Jam' : '1 Hari'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-4 border-t border-zinc-50 dark:border-zinc-800">
                    <div>
                      <p className="font-bold text-zinc-700 dark:text-zinc-200">Getaran</p>
                      <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest mt-0.5">Hanya untuk Mobile Browser</p>
                    </div>
                    <button 
                      onClick={() => updateSettings({ vibration: !profile.settings?.vibration })}
                      className={cn(
                        "w-14 h-8 rounded-full p-1 transition-colors",
                        profile.settings?.vibration ? "bg-brand-mint" : "bg-zinc-200 dark:bg-zinc-700"
                      )}
                    >
                      <div className={cn(
                        "w-6 h-6 bg-white rounded-full shadow-sm transition-transform",
                        profile.settings?.vibration ? "translate-x-6" : "translate-x-0"
                      )} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => setGroupId('')}
                  className="w-full py-5 bg-white dark:bg-zinc-900 border-2 border-brand-blue/10 dark:border-brand-blue/5 text-brand-blue rounded-3xl font-black active:scale-95 transition-all text-sm uppercase tracking-widest"
                >
                  Ganti Grup / Keluar Kelas
                </button>
                <button 
                  onClick={() => auth.signOut()}
                  className="w-full py-5 bg-zinc-100 dark:bg-zinc-900 text-zinc-500 rounded-3xl font-black active:scale-95 transition-all text-sm uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  <LogOut className="w-5 h-5" /> Logout
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modal for Add/Edit Task */}
      <AnimatePresence>
        {showAddForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-zinc-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md"
            >
              <TaskForm 
                onAdd={saveTask} 
                onClose={() => {
                  setShowAddForm(false);
                  setEditingTask(null);
                }} 
                initialData={editingTask || undefined}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Action Button */}
      {activeTab === 'tasks' && !showAddForm && (
        <motion.button
          layoutId="add-button"
          onClick={() => setShowAddForm(true)}
          className="fixed bottom-32 right-8 w-20 h-20 bg-brand-pink text-white rounded-3xl shadow-2xl shadow-pink-200 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform z-40 border-4 border-white"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
        >
          <Plus className="w-10 h-10 stroke-[3.5px]" />
        </motion.button>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-sm glass rounded-[2.5rem] p-3 flex shadow-2xl shadow-black/10 z-50">
        {[
          { id: 'tasks', icon: ListTodo, label: 'Tugas' },
          { id: 'calendar', icon: Calendar, label: 'Jadwal' },
          { id: 'chat', icon: MessageSquare, label: 'Chat' },
          { id: 'settings', icon: SettingsIcon, label: 'Me' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex-1 flex flex-col items-center gap-1 py-2 rounded-3xl transition-all relative overflow-hidden",
              activeTab === tab.id ? "text-brand-pink" : "text-zinc-400"
            )}
          >
            <tab.icon className={cn("w-6 h-6", activeTab === tab.id ? "stroke-[2.5px]" : "stroke-[2px]")} />
            <span className="text-[9px] font-black uppercase tracking-widest">{tab.label}</span>
            {activeTab === tab.id && (
              <motion.div 
                layoutId="nav-bg"
                className="absolute inset-0 bg-brand-pink/10 -z-10"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
              />
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MyTugasApp />
    </AuthProvider>
  );
}
