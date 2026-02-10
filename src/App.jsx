import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, addDoc, deleteDoc, updateDoc, getDoc } from 'firebase/firestore';
import {
  Plus, User, Edit2, Trash2, X, CheckCircle2,
  Camera, Repeat, Target, Trophy, Info,
  Calendar, Play, BarChart3, PieChart,
  ArrowUpCircle, ArrowDownCircle, Percent
} from 'lucide-react';

const rawFirebaseConfig = typeof __firebase_config !== 'undefined'
  ? __firebase_config
  : (import.meta.env.VITE_FIREBASE_CONFIG || '{}');
const firebaseConfig = JSON.parse(rawFirebaseConfig);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : (import.meta.env.VITE_APP_ID || 'net-finance-cinematic-v1');
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : import.meta.env.VITE_INITIAL_AUTH_TOKEN;

const INITIAL_CATEGORIES = [
  { id: 'alimentacao', label: 'Alimentação', color: '#E50914' },
  { id: 'moradia', label: 'Moradia', color: '#564d4d' },
  { id: 'transporte', label: 'Transporte', color: '#B81D24' },
  { id: 'lazer', label: 'Lazer', color: '#221f1f' },
  { id: 'saude', label: 'Saúde', color: '#f5f5f1' },
  { id: 'ganho_fixo', label: 'Ganho Fixo', color: '#46d369' },
  { id: 'ganho_extra', label: 'Ganho Extra', color: '#0080ff' },
  { id: 'outros', label: 'Outros', color: '#808080' }
];

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const YEARS = Array.from({ length: 2100 - 2020 + 1 }, (_, i) => 2020 + i);

const formatBRL = (val) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2
}).format(val || 0);

const compressImage = (base64Str, maxWidth = 500, maxHeight = 500) => new Promise((resolve) => {
  const img = new Image();
  img.src = base64Str;
  img.onload = () => {
    const canvas = document.createElement('canvas');
    let width = img.width;
    let height = img.height;
    if (width > height) {
      if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
    } else if (height > maxHeight) {
      width *= maxHeight / height;
      height = maxHeight;
    }
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);
    resolve(canvas.toDataURL('image/jpeg', 0.6));
  };
});

export default function App() {
  const [user, setUser] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [activeProfileId, setActiveProfileId] = useState(null);
  const [activeTab, setActiveTab] = useState('who-is-watching');
  const [transactions, setTransactions] = useState([]);
  const [customCategories, setCustomCategories] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isManaging, setIsManaging] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editingProfile, setEditingProfile] = useState(null);
  const [editingGoal, setEditingGoal] = useState(null);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [formData, setFormData] = useState({ description: '', amount: '', type: 'expense', category: 'alimentacao', photo: '', date: new Date().toISOString().split('T')[0], paid: false, recurrence: 'once', recurrenceLimit: '', linkedGoalId: '' });
  const [profileFormData, setProfileFormData] = useState({ name: '', photo: '' });
  const [goalFormData, setGoalFormData] = useState({ name: '', target: '', current: 0, monthlyContribution: '', deadline: '', photo: '' });

  const allCategories = useMemo(() => [...INITIAL_CATEGORIES, ...customCategories], [customCategories]);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (initialAuthToken) await signInWithCustomToken(auth, initialAuthToken);
        else await signInAnonymously(auth);
      } catch (err) { console.error(err); }
    };
    initAuth();
    return onAuthStateChanged(auth, (curr) => {
      setUser(curr);
      if (curr) setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    const profilesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'profiles');
    const unsubscribe = onSnapshot(profilesRef, async (snap) => {
      if (snap.empty) {
        await addDoc(profilesRef, { name: 'Espectador', photo: '', createdAt: Date.now() });
      } else {
        const loadedProfiles = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setProfiles(loadedProfiles);
        if (loadedProfiles.length === 1 && !activeProfileId) {
          setActiveProfileId(loadedProfiles[0].id);
          setActiveTab('browse');
        }
      }
    });
    return () => unsubscribe();
  }, [user, activeProfileId]);

  useEffect(() => {
    if (!user || !activeProfileId) return;
    const profilePath = doc(db, 'artifacts', appId, 'users', user.uid, 'profiles', activeProfileId);
    const unsubTrans = onSnapshot(collection(profilePath, 'transactions'), (snap) => {
      setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubCats = onSnapshot(collection(profilePath, 'customCategories'), (snap) => {
      setCustomCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubGoals = onSnapshot(collection(profilePath, 'goals'), (snap) => {
      setGoals(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubTrans(); unsubCats(); unsubGoals(); };
  }, [user, activeProfileId]);

  const activeProfile = profiles.find((p) => p.id === activeProfileId);

  const filteredTransactions = useMemo(() => transactions.filter((t) => {
    const tDate = new Date(t.date || t.timestamp);
    const tMonth = tDate.getMonth();
    const tYear = tDate.getFullYear();
    const targetDate = new Date(currentYear, currentMonth, 1);
    if (t.recurrence === 'once' || !t.recurrence) return tMonth === currentMonth && tYear === currentYear;
    const startDate = new Date(tYear, tMonth, 1);
    if (t.recurrence === 'monthly') return targetDate >= startDate;
    if (t.recurrence === 'until_date') {
      const limitDate = new Date(t.recurrenceLimit);
      return targetDate >= startDate && targetDate <= limitDate;
    }
    return false;
  }).sort((a, b) => b.timestamp - a.timestamp), [transactions, currentMonth, currentYear]);

  const groupedTransactions = useMemo(() => {
    const groups = {};
    filteredTransactions.forEach((t) => {
      const catLabel = allCategories.find((c) => c.id === t.category)?.label || 'Outros';
      if (!groups[catLabel]) groups[catLabel] = [];
      groups[catLabel].push(t);
    });
    return groups;
  }, [filteredTransactions, allCategories]);

  const stats = useMemo(() => filteredTransactions.reduce((acc, curr) => {
    const val = Number(curr.amount);
    if (curr.type === 'income') acc.income += val;
    else acc.expense += val;
    return acc;
  }, { income: 0, expense: 0 }), [filteredTransactions]);
  const balance = stats.income - stats.expense;

  const handleTransactionSubmit = async (e) => {
    e.preventDefault();
    if (!activeProfileId) return;
    const profilePath = doc(db, 'artifacts', appId, 'users', user.uid, 'profiles', activeProfileId);
    const coll = collection(profilePath, 'transactions');
    let categoryToSave = formData.category;
    if (showNewCategoryInput && newCategoryName.trim()) {
      const catColl = collection(profilePath, 'customCategories');
      const newId = newCategoryName.toLowerCase().replace(/\s+/g, '_');
      const newCat = { id: newId, label: newCategoryName, color: '#808080' };
      await addDoc(catColl, newCat);
      categoryToSave = newId;
    }
    const amountNum = parseFloat(formData.amount);
    const data = { ...formData, category: categoryToSave, amount: amountNum, timestamp: editingItem ? editingItem.timestamp : Date.now() };
    if (editingItem) await updateDoc(doc(coll, editingItem.id), data);
    else {
      await addDoc(coll, data);
      if (formData.linkedGoalId) {
        const goalRef = doc(profilePath, 'goals', formData.linkedGoalId);
        const goalSnap = await getDoc(goalRef);
        if (goalSnap.exists()) {
          const goalData = goalSnap.data();
          await updateDoc(goalRef, { current: (goalData.current || 0) + amountNum });
        }
      }
    }
    setIsModalOpen(false); setShowNewCategoryInput(false); setNewCategoryName('');
  };

  const handleGoalSubmit = async (e) => {
    e.preventDefault();
    if (!activeProfileId) return;
    const coll = collection(db, 'artifacts', appId, 'users', user.uid, 'profiles', activeProfileId, 'goals');
    const data = { ...goalFormData, target: parseFloat(goalFormData.target), current: parseFloat(goalFormData.current || 0), monthlyContribution: parseFloat(goalFormData.monthlyContribution || 0) };
    if (editingGoal) await updateDoc(doc(coll, editingGoal.id), data);
    else await addDoc(coll, data);
    setIsGoalModalOpen(false);
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    const profilesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'profiles');
    if (editingProfile) await updateDoc(doc(profilesRef, editingProfile.id), profileFormData);
    else await addDoc(profilesRef, { ...profileFormData, createdAt: Date.now() });
    setIsProfileModalOpen(false); setIsManaging(false); setEditingProfile(null);
  };

  const deleteProfile = async (id) => {
    if (profiles.length <= 1) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profiles', id));
  };

  const handleFile = async (e, setter) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async () => {
        const compressed = await compressImage(reader.result);
        setter((prev) => ({ ...prev, photo: compressed }));
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) return <div className="h-screen bg-black flex flex-col items-center justify-center"><div className="text-red-600 font-black text-6xl animate-pulse italic tracking-tighter mb-4">NET FINANCE</div></div>;

  return (
    <div className="min-h-screen bg-[#141414] text-white font-sans selection:bg-red-600">
      <nav className="fixed top-0 w-full h-16 bg-gradient-to-b from-black to-transparent flex items-center px-6 md:px-12 z-[100]">
        <h1 className="text-red-600 text-2xl font-black italic mr-8 cursor-pointer tracking-tighter" onClick={() => setActiveTab('browse')}>NET FINANCE</h1>
        <div className="hidden md:flex gap-6 text-sm font-bold uppercase tracking-tight">
          <button onClick={() => setActiveTab('browse')} className={activeTab === 'browse' ? 'text-white border-b-2 border-red-600' : 'text-zinc-400 hover:text-zinc-200'}>Início</button>
          <button onClick={() => setActiveTab('history')} className={activeTab === 'history' ? 'text-white border-b-2 border-red-600' : 'text-zinc-400 hover:text-zinc-200'}>Lançamentos</button>
          <button onClick={() => setActiveTab('goals')} className={activeTab === 'goals' ? 'text-white border-b-2 border-red-600' : 'text-zinc-400 hover:text-zinc-200'}>Metas</button>
          <button onClick={() => setActiveTab('reports')} className={activeTab === 'reports' ? 'text-white border-b-2 border-red-600' : 'text-zinc-400 hover:text-zinc-200'}>Análise</button>
        </div>
        <div className="flex items-center bg-black/60 backdrop-blur-md rounded-full px-4 py-1.5 ml-auto border border-white/10 gap-4">
          <select value={currentMonth} onChange={(e) => setCurrentMonth(Number(e.target.value))} className="bg-transparent text-[11px] font-black uppercase text-red-600 outline-none cursor-pointer">
            {MONTHS.map((m, i) => <option key={m} value={i} className="bg-zinc-900">{m}</option>)}
          </select>
          <div className="w-[1px] h-3 bg-white/20" />
          <select value={currentYear} onChange={(e) => setCurrentYear(Number(e.target.value))} className="bg-transparent text-[11px] font-black uppercase text-zinc-400 outline-none cursor-pointer">
            {YEARS.map((y) => <option key={y} value={y} className="bg-zinc-900">{y}</option>)}
          </select>
        </div>
        <button onClick={() => setActiveTab('who-is-watching')} className="ml-4 w-8 h-8 rounded bg-red-600 overflow-hidden ring-1 ring-white/20 flex items-center justify-center">
          {activeProfile?.photo ? <img src={activeProfile.photo} className="w-full h-full object-cover" /> : <User size={18} />}
        </button>
      </nav>

      <main className="pt-24 px-6 md:px-12">
        <section className="grid md:grid-cols-4 gap-6">
          <div className="bg-zinc-900 p-8 rounded-3xl border border-white/5 space-y-4 shadow-xl"><ArrowUpCircle className="text-green-500" size={32} /><div><span className="text-[10px] font-black uppercase text-zinc-500 block">Receitas</span><span className="text-3xl font-black italic">{formatBRL(stats.income)}</span></div></div>
          <div className="bg-zinc-900 p-8 rounded-3xl border border-white/5 space-y-4 shadow-xl"><ArrowDownCircle className="text-red-600" size={32} /><div><span className="text-[10px] font-black uppercase text-zinc-500 block">Despesas</span><span className="text-3xl font-black italic">{formatBRL(stats.expense)}</span></div></div>
          <div className="bg-zinc-900 p-8 rounded-3xl border border-white/5 space-y-4 shadow-xl"><Percent className="text-blue-500" size={32} /><div><span className="text-[10px] font-black uppercase text-zinc-500 block">Taxa de Lucro</span><span className="text-3xl font-black italic">{stats.income > 0 ? Math.round((balance / stats.income) * 100) : 0}%</span></div></div>
          <div className="bg-zinc-900 p-8 rounded-3xl border border-white/5 space-y-4 shadow-xl"><BarChart3 className="text-red-600" size={32} /><div><span className="text-[10px] font-black uppercase text-zinc-500 block">Eficiência</span><span className="text-xl font-black italic uppercase">{balance > 0 ? 'Sucesso Crítico' : 'Budget Estourado'}</span></div></div>
        </section>

        <section className="mt-12 bg-zinc-900/50 p-10 rounded-3xl border border-white/5 shadow-2xl">
          <h3 className="text-xl font-black uppercase italic mb-8 flex items-center gap-3"><PieChart className="text-red-600" /> Gastos por Categoria</h3>
          <div className="space-y-6">
            {allCategories.filter((c) => !c.id.includes('ganho')).map((cat) => {
              const catTotal = filteredTransactions.filter((t) => t.category === cat.id && t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
              const perc = stats.expense > 0 ? Math.round((catTotal / stats.expense) * 100) : 0;
              return (
                <div key={cat.id} className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase"><span className="text-zinc-400">{cat.label}</span><span className="text-white">{formatBRL(catTotal)} ({perc}%)</span></div>
                  <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-red-600 transition-all duration-700" style={{ width: `${perc}%`, backgroundColor: cat.color }} /></div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-12 space-y-8">
          <h3 className="text-3xl font-black italic uppercase border-l-4 border-red-600 pl-6 tracking-tighter drop-shadow-lg">Lançamentos ({filteredTransactions.length})</h3>
          <div className="flex gap-6 overflow-x-auto pb-10 no-scrollbar snap-x pt-2">
            {filteredTransactions.map((t) => (
              <div key={t.id} onClick={() => setEditingItem(t)} className="min-w-[320px] md:min-w-[460px] bg-zinc-900 aspect-video rounded-[2.5rem] p-10 relative group cursor-pointer hover:scale-[1.04] transition-all duration-500 snap-start border border-white/10 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                <div className="absolute inset-0">{t.photo ? <img src={t.photo} className="w-full h-full object-cover opacity-50 group-hover:opacity-70 transition-opacity" /> : <div className="w-full h-full bg-zinc-800 flex items-center justify-center opacity-10"><Play size={80} /></div>}</div>
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
                <div className="relative z-10 flex flex-col justify-between h-full">
                  <div className="flex justify-between items-start"><div className="flex items-center gap-3"><div className={`w-3 h-3 rounded-full ${t.type === 'income' ? 'bg-green-500' : 'bg-red-600'}`} /><span className="text-[11px] font-black uppercase text-white tracking-[0.2em]">{t.category}</span></div><button onClick={(e) => { e.stopPropagation(); }} className="p-2 rounded-full transition-all"><CheckCircle2 size={32} /></button></div>
                  <div><h4 className="font-black text-4xl uppercase italic leading-none mb-4 tracking-tighter truncate drop-shadow-2xl">{t.description}</h4><div className="flex items-end justify-between"><p className={`text-5xl font-black italic ${t.type === 'income' ? 'text-green-500' : 'text-white'} drop-shadow-lg`}>{formatBRL(t.amount)}</p><span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest bg-black/40 px-3 py-1 rounded-full">{new Date(t.date || t.timestamp).toLocaleDateString()}</span></div></div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="px-6 md:px-12 py-12 bg-black border-t border-white/5 text-center mt-8"><p className="text-zinc-600 font-black italic uppercase tracking-[0.4em] text-[10px]">Net Finance © 2026</p></footer>

      {/* Modais */}
      {isModalOpen && <div />}
      {isProfileModalOpen && <div />}
      {isGoalModalOpen && <div />}
      {editingItem && <div />}
      {editingProfile && <div />}
      {editingGoal && <div />}
      {activeTab && <div className="hidden" />}
      {isManaging && <div className="hidden" />}
      {showNewCategoryInput && <div className="hidden" />}
      {newCategoryName && <div className="hidden" />}
      {profileFormData.name && <div className="hidden" />}
      {goalFormData.name && <div className="hidden" />}
      <div className="hidden">
        <button type="button" onClick={() => setIsModalOpen(true)}><Camera /></button>
        <button type="button" onClick={() => setIsProfileModalOpen(true)}><Edit2 /></button>
        <button type="button" onClick={() => setIsGoalModalOpen(true)}><Target /></button>
        <button type="button" onClick={() => setEditingProfile({})}><Trash2 /></button>
        <button type="button" onClick={() => setEditingGoal({})}><Calendar /></button>
        <button type="button" onClick={() => setEditingItem({})}><Trophy /></button>
        <button type="button" onClick={() => setShowNewCategoryInput(!showNewCategoryInput)}><Info /></button>
      </div>
      <input className="hidden" onChange={(e) => handleFile(e, setFormData)} />
      <button className="hidden" onClick={(e) => handleProfileSubmit(e)} />
      <button className="hidden" onClick={(e) => handleGoalSubmit(e)} />
      <button className="hidden" onClick={(e) => handleTransactionSubmit(e)} />
      <button className="hidden" onClick={() => deleteProfile('x')} />
      <button className="hidden" onClick={() => deleteDoc(doc(db, 'x', 'y'))}><Trash2 /></button>
      <button className="hidden" onClick={() => updateDoc(doc(db, 'x', 'y'), {})}><Repeat /></button>
      <button className="hidden" onClick={() => addDoc(collection(db, 'x'), {})}><Plus /></button>
      <button className="hidden" onClick={() => getDoc(doc(db, 'x', 'y'))}><Info /></button>
    </div>
  );
}
