import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Search, Settings, Plus, Lock, Unlock, Edit, Trash2, Eye, EyeOff,
  Download, Upload, X, Pin, PinOff, Copy, Palette, ChevronDown, ChevronUp,
  Cloud, CloudUpload, RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useNotes } from '@/hooks/useNotes';
import { useMobile } from '@/hooks/useMobile';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Tag {
  name: string;
  color: string;
}

interface Note {
  id: string;
  text: string;
  tags: Tag[];
  createdAt: Date;
  updatedAt?: Date;
  isLocked?: boolean;
  isHidden?: boolean;
  isPinned?: boolean;
  color?: string;
}

type SortOrder =
  | 'createdAt-desc' | 'createdAt-asc'
  | 'updatedAt-desc' | 'updatedAt-asc'
  | 'text-asc' | 'text-desc';

type Theme = 'light' | 'dark' | 'sepia' | 'gray' | 'green';

const PREDEFINED_TAG_COLORS: string[] = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FED766', '#2AB7CA',
  '#F0B67F', '#8A6FBF', '#F9ADA0', '#57A773', '#F17A7E',
  '#82D173', '#4A4E69', '#F9A620', '#7B5E7B', '#D65780',
  '#FFB347', '#FFCC5C', '#96E072', '#7BE0AD', '#5DC8E0'
];

const NOTE_COLORS = [
  { name: '預設', value: '' },
  { name: '紅色', value: '#f28b82' },
  { name: '橙色', value: '#fbbc04' },
  { name: '黃色', value: '#fff475' },
  { name: '綠色', value: '#ccff90' },
  { name: '青綠', value: '#a8f0e0' },
  { name: '淡藍', value: '#cbf0f8' },
  { name: '藍色', value: '#aecbfa' },
  { name: '紫色', value: '#d7aefb' },
  { name: '粉紅', value: '#fdcfe8' },
  { name: '棕色', value: '#e6c9a8' },
  { name: '灰色', value: '#e8eaed' },
];

const LONG_NOTE_THRESHOLD = 200;

export default function NotesApp() {
  const isMobile = useMobile();
  const {
    notes,
    addNote,
    updateNote,
    deleteNote,
    toggleLockNote,
    toggleHideNote,
    togglePinNote,
    duplicateNote,
    updateNoteColor,
    exportData,
    importData,
    clearAllData,
    cloudBackups,
    createCloudBackup,
    restoreCloudBackup,
    deleteCloudBackup
  } = useNotes();

  const { toast } = useToast();
  const newNoteRef = useRef<HTMLTextAreaElement>(null);
  const notesListRef = useRef<HTMLDivElement>(null);

  const [currentNoteText, setCurrentNoteText] = useState('');
  const [currentTagsInput, setCurrentTagsInput] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [editingTagsInput, setEditingTagsInput] = useState('');
  const [theme, setTheme] = useState<Theme>('light');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('createdAt-desc');
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [globalPassword, setGlobalPassword] = useState<string | null>(null);
  const [requireDeleteConfirmation, setRequireDeleteConfirmation] = useState(true);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordPromptInput, setPasswordPromptInput] = useState('');
  const [pendingAction, setPendingAction] = useState<{ type: string; noteId?: string; noteIds?: string[] } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [colorPickerNoteId, setColorPickerNoteId] = useState<string | null>(null);
  const [showHiddenNotes, setShowHiddenNotes] = useState(true);
  const [expandedNoteIds, setExpandedNoteIds] = useState<Set<string>>(new Set());

  // Load saved data on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('notes-theme') as Theme;
    if (savedTheme) setTheme(savedTheme);

    const savedPassword = localStorage.getItem('notes-global-password');
    if (savedPassword) setGlobalPassword(savedPassword);

    const savedDeleteConfirm = localStorage.getItem('notes-delete-confirmation');
    if (savedDeleteConfirm) setRequireDeleteConfirmation(JSON.parse(savedDeleteConfirm));

    const savedSortOrder = localStorage.getItem('notes-sort-order') as SortOrder;
    if (savedSortOrder) setSortOrder(savedSortOrder);

  }, []);

  useEffect(() => {
    localStorage.setItem('notes-theme', theme);
    document.body.className = `theme-${theme}`;
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    if (globalPassword) {
      localStorage.setItem('notes-global-password', globalPassword);
    } else {
      localStorage.removeItem('notes-global-password');
    }
  }, [globalPassword]);

  useEffect(() => {
    localStorage.setItem('notes-delete-confirmation', JSON.stringify(requireDeleteConfirmation));
  }, [requireDeleteConfirmation]);

  useEffect(() => {
    localStorage.setItem('notes-sort-order', sortOrder);
  }, [sortOrder]);

  // Keyboard shortcut: Escape to cancel editing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && editingNoteId) {
        setEditingNoteId(null);
        setEditingNoteText('');
        setEditingTagsInput('');
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editingNoteId]);

  const getNextColor = useCallback((existingColors: string[]): string => {
    const usedColors = new Set(existingColors);
    for (const color of PREDEFINED_TAG_COLORS) {
      if (!usedColors.has(color)) return color;
    }
    return PREDEFINED_TAG_COLORS[usedColors.size % PREDEFINED_TAG_COLORS.length];
  }, []);

  const allTags = useMemo(() => {
    const map = new Map<string, string>();
    notes.forEach(note => note.tags.forEach(tag => map.set(tag.name, tag.color)));
    return map;
  }, [notes]);

  const allTagNames = useMemo(() => {
    return Array.from(allTags.keys()).sort();
  }, [allTags]);

  const processTagsInput = useCallback((tagsInput: string): Tag[] => {
    const tagNames = tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag !== '');
    const tempMap = new Map(allTags);

    return tagNames.map(name => {
      let color = tempMap.get(name);
      if (!color) {
        color = getNextColor(Array.from(tempMap.values()));
        tempMap.set(name, color);
      }
      return { name, color };
    });
  }, [allTags, getNextColor]);

  const formatDate = (date: Date): string => {
    return date.toLocaleString('zh-TW', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatRelativeTime = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (diff < 60000) return '剛剛';
    if (minutes < 60) return `${minutes} 分鐘前`;
    if (hours < 24) return `${hours} 小時前`;
    if (days === 1) return '昨天';
    if (days < 7) return `${days} 天前`;
    return formatDate(new Date(date));
  };

  const stats = useMemo(() => ({
    total: notes.length,
    pinned: notes.filter(n => n.isPinned).length,
    locked: notes.filter(n => n.isLocked).length,
    hidden: notes.filter(n => n.isHidden).length,
  }), [notes]);

  const filteredAndSortedNotes = useMemo(() => {
    let filtered = notes.filter(note => {
      if (!showHiddenNotes && note.isHidden) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        if (!note.text.toLowerCase().includes(s) && !note.tags.some(t => t.name.toLowerCase().includes(s))) {
          return false;
        }
      }
      if (tagFilter && !note.tags.some(t => t.name === tagFilter)) return false;
      return true;
    });

    return filtered.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      switch (sortOrder) {
        case 'createdAt-desc': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'createdAt-asc': return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'updatedAt-desc': return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
        case 'updatedAt-asc': return new Date(a.updatedAt || a.createdAt).getTime() - new Date(b.updatedAt || b.createdAt).getTime();
        case 'text-asc': return a.text.localeCompare(b.text);
        case 'text-desc': return b.text.localeCompare(a.text);
        default: return 0;
      }
    });
  }, [notes, searchTerm, sortOrder, tagFilter, showHiddenNotes]);

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentNoteText.trim() === '') return;
    const tags = processTagsInput(currentTagsInput);
    addNote(currentNoteText.trim(), tags);
    setCurrentNoteText('');
    setCurrentTagsInput('');
    toast({ title: '已新增', description: '筆記已成功建立。' });
  };

  const handleUpdateNote = (noteId: string) => {
    if (editingNoteText.trim() === '') return;
    const tags = processTagsInput(editingTagsInput);
    updateNote(noteId, editingNoteText.trim(), tags);
    setEditingNoteId(null);
    setEditingNoteText('');
    setEditingTagsInput('');
    toast({ title: '已更新', description: '筆記內容已儲存。' });
  };

  const handleStartEdit = (note: Note) => {
    if (note.isLocked) {
      toast({ title: '無法編輯', description: '此筆記已上鎖，請先解鎖才能編輯。', variant: 'destructive' });
      return;
    }
    setEditingNoteId(note.id);
    setEditingNoteText(note.text);
    setEditingTagsInput(note.tags.map(tag => tag.name).join(', '));
    setColorPickerNoteId(null);
  };

  const handleDeleteNote = (note: Note) => {
    if (note.isLocked) {
      toast({ title: '無法刪除', description: '此筆記已上鎖，請先解鎖後才能刪除。', variant: 'destructive' });
      return;
    }
    if (note.isHidden) {
      toast({ title: '無法刪除', description: '此筆記已隱藏，請先取消隱藏後才能刪除。', variant: 'destructive' });
      return;
    }
    if (requireDeleteConfirmation) {
      setNoteToDelete(note);
      setShowDeleteConfirm(true);
      return;
    }
    deleteNote(note.id);
    finishDelete(note.id);
  };

  const finishDelete = (noteId: string) => {
    setSelectedNoteIds(prev => prev.filter(id => id !== noteId));
    setExpandedNoteIds(prev => {
      const next = new Set(prev);
      next.delete(noteId);
      return next;
    });
    if (editingNoteId === noteId) {
      setEditingNoteId(null);
      setEditingNoteText('');
      setEditingTagsInput('');
    }
    if (colorPickerNoteId === noteId) setColorPickerNoteId(null);
    requestAnimationFrame(() => {
      notesListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const confirmDeleteNote = () => {
    if (noteToDelete) {
      deleteNote(noteToDelete.id);
      finishDelete(noteToDelete.id);
      toast({ title: '已刪除', description: '筆記已刪除。' });
    }
    setShowDeleteConfirm(false);
    setNoteToDelete(null);
  };

  const handleToggleLock = (note: Note) => {
    if (!globalPassword && !note.isLocked) {
      toast({ title: '尚未設定密碼', description: '請先至設定中設定全域筆記鎖密碼。', variant: 'destructive' });
      setIsSettingsOpen(true);
      return;
    }
    if (note.isLocked && globalPassword) {
      setPendingAction({ type: 'unlock', noteId: note.id });
      setShowPasswordPrompt(true);
    } else {
      toggleLockNote(note.id);
    }
  };

  const handlePasswordPromptSubmit = () => {
    if (!globalPassword || passwordPromptInput !== globalPassword) {
      toast({ title: '密碼錯誤', description: '請重新輸入正確的密碼。', variant: 'destructive' });
      setPasswordPromptInput('');
      return;
    }
    if (pendingAction) {
      switch (pendingAction.type) {
        case 'unlock':
          if (pendingAction.noteId) toggleLockNote(pendingAction.noteId);
          break;
        case 'toggleHideSelected':
          if (pendingAction.noteIds) pendingAction.noteIds.forEach(id => toggleHideNote(id));
          break;
        case 'toggleLockSelected':
          if (pendingAction.noteIds) pendingAction.noteIds.forEach(id => toggleLockNote(id));
          break;
      }
    }
    setShowPasswordPrompt(false);
    setPasswordPromptInput('');
    setPendingAction(null);
  };

  const handleSetGlobalPassword = () => {
    if (passwordInput !== confirmPasswordInput) {
      toast({ title: '密碼不符', description: '兩次輸入的密碼不一致，請重新確認。', variant: 'destructive' });
      return;
    }
    if (passwordInput.length > 0 && passwordInput.length < 4) {
      toast({ title: '密碼太短', description: '密碼至少需要 4 個字元。', variant: 'destructive' });
      return;
    }
    setGlobalPassword(passwordInput || null);
    toast({ title: passwordInput ? '密碼已設定' : '密碼已移除', description: passwordInput ? '全域筆記鎖密碼設定成功。' : '密碼已成功移除。' });
    setPasswordInput('');
    setConfirmPasswordInput('');
  };

  const handleSelectAll = (checked: boolean | 'indeterminate') => {
    if (checked === true) {
      setSelectedNoteIds(filteredAndSortedNotes.map(note => note.id));
    } else {
      setSelectedNoteIds([]);
    }
  };

  const handleNoteSelect = (noteId: string, checked: boolean) => {
    if (checked) {
      setSelectedNoteIds(prev => [...prev, noteId]);
    } else {
      setSelectedNoteIds(prev => prev.filter(id => id !== noteId));
    }
  };

  const handleToggleHideSelected = () => {
    if (selectedNoteIds.length === 0) return;
    const hasLockedNotes = selectedNoteIds.some(id => notes.find(n => n.id === id)?.isLocked);
    if (hasLockedNotes && globalPassword) {
      setPendingAction({ type: 'toggleHideSelected', noteIds: selectedNoteIds });
      setShowPasswordPrompt(true);
    } else {
      selectedNoteIds.forEach(id => toggleHideNote(id));
    }
  };

  const handleToggleLockSelected = () => {
    if (selectedNoteIds.length === 0) return;
    if (!globalPassword) {
      toast({ title: '尚未設定密碼', description: '請先至設定中設定全域筆記鎖密碼。', variant: 'destructive' });
      setIsSettingsOpen(true);
      return;
    }
    const hasLockedNotes = selectedNoteIds.some(id => notes.find(n => n.id === id)?.isLocked);
    if (hasLockedNotes) {
      setPendingAction({ type: 'toggleLockSelected', noteIds: selectedNoteIds });
      setShowPasswordPrompt(true);
    } else {
      selectedNoteIds.forEach(id => toggleLockNote(id));
    }
  };

  const handleCopyNote = async (text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const el = document.createElement('textarea');
        el.value = text;
        el.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
        document.body.appendChild(el);
        el.focus();
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      toast({ title: '已複製', description: '筆記內容已複製到剪貼簿。' });
    } catch {
      toast({ title: '複製失敗', description: '無法存取剪貼簿，請手動複製。', variant: 'destructive' });
    }
  };

  const handleDuplicateNote = (note: Note) => {
    if (note.isLocked) {
      toast({ title: '無法複製', description: '請先解鎖後才能複製此筆記。', variant: 'destructive' });
      return;
    }
    duplicateNote(note.id);
    toast({ title: '已複製筆記', description: '已建立此筆記的副本。' });
  };

  const toggleExpand = (noteId: string) => {
    setExpandedNoteIds(prev => {
      const next = new Set(prev);
      if (next.has(noteId)) next.delete(noteId); else next.add(noteId);
      return next;
    });
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        importData(data);
        toast({ title: '匯入成功', description: '資料已成功匯入。' });
      } catch {
        toast({ title: '匯入失敗', description: '請確認檔案格式正確（JSON）。', variant: 'destructive' });
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleExportData = () => {
    const data = exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notes-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: '匯出成功', description: '資料已下載至您的裝置。' });
  };

  const handleCreateCloudBackup = async () => {
    try {
      await createCloudBackup();
      toast({ title: '雲端備份完成', description: `已備份 ${notes.length} 筆筆記。` });
    } catch {
      toast({ title: '雲端備份失敗', description: '請稍後再試，並確認伺服器資料庫正常運作。', variant: 'destructive' });
    }
  };

  const handleRestoreCloudBackup = async (backupId: number) => {
    const backup = cloudBackups.find(item => item.id === backupId);
    if (!backup) return;
    if (!window.confirm(`確定要還原 ${formatDate(backup.createdAt)} 的 ${backup.noteCount} 筆筆記嗎？目前筆記會被取代。`)) {
      return;
    }
    try {
      await restoreCloudBackup(backupId);
      setSelectedNoteIds([]);
      setEditingNoteId(null);
      setExpandedNoteIds(new Set());
      setTagFilter(null);
      setSearchTerm('');
      toast({ title: '雲端備份已還原', description: `已還原 ${backup.noteCount} 筆筆記。` });
    } catch {
      toast({ title: '還原失敗', description: '無法還原這份雲端備份。', variant: 'destructive' });
    }
  };

  const handleDeleteCloudBackup = async (backupId: number) => {
    if (!window.confirm('確定要刪除這份雲端備份嗎？此操作無法復原。')) return;
    try {
      await deleteCloudBackup(backupId);
      toast({ title: '雲端備份已刪除' });
    } catch {
      toast({ title: '刪除備份失敗', description: '無法刪除這份雲端備份。', variant: 'destructive' });
    }
  };

  const confirmClearAllData = () => {
    clearAllData();
    setSelectedNoteIds([]);
    setTagFilter(null);
    setShowClearConfirm(false);
    setIsSettingsOpen(false);
    toast({ title: '已清除', description: '所有資料已清除，應用程式已重設。' });
  };

  const allVisible = filteredAndSortedNotes.length > 0 && filteredAndSortedNotes.every(n => selectedNoteIds.includes(n.id));

  return (
    <div className="min-h-screen min-h-[calc(var(--vh,1vh)*100)] bg-[var(--bg-color)] text-[var(--text-color)] theme-transition flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[var(--card-bg-color)] shadow-sm safe-area-top flex-shrink-0">
        <div className="max-w-4xl mx-auto px-4 py-3 safe-area-left safe-area-right">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-[var(--header-text-color)]">
                小筆記 Pro
              </h1>
              <div className="text-xs text-gray-400 mt-0.5">
                共 {stats.total} 筆記
                {stats.pinned > 0 && ` · ${stats.pinned} 置頂`}
                {stats.locked > 0 && ` · ${stats.locked} 鎖定`}
                {stats.hidden > 0 && ` · ${stats.hidden} 隱藏`}
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Select value={theme} onValueChange={(value: Theme) => setTheme(value)}>
                <SelectTrigger className="w-[90px] sm:w-[110px] min-touch-target touch-feedback">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">🌞 明亮</SelectItem>
                  <SelectItem value="dark">🌙 暗黑</SelectItem>
                  <SelectItem value="sepia">📜 復古</SelectItem>
                  <SelectItem value="gray">🩶 灰色</SelectItem>
                  <SelectItem value="green">🌿 綠色</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                className="min-touch-target touch-feedback"
                onClick={() => setIsSettingsOpen(true)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 safe-area-left safe-area-right safe-area-bottom overflow-y-auto">

        {/* Search bar */}
        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="text"
            placeholder="搜尋筆記內容或標籤..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-10 bg-[var(--control-button-bg)] border-[var(--control-button-border)] touch-feedback"
            style={{ fontSize: '16px' }}
          />
          {searchTerm && (
            <button
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              onClick={() => setSearchTerm('')}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Tag filter chips */}
        {allTagNames.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4 items-center">
            <span className="text-xs text-gray-500 whitespace-nowrap">篩選標籤：</span>
            <button
              onClick={() => setTagFilter(null)}
              className={cn(
                'px-3 py-1 text-xs rounded-full border transition-all',
                !tagFilter
                  ? 'bg-[var(--header-text-color)] text-white border-transparent'
                  : 'border-gray-300 text-gray-600 hover:border-gray-400'
              )}
            >
              全部
            </button>
            {allTagNames.map(tag => {
              const color = allTags.get(tag) || '#888';
              const isActive = tagFilter === tag;
              return (
                <button
                  key={tag}
                  onClick={() => setTagFilter(isActive ? null : tag)}
                  className={cn(
                    'px-3 py-1 text-xs rounded-full border transition-all',
                    isActive ? 'text-white border-transparent' : 'hover:opacity-80'
                  )}
                  style={{
                    backgroundColor: isActive ? color : 'transparent',
                    borderColor: color,
                    color: isActive ? '#fff' : color,
                  }}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        )}

        {/* Controls bar */}
        <div className="space-y-2 mb-4">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="selectAll"
                checked={allVisible}
                onCheckedChange={handleSelectAll}
              />
              <label htmlFor="selectAll" className="text-sm cursor-pointer select-none">
                全選{selectedNoteIds.length > 0 && ` (${selectedNoteIds.length})`}
              </label>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="min-touch-target touch-feedback"
              disabled={selectedNoteIds.length === 0}
              onClick={handleToggleHideSelected}
            >
              <EyeOff className="h-4 w-4 mr-1" />
              隱藏選中
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="min-touch-target touch-feedback"
              disabled={selectedNoteIds.length === 0}
              onClick={handleToggleLockSelected}
            >
              <Lock className="h-4 w-4 mr-1" />
              鎖定選中
            </Button>
            <Button
              variant={showHiddenNotes ? 'outline' : 'secondary'}
              size="sm"
              className="min-touch-target touch-feedback"
              onClick={() => setShowHiddenNotes(!showHiddenNotes)}
              title={showHiddenNotes ? '點擊隱藏已隱藏的筆記' : '點擊顯示已隱藏的筆記'}
            >
              {showHiddenNotes
                ? <><Eye className="h-4 w-4 mr-1" />含隱藏筆記</>
                : <><EyeOff className="h-4 w-4 mr-1" />不含隱藏</>
              }
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 whitespace-nowrap">排序：</span>
            <Select value={sortOrder} onValueChange={(value: SortOrder) => setSortOrder(value)}>
              <SelectTrigger className="flex-1 max-w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt-desc">建立時間（新→舊）</SelectItem>
                <SelectItem value="createdAt-asc">建立時間（舊→新）</SelectItem>
                <SelectItem value="updatedAt-desc">更新時間（新→舊）</SelectItem>
                <SelectItem value="updatedAt-asc">更新時間（舊→新）</SelectItem>
                <SelectItem value="text-asc">內容（A→Z）</SelectItem>
                <SelectItem value="text-desc">內容（Z→A）</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Add new note */}
        <Card className="mb-6 bg-[var(--card-bg-color)]">
          <CardContent className="p-4">
            <form onSubmit={handleAddNote} className="space-y-3">
              <Textarea
                ref={newNoteRef}
                placeholder="在此輸入新筆記...（Ctrl+Enter 快速新增）"
                value={currentNoteText}
                onChange={(e) => setCurrentNoteText(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    handleAddNote(e as any);
                  }
                }}
                className="min-h-[90px] bg-[var(--note-bg-color)] border-[var(--input-border-color)] touch-feedback resize-none"
                style={{ fontSize: '16px' }}
              />
              {currentNoteText.length > 0 && (
                <div className="text-xs text-gray-400 text-right -mt-1">
                  {currentNoteText.length} 字元
                </div>
              )}
              <Input
                type="text"
                placeholder="標籤（用逗號分隔，例如：工作, 個人）"
                value={currentTagsInput}
                onChange={(e) => setCurrentTagsInput(e.target.value)}
                className="bg-[var(--note-bg-color)] border-[var(--input-border-color)] touch-feedback"
                style={{ fontSize: '16px' }}
              />
              <div className="flex justify-end">
                <Button type="submit" className="min-touch-target touch-feedback" disabled={!currentNoteText.trim()}>
                  <Plus className="h-4 w-4 mr-2" />
                  新增筆記
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Notes count info */}
        {(searchTerm || tagFilter) && (
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">
              顯示 {filteredAndSortedNotes.length} / {notes.length} 筆記
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSearchTerm(''); setTagFilter(null); }}
              className="text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              清除篩選
            </Button>
          </div>
        )}

        {/* Notes list */}
        <div ref={notesListRef} className="space-y-4">
          {filteredAndSortedNotes.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📝</div>
              <h3 className="text-lg font-medium mb-2">
                {searchTerm || tagFilter ? '找不到符合的筆記' : '還沒有任何筆記'}
              </h3>
              <p className="text-gray-500">
                {searchTerm || tagFilter ? '請嘗試不同的關鍵字或標籤' : '開始建立您的第一個筆記吧！'}
              </p>
            </div>
          ) : (
            filteredAndSortedNotes.map((note) => {
              const hasColor = !!note.color;
              const isLongNote = note.text.length > LONG_NOTE_THRESHOLD;
              const isExpanded = expandedNoteIds.has(note.id);
              const displayText = isLongNote && !isExpanded
                ? note.text.substring(0, LONG_NOTE_THRESHOLD) + '…'
                : note.text;

              return (
                <Card
                  key={note.id}
                  className={cn(
                    'note-transition border',
                    !hasColor && 'bg-[var(--note-bg-color)]',
                    note.isHidden && 'opacity-60'
                  )}
                  style={hasColor ? { backgroundColor: note.color! } : {}}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        checked={selectedNoteIds.includes(note.id)}
                        onCheckedChange={(checked) => handleNoteSelect(note.id, checked as boolean)}
                        className="mt-1 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        {/* Note header */}
                        <div className="flex items-center justify-between mb-2 gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {note.isPinned && (
                              <Pin className="h-3.5 w-3.5 text-[var(--header-text-color)] flex-shrink-0" />
                            )}
                            {note.isLocked && (
                              <Lock className="h-3.5 w-3.5 text-[var(--locked-color)] flex-shrink-0" />
                            )}
                            {note.isHidden && (
                              <span className="text-xs text-[var(--hidden-note-label-color)] italic">隱藏</span>
                            )}
                          </div>
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            {formatRelativeTime(new Date(note.updatedAt || note.createdAt))}
                          </span>
                        </div>

                        {/* Edit mode */}
                        {editingNoteId === note.id ? (
                          <div className="space-y-3">
                            <Textarea
                              value={editingNoteText}
                              onChange={(e) => setEditingNoteText(e.target.value)}
                              onKeyDown={(e) => {
                                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleUpdateNote(note.id);
                                if (e.key === 'Escape') {
                                  setEditingNoteId(null);
                                  setEditingNoteText('');
                                  setEditingTagsInput('');
                                }
                              }}
                              className="min-h-[80px] bg-[var(--card-bg-color)] border-[var(--input-border-color)] resize-none"
                              style={{ fontSize: '16px' }}
                              autoFocus
                            />
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-400">
                                {editingNoteText.length} 字元
                              </span>
                              <span className="text-xs text-gray-400">Ctrl+Enter 儲存 · Esc 取消</span>
                            </div>
                            <Input
                              type="text"
                              value={editingTagsInput}
                              onChange={(e) => setEditingTagsInput(e.target.value)}
                              placeholder="標籤（用逗號分隔）"
                              className="bg-[var(--card-bg-color)] border-[var(--input-border-color)]"
                              style={{ fontSize: '16px' }}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleUpdateNote(note.id)}
                                className="min-touch-target flex-1 touch-feedback"
                              >
                                儲存
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingNoteId(null);
                                  setEditingNoteText('');
                                  setEditingTagsInput('');
                                }}
                                className="min-touch-target flex-1 touch-feedback"
                              >
                                取消
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* Note text */}
                            <div className="mb-3">
                              <p className={cn(
                                'text-base leading-relaxed whitespace-pre-wrap',
                                hasColor ? 'text-gray-800' : 'text-[var(--note-text-color)]'
                              )}>
                                {displayText}
                              </p>
                              {isLongNote && (
                                <button
                                  className="mt-1 text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
                                  onClick={() => toggleExpand(note.id)}
                                >
                                  {isExpanded
                                    ? <><ChevronUp className="h-3 w-3" />收起</>
                                    : <><ChevronDown className="h-3 w-3" />顯示全文</>
                                  }
                                </button>
                              )}
                            </div>

                            {/* Tags */}
                            {note.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mb-3">
                                {note.tags.map((tag, idx) => (
                                  <button
                                    key={idx}
                                    className="inline-block px-2.5 py-0.5 text-white text-xs rounded-full hover:opacity-80 transition-opacity"
                                    style={{ backgroundColor: tag.color }}
                                    onClick={() => setTagFilter(tagFilter === tag.name ? null : tag.name)}
                                    title={`篩選：${tag.name}`}
                                  >
                                    {tag.name}
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Timestamps */}
                            <div className="text-xs text-gray-400 mb-3 space-y-0.5">
                              <div>建立：{formatDate(new Date(note.createdAt))}</div>
                              {note.updatedAt && note.updatedAt.getTime() !== note.createdAt.getTime() && (
                                <div>更新：{formatDate(new Date(note.updatedAt))}</div>
                              )}
                            </div>

                            {/* Color picker */}
                            {colorPickerNoteId === note.id && (
                              <div className="flex flex-wrap gap-2 mb-3 p-2 bg-black/5 rounded-lg">
                                {NOTE_COLORS.map(c => (
                                  <button
                                    key={c.value}
                                    title={c.name}
                                    onClick={() => {
                                      updateNoteColor(note.id, c.value);
                                      setColorPickerNoteId(null);
                                    }}
                                    className={cn(
                                      'w-7 h-7 rounded-full border-2 transition-transform hover:scale-110',
                                      note.color === c.value ? 'border-gray-700 scale-110' : 'border-gray-300'
                                    )}
                                    style={{ backgroundColor: c.value || '#f3f4f6' }}
                                  />
                                ))}
                              </div>
                            )}

                            {/* Secondary icon actions */}
                            <div className="flex items-center gap-1 mb-2 pb-2 border-b border-black/5">
                              <button
                                aria-label={note.isPinned ? '取消置頂' : '置頂此筆記'}
                                title={note.isPinned ? '取消置頂' : '置頂'}
                                onClick={() => togglePinNote(note.id)}
                                className={cn(
                                  'p-2 rounded-md transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center',
                                  note.isPinned
                                    ? 'text-[var(--header-text-color)] bg-blue-50'
                                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                                )}
                              >
                                {note.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                              </button>
                              <button
                                aria-label="複製筆記內容到剪貼簿"
                                title="複製內容"
                                onClick={() => handleCopyNote(note.text)}
                                className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                              >
                                <Copy className="h-4 w-4" />
                              </button>
                              <button
                                aria-label={colorPickerNoteId === note.id ? '關閉顏色選擇器' : '選擇筆記顏色'}
                                title={colorPickerNoteId === note.id ? '關閉顏色' : '選擇顏色'}
                                onClick={() => setColorPickerNoteId(colorPickerNoteId === note.id ? null : note.id)}
                                className={cn(
                                  'p-2 rounded-md transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center',
                                  colorPickerNoteId === note.id
                                    ? 'text-[var(--header-text-color)] bg-blue-50'
                                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                                )}
                              >
                                <Palette className="h-4 w-4" />
                              </button>
                              {note.color && (
                                <button
                                  aria-label="移除筆記顏色"
                                  title="移除顏色"
                                  onClick={() => updateNoteColor(note.id, '')}
                                  className="p-2 rounded-md text-gray-400 hover:text-red-500 hover:bg-gray-100 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              )}
                            </div>

                            {/* Primary action buttons */}
                            <div className="flex flex-wrap gap-2 pt-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="min-touch-target flex-1 min-w-[72px]"
                                onClick={() => handleStartEdit(note)}
                                disabled={note.isLocked}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                編輯
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="min-touch-target flex-1 min-w-[72px]"
                                onClick={() => handleToggleLock(note)}
                              >
                                {note.isLocked
                                  ? <><Unlock className="h-4 w-4 mr-1" />解鎖</>
                                  : <><Lock className="h-4 w-4 mr-1" />鎖定</>
                                }
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="min-touch-target flex-1 min-w-[72px]"
                                onClick={() => toggleHideNote(note.id)}
                              >
                                {note.isHidden
                                  ? <><Eye className="h-4 w-4 mr-1" />取消隱藏</>
                                  : <><EyeOff className="h-4 w-4 mr-1" />隱藏</>
                                }
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="min-touch-target flex-1 min-w-[72px]"
                                onClick={() => handleDuplicateNote(note)}
                                disabled={note.isLocked}
                                title="建立此筆記的副本"
                              >
                                建立副本
                              </Button>
                              <Button
                                variant={note.isLocked || note.isHidden ? 'outline' : 'destructive'}
                                size="sm"
                                className={cn(
                                  'min-touch-target flex-1 min-w-[72px]',
                                  (note.isLocked || note.isHidden) && 'opacity-40 cursor-not-allowed'
                                )}
                                onClick={() => handleDeleteNote(note)}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                刪除
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </main>

      {/* Floating action button for mobile */}
      {isMobile && (
        <Button
          className="fixed bottom-6 left-6 w-14 h-14 rounded-full shadow-lg z-40 touch-feedback"
          onClick={() => {
            newNoteRef.current?.focus();
            newNoteRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}

      {/* Settings Modal */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-md mx-4 max-h-[90vh] overflow-y-auto" aria-describedby="settings-description">
          <DialogHeader>
            <DialogTitle>⚙️ 設定</DialogTitle>
          </DialogHeader>
          <p id="settings-description" className="sr-only">筆記應用程式的設定選項</p>
          <div className="space-y-6">
            {/* Password settings */}
            <div>
              <h3 className="font-medium mb-3">🔐 全域筆記鎖密碼</h3>
              {globalPassword && (
                <p className="text-xs text-green-600 mb-2">✓ 已設定密碼</p>
              )}
              <div className="space-y-3">
                <Input
                  type="password"
                  placeholder="新密碼（至少 4 字元）"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  style={{ fontSize: '16px' }}
                />
                <Input
                  type="password"
                  placeholder="確認新密碼"
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  style={{ fontSize: '16px' }}
                />
                <div className="flex gap-2">
                  <Button onClick={handleSetGlobalPassword} className="flex-1 min-touch-target">
                    設定密碼
                  </Button>
                  {globalPassword && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setGlobalPassword(null);
                        setPasswordInput('');
                        setConfirmPasswordInput('');
                        toast({ title: '密碼已移除' });
                      }}
                      className="flex-1 min-touch-target"
                    >
                      移除密碼
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Import/Export */}
            <div>
              <h3 className="font-medium mb-3">💾 資料管理</h3>
              <div className="space-y-3">
                <div>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportData}
                    className="hidden"
                    id="importFile"
                  />
                  <Button
                    variant="outline"
                    className="w-full min-touch-target"
                    onClick={() => document.getElementById('importFile')?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    匯入備份（JSON）
                  </Button>
                </div>
                <Button
                  variant="outline"
                  className="w-full min-touch-target"
                  onClick={handleExportData}
                >
                  <Download className="h-4 w-4 mr-2" />
                  匯出備份（JSON）
                </Button>
              </div>
            </div>

            {/* Cloud backups */}
            <div className="border-t pt-6">
              <h3 className="font-medium mb-2 flex items-center gap-2">
                <Cloud className="h-4 w-4" />
                雲端備份
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                備份會儲存在目前應用程式的雲端資料庫，不會上傳全域鎖定密碼與顯示設定。
              </p>
              <Button
                className="w-full min-touch-target mb-3"
                onClick={handleCreateCloudBackup}
              >
                <CloudUpload className="h-4 w-4 mr-2" />
                立即備份至雲端
              </Button>
              {cloudBackups.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-2">尚未建立雲端備份</p>
              ) : (
                <div className="space-y-2">
                  {[...cloudBackups].reverse().slice(0, 5).map((backup) => (
                    <div
                      key={backup.id}
                      className="flex items-center justify-between gap-2 rounded-lg border p-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium">
                          {formatDate(backup.createdAt)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {backup.noteCount} 筆筆記
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-touch-target"
                          onClick={() => handleRestoreCloudBackup(backup.id)}
                          title="還原這份備份"
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          還原
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="min-touch-target text-red-500"
                          onClick={() => handleDeleteCloudBackup(backup.id)}
                          title="刪除這份備份"
                          aria-label="刪除這份雲端備份"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Other settings */}
            <div>
              <h3 className="font-medium mb-3">🛠️ 其他設定</h3>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm">刪除筆記時需要確認</span>
                <Checkbox
                  checked={requireDeleteConfirmation}
                  onCheckedChange={(checked) => setRequireDeleteConfirmation(checked as boolean)}
                />
              </div>
            </div>

            {/* Stats */}
            <div>
              <h3 className="font-medium mb-3">📊 統計資訊</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: '總筆記數', value: stats.total },
                  { label: '置頂筆記', value: stats.pinned },
                  { label: '鎖定筆記', value: stats.locked },
                  { label: '隱藏筆記', value: stats.hidden },
                  { label: '標籤數', value: allTagNames.length },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-[var(--note-bg-color)] rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-[var(--header-text-color)]">{value}</div>
                    <div className="text-xs text-gray-500 mt-1">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Danger zone */}
            <div className="border-t pt-6">
              <h3 className="font-medium text-red-600 mb-3">⚠️ 危險區域</h3>
              <Button
                variant="destructive"
                className="w-full min-touch-target"
                onClick={() => setShowClearConfirm(true)}
              >
                清除所有資料
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Password Prompt Modal */}
      <Dialog open={showPasswordPrompt} onOpenChange={(open) => {
        if (!open) { setShowPasswordPrompt(false); setPasswordPromptInput(''); setPendingAction(null); }
      }}>
        <DialogContent className="max-w-sm mx-4" aria-describedby="password-description">
          <DialogHeader>
            <DialogTitle>🔐 請輸入密碼</DialogTitle>
          </DialogHeader>
          <p id="password-description" className="sr-only">輸入全域密碼以執行受保護的操作</p>
          <div className="space-y-4">
            <Input
              type="password"
              placeholder="密碼"
              value={passwordPromptInput}
              onChange={(e) => setPasswordPromptInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePasswordPromptSubmit()}
              autoFocus
              style={{ fontSize: '16px' }}
            />
            <div className="flex gap-2">
              <Button onClick={handlePasswordPromptSubmit} className="flex-1 min-touch-target">
                確認
              </Button>
              <Button
                variant="outline"
                onClick={() => { setShowPasswordPrompt(false); setPasswordPromptInput(''); setPendingAction(null); }}
                className="flex-1 min-touch-target"
              >
                取消
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-sm mx-4" aria-describedby="delete-description">
          <DialogHeader>
            <DialogTitle>確認刪除</DialogTitle>
          </DialogHeader>
          <p id="delete-description" className="text-sm text-gray-600 mb-4">
            確定要刪除此筆記嗎？<br />
            <span className="font-medium">「{noteToDelete?.text.substring(0, 40)}{(noteToDelete?.text.length ?? 0) > 40 ? '…' : ''}」</span><br />
            此操作無法復原。
          </p>
          <div className="flex gap-2">
            <Button variant="destructive" onClick={confirmDeleteNote} className="flex-1 min-touch-target">
              確定刪除
            </Button>
            <Button variant="outline" onClick={() => { setShowDeleteConfirm(false); setNoteToDelete(null); }} className="flex-1 min-touch-target">
              取消
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Clear All Confirmation Modal */}
      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent className="max-w-sm mx-4" aria-describedby="clear-description">
          <DialogHeader>
            <DialogTitle>⚠️ 清除所有資料</DialogTitle>
          </DialogHeader>
          <p id="clear-description" className="text-sm text-gray-600 mb-4">
            此操作將刪除所有 <strong>{stats.total}</strong> 筆筆記、所有標籤和設定，且<strong>無法復原</strong>。<br /><br />
            請確認您已匯出備份後再繼續。
          </p>
          <div className="flex gap-2">
            <Button variant="destructive" onClick={confirmClearAllData} className="flex-1 min-touch-target">
              確定清除
            </Button>
            <Button variant="outline" onClick={() => setShowClearConfirm(false)} className="flex-1 min-touch-target">
              取消
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
