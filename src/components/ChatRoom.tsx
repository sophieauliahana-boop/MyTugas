import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, where, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Message as MessageType } from '../types';
import { Send, User as UserIcon, Pencil, Trash2, X, Check } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

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
  console.error('Firestore Error (Chat): ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function ChatRoom() {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [inputText, setInputText] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profile?.groupId) return;

    const messagesPath = `groups/${profile.groupId}/messages`;
    const messagesRef = collection(db, messagesPath);
    const q = query(
      messagesRef, 
      where('groupId', '==', profile.groupId),
      orderBy('timestamp', 'asc'), 
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MessageType[];
      setMessages(msgs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, messagesPath);
    });

    return unsubscribe;
  }, [profile?.groupId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !user || !profile?.groupId) return;

    const messagesPath = `groups/${profile.groupId}/messages`;
    try {
      const messagesRef = collection(db, messagesPath);
      await addDoc(messagesRef, {
        text: inputText,
        senderId: user.uid,
        senderName: profile.displayName || user.displayName || 'Anon',
        senderPhoto: profile.photoURL || user.photoURL || '',
        timestamp: serverTimestamp(),
        groupId: profile.groupId
      });
      setInputText('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, messagesPath);
    }
  };

  const startEdit = (msg: MessageType) => {
    setEditingMessageId(msg.id);
    setEditingText(msg.text);
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditingText('');
  };

  const saveEdit = async (msgId: string) => {
    if (!editingText.trim() || !profile?.groupId) return;

    const messagePath = `groups/${profile.groupId}/messages/${msgId}`;
    try {
      await updateDoc(doc(db, messagePath), {
        text: editingText,
        editedAt: serverTimestamp()
      });
      cancelEdit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, messagePath);
    }
  };

  const deleteMessage = async (msgId: string) => {
    if (!profile?.groupId || !window.confirm('Hapus pesan ini?')) return;

    const messagePath = `groups/${profile.groupId}/messages/${msgId}`;
    try {
      await deleteDoc(doc(db, messagePath));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, messagePath);
    }
  };

  if (!profile?.groupId) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center card-cute">
        <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs mb-2">Oops!</p>
        <p className="text-zinc-600 font-medium">Gabung grup dulu untuk mulai chat bareng teman sekelas!</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[600px] card-cute overflow-hidden">
      <div className="p-6 border-b border-zinc-50 dark:border-zinc-800 bg-white/50 dark:bg-zinc-800/50 backdrop-blur-sm relative z-10 flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">Obrolan Kelas 💭</h2>
        <span className="text-[10px] font-bold text-brand-pink bg-pink-50 dark:bg-pink-500/10 px-3 py-1 rounded-full uppercase tracking-wider">Online</span>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-zinc-50/30 dark:bg-zinc-900/10">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              layout
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              key={msg.id}
              className={`flex items-end gap-3 ${msg.senderId === user?.uid ? 'flex-row-reverse' : ''}`}
            >
              {msg.senderId !== user?.uid && (
                <div className="w-8 h-8 rounded-2xl bg-brand-blue flex items-center justify-center shadow-sm flex-shrink-0 overflow-hidden border-2 border-white dark:border-zinc-800">
                  {msg.senderPhoto ? <img src={msg.senderPhoto} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <UserIcon className="w-4 h-4 text-white" />}
                </div>
              )}
              <div className={`max-w-[75%] group relative rounded-[2rem] p-4 shadow-sm ${
                msg.senderId === user?.uid 
                  ? 'bg-brand-pink text-white rounded-br-lg shadow-pink-200/20' 
                  : 'bg-white dark:bg-zinc-700 text-zinc-700 dark:text-zinc-100 rounded-bl-lg'
              }`}>
                {msg.senderId !== user?.uid && (
                  <p className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-60">
                    {msg.senderName}
                  </p>
                )}
                
                {editingMessageId === msg.id ? (
                  <div className="flex flex-col gap-2 min-w-[200px]">
                    <textarea
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      className="w-full bg-black/10 text-white rounded-xl p-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/30 resize-none"
                      rows={2}
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={cancelEdit}
                        className="p-1 hover:bg-black/10 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => saveEdit(msg.id)}
                        className="p-1 hover:bg-black/10 rounded-lg transition-colors"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className={`text-[9px] font-bold ${msg.senderId === user?.uid ? 'text-white/60' : 'text-zinc-300 dark:text-zinc-500'}`}>
                        {msg.timestamp ? format(msg.timestamp.toDate(), 'HH:mm') : ''}
                        {msg.editedAt && ' (diedit)'}
                      </p>
                      
                      {msg.senderId === user?.uid && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => startEdit(msg)}
                            className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button 
                            onClick={() => deleteMessage(msg.id)}
                            className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                            title="Hapus"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={scrollRef} />
      </div>

      <form onSubmit={sendMessage} className="p-4 bg-white dark:bg-zinc-800 border-t border-zinc-50 dark:border-zinc-700 flex gap-3">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Tulis pesan..."
          className="flex-1 px-6 py-4 bg-zinc-50 dark:bg-zinc-900 dark:text-white rounded-full focus:outline-none focus:ring-2 focus:ring-brand-pink/30 font-medium text-sm transition-all"
        />
        <button
          type="submit"
          className="w-14 h-14 bg-brand-pink text-white rounded-full flex items-center justify-center shadow-lg shadow-pink-200 dark:shadow-pink-500/10 active:scale-90 transition-all hover:rotate-12 flex-shrink-0"
        >
          <Send className="w-6 h-6" />
        </button>
      </form>
    </div>
  );
}
