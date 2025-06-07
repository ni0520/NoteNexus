import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Settings, Plus, Lock, Unlock, Edit, Trash2, Eye, EyeOff, Download, Upload, X } from 'lucide-react';
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

export default function NotesApp() {
  const isMobile = useMobile();
  const {
    notes,
    addNote,
    updateNote,
    deleteNote,
    toggleLockNote,
    toggleHideNote,
    exportData,
    importData,
    clearAllData
  } = useNotes();

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
  const [allTags, setAllTags] = useState<Map<string, string>>(new Map());

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

    const savedTags = localStorage.getItem('notes-all-tags');
    if (savedTags) {
      try {
        setAllTags(new Map(JSON.parse(savedTags)));
      } catch (error) {
        console.error('Failed to parse tags:', error);
      }
    }
  }, []);

  // Save settings to localStorage
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

  useEffect(() => {
    localStorage.setItem('notes-all-tags', JSON.stringify(Array.from(allTags.entries())));
  }, [allTags]);

  const getNextColor = useCallback((existingColors: string[]): string => {
    const usedColors = new Set(existingColors);
    if (usedColors.size >= PREDEFINED_TAG_COLORS.length) {
      return PREDEFINED_TAG_COLORS[usedColors.size % PREDEFINED_TAG_COLORS.length];
    }
    for (const color of PREDEFINED_TAG_COLORS) {
      if (!usedColors.has(color)) {
        return color;
      }
    }
    return PREDEFINED_TAG_COLORS[0];
  }, []);

  const processTagsInput = useCallback((tagsInput: string): Tag[] => {
    const tagNames = tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag !== '');
    const newAllTags = new Map(allTags);
    let newColorAssigned = false;

    const processedTags = tagNames.map(name => {
      let color = newAllTags.get(name);
      if (!color) {
        color = getNextColor(Array.from(newAllTags.values()));
        newAllTags.set(name, color);
        newColorAssigned = true;
      }
      return { name, color };
    });

    if (newColorAssigned) setAllTags(newAllTags);
    return processedTags;
  }, [allTags, getNextColor]);

  const filteredAndSortedNotes = useMemo(() => {
    let filtered = notes.filter(note => {
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      return (
        note.text.toLowerCase().includes(searchLower) ||
        note.tags.some(tag => tag.name.toLowerCase().includes(searchLower))
      );
    });

    return filtered.sort((a, b) => {
      switch (sortOrder) {
        case 'createdAt-desc':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'createdAt-asc':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'updatedAt-desc':
          return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
        case 'updatedAt-asc':
          return new Date(a.updatedAt || a.createdAt).getTime() - new Date(b.updatedAt || b.createdAt).getTime();
        case 'text-asc':
          return a.text.localeCompare(b.text);
        case 'text-desc':
          return b.text.localeCompare(a.text);
        default:
          return 0;
      }
    });
  }, [notes, searchTerm, sortOrder]);

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentNoteText.trim() === '') return;

    const tags = processTagsInput(currentTagsInput);
    addNote(currentNoteText.trim(), tags);
    setCurrentNoteText('');
    setCurrentTagsInput('');
  };

  const handleUpdateNote = (noteId: string) => {
    if (editingNoteText.trim() === '') return;

    const tags = processTagsInput(editingTagsInput);
    updateNote(noteId, editingNoteText.trim(), tags);
    setEditingNoteId(null);
    setEditingNoteText('');
    setEditingTagsInput('');
  };

  const handleStartEdit = (note: Note) => {
    if (note.isLocked) {
      alert('此筆記已上鎖。請先解鎖才能編輯。');
      return;
    }
    setEditingNoteId(note.id);
    setEditingNoteText(note.text);
    setEditingTagsInput(note.tags.map(tag => tag.name).join(', '));
  };

  const handleDeleteNote = (note: Note) => {
    if (note.isLocked) {
      setPendingAction({ type: 'delete', noteId: note.id });
      setShowPasswordPrompt(true);
      return;
    }

    if (requireDeleteConfirmation) {
      const confirmed = window.confirm(`確定要刪除筆記 "${note.text.substring(0, 30)}..." 嗎？`);
      if (!confirmed) return;
    }

    deleteNote(note.id);
    setSelectedNoteIds(prev => prev.filter(id => id !== note.id));
  };

  const handleToggleLock = (note: Note) => {
    if (!globalPassword && !note.isLocked) {
      alert('請先在設定中設定全域筆記鎖密碼。');
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
      alert('密碼錯誤！');
      return;
    }

    if (pendingAction) {
      switch (pendingAction.type) {
        case 'delete':
          if (pendingAction.noteId) {
            deleteNote(pendingAction.noteId);
            setSelectedNoteIds(prev => prev.filter(id => id !== pendingAction.noteId));
          }
          break;
        case 'unlock':
          if (pendingAction.noteId) {
            toggleLockNote(pendingAction.noteId);
          }
          break;
        case 'toggleHideSelected':
          if (pendingAction.noteIds) {
            pendingAction.noteIds.forEach(id => toggleHideNote(id));
          }
          break;
        case 'toggleLockSelected':
          if (pendingAction.noteIds) {
            pendingAction.noteIds.forEach(id => toggleLockNote(id));
          }
          break;
      }
    }

    setShowPasswordPrompt(false);
    setPasswordPromptInput('');
    setPendingAction(null);
  };

  const handleSetGlobalPassword = () => {
    if (passwordInput !== confirmPasswordInput) {
      alert('密碼不符！請重新輸入。');
      return;
    }

    if (passwordInput.length > 0 && passwordInput.length < 4) {
      alert('密碼至少需要4個字元。');
      return;
    }

    setGlobalPassword(passwordInput || null);
    alert(passwordInput ? '全域筆記鎖密碼已設定！' : '全域筆記鎖密碼已移除。');
    setPasswordInput('');
    setConfirmPasswordInput('');
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
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

    const hasLockedNotes = selectedNoteIds.some(id => {
      const note = notes.find(n => n.id === id);
      return note?.isLocked;
    });

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
      alert('請先在設定中設定全域筆記鎖密碼。');
      setIsSettingsOpen(true);
      return;
    }

    const hasLockedNotes = selectedNoteIds.some(id => {
      const note = notes.find(n => n.id === id);
      return note?.isLocked;
    });

    if (hasLockedNotes) {
      setPendingAction({ type: 'toggleLockSelected', noteIds: selectedNoteIds });
      setShowPasswordPrompt(true);
    } else {
      selectedNoteIds.forEach(id => toggleLockNote(id));
    }
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleString('zh-TW', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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
        alert('資料匯入成功！');
      } catch (error) {
        alert('匯入失敗，請確認檔案格式正確。');
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
  };

  const handleClearAllData = () => {
    const confirmed = window.confirm('確定要清除所有資料嗎？此操作無法復原！');
    if (confirmed) {
      clearAllData();
      setSelectedNoteIds([]);
      setAllTags(new Map());
      alert('所有資料已清除。');
    }
  };

  return (
    <div className="min-h-screen min-h-[calc(var(--vh,1vh)*100)] bg-[var(--bg-color)] text-[var(--text-color)] theme-transition flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[var(--card-bg-color)] shadow-sm safe-area-top flex-shrink-0">
        <div className="max-w-4xl mx-auto px-4 py-3 safe-area-left safe-area-right">
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--header-text-color)]">
              小筆記 Pro
            </h1>
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Select value={theme} onValueChange={(value: Theme) => setTheme(value)}>
                <SelectTrigger className="w-[100px] sm:w-[120px] min-touch-target touch-feedback">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">明亮</SelectItem>
                  <SelectItem value="dark">暗黑</SelectItem>
                  <SelectItem value="sepia">復古</SelectItem>
                  <SelectItem value="gray">灰色</SelectItem>
                  <SelectItem value="green">綠色</SelectItem>
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
      <main className="flex-1 max-w-4xl mx-auto px-4 py-6 safe-area-left safe-area-right safe-area-bottom overflow-y-auto">
        {/* Search and controls */}
        <div className="mb-6 space-y-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="搜尋筆記內容或標籤..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-[var(--control-button-bg)] border-[var(--control-button-border)] touch-feedback"
              style={{ fontSize: '16px' }}
            />
          </div>

          {/* Control buttons */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="selectAll"
                checked={selectedNoteIds.length === filteredAndSortedNotes.length && filteredAndSortedNotes.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <label htmlFor="selectAll" className="text-sm">全選</label>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="min-touch-target touch-feedback"
              disabled={selectedNoteIds.length === 0}
              onClick={handleToggleHideSelected}
            >
              <EyeOff className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">隱藏選中</span>
              <span className="sm:hidden">隱藏</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="min-touch-target touch-feedback"
              disabled={selectedNoteIds.length === 0}
              onClick={handleToggleLockSelected}
            >
              <Lock className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">鎖定選中</span>
              <span className="sm:hidden">鎖定</span>
            </Button>
          </div>

          {/* Sort options */}
          <div className="flex items-center space-x-3 overflow-x-auto">
            <span className="text-sm whitespace-nowrap">排序：</span>
            <Select value={sortOrder} onValueChange={(value: SortOrder) => setSortOrder(value)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt-desc">建立時間（新到舊）</SelectItem>
                <SelectItem value="createdAt-asc">建立時間（舊到新）</SelectItem>
                <SelectItem value="updatedAt-desc">更新時間（新到舊）</SelectItem>
                <SelectItem value="updatedAt-asc">更新時間（舊到新）</SelectItem>
                <SelectItem value="text-asc">內容（A-Z）</SelectItem>
                <SelectItem value="text-desc">內容（Z-A）</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Add new note */}
        <Card className="mb-6 bg-[var(--card-bg-color)]">
          <CardContent className="p-4">
            <form onSubmit={handleAddNote} className="space-y-4">
              <Textarea
                placeholder="在此輸入新筆記..."
                value={currentNoteText}
                onChange={(e) => setCurrentNoteText(e.target.value)}
                className="min-h-[100px] bg-[var(--note-bg-color)] border-[var(--input-border-color)] touch-feedback"
                rows={4}
                style={{ fontSize: '16px' }}
              />
              <Input
                type="text"
                placeholder="標籤（用逗號分隔）"
                value={currentTagsInput}
                onChange={(e) => setCurrentTagsInput(e.target.value)}
                className="bg-[var(--note-bg-color)] border-[var(--input-border-color)] touch-feedback"
                style={{ fontSize: '16px' }}
              />
              <div className="flex justify-end">
                <Button type="submit" className="min-touch-target touch-feedback">
                  <Plus className="h-4 w-4 mr-2" />
                  新增筆記
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Notes list */}
        <div className="space-y-4">
          {filteredAndSortedNotes.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📝</div>
              <h3 className="text-lg font-medium mb-2">還沒有任何筆記</h3>
              <p className="text-gray-500">開始建立您的第一個筆記吧！</p>
            </div>
          ) : (
            filteredAndSortedNotes.map((note) => (
              <Card
                key={note.id}
                className={cn(
                  "bg-[var(--note-bg-color)] note-transition",
                  note.isHidden && "opacity-60"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      checked={selectedNoteIds.includes(note.id)}
                      onCheckedChange={(checked) => handleNoteSelect(note.id, checked as boolean)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      {/* Note header */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {note.isLocked && (
                            <Lock className="h-4 w-4 text-[var(--locked-color)]" />
                          )}
                          {note.isHidden && (
                            <span className="text-xs text-[var(--hidden-note-label-color)] italic">
                              隱藏
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400">
                          {formatDate(new Date(note.createdAt))}
                        </span>
                      </div>

                      {/* Note content */}
                      {editingNoteId === note.id ? (
                        <div className="space-y-3">
                          <Textarea
                            value={editingNoteText}
                            onChange={(e) => setEditingNoteText(e.target.value)}
                            className="min-h-[80px]"
                          />
                          <Input
                            type="text"
                            value={editingTagsInput}
                            onChange={(e) => setEditingTagsInput(e.target.value)}
                            placeholder="標籤（用逗號分隔）"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleUpdateNote(note.id)}
                              className="min-touch-target flex-1"
                            >
                              更新
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingNoteId(null)}
                              className="min-touch-target flex-1"
                            >
                              取消
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="mb-3">
                            <p className="text-[var(--note-text-color)] text-base leading-relaxed whitespace-pre-wrap">
                              {note.text}
                            </p>
                          </div>

                          {/* Tags */}
                          {note.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3">
                              {note.tags.map((tag, index) => (
                                <span
                                  key={index}
                                  className="inline-block px-3 py-1 text-white text-xs rounded-full"
                                  style={{ backgroundColor: tag.color }}
                                >
                                  {tag.name}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Timestamps */}
                          <div className="text-xs text-gray-400 mb-3 space-y-1">
                            <div>建立：{formatDate(new Date(note.createdAt))}</div>
                            {note.updatedAt && (
                              <div>更新：{formatDate(new Date(note.updatedAt))}</div>
                            )}
                          </div>

                          {/* Action buttons */}
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="min-touch-target flex-1 min-w-[80px]"
                              onClick={() => handleStartEdit(note)}
                              disabled={note.isLocked}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              編輯
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="min-touch-target flex-1 min-w-[80px]"
                              onClick={() => handleToggleLock(note)}
                            >
                              {note.isLocked ? (
                                <>
                                  <Unlock className="h-4 w-4 mr-1" />
                                  解鎖
                                </>
                              ) : (
                                <>
                                  <Lock className="h-4 w-4 mr-1" />
                                  鎖定
                                </>
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="min-touch-target flex-1 min-w-[80px]"
                              onClick={() => toggleHideNote(note.id)}
                            >
                              {note.isHidden ? (
                                <>
                                  <Eye className="h-4 w-4 mr-1" />
                                  顯示
                                </>
                              ) : (
                                <>
                                  <EyeOff className="h-4 w-4 mr-1" />
                                  隱藏
                                </>
                              )}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="min-touch-target flex-1 min-w-[80px]"
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
            ))
          )}
        </div>
      </main>

      {/* Floating action button for mobile */}
      {isMobile && (
        <Button
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg z-40"
          onClick={() => {
            const noteContent = document.querySelector('textarea');
            noteContent?.focus();
            noteContent?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}

      {/* Settings Modal */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-md mx-4 max-h-[90vh] overflow-y-auto" aria-describedby="settings-description">
          <DialogHeader>
            <DialogTitle>設定</DialogTitle>
          </DialogHeader>
          <p id="settings-description" className="sr-only">筆記應用程式的設定選項，包括密碼管理、資料匯入匯出和其他偏好設定</p>
          <div className="space-y-6">
            {/* Password settings */}
            <div>
              <h3 className="font-medium mb-3">全域筆記鎖密碼</h3>
              <div className="space-y-3">
                <Input
                  type="password"
                  placeholder="新密碼"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                />
                <Input
                  type="password"
                  placeholder="確認密碼"
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                />
                <Button
                  onClick={handleSetGlobalPassword}
                  className="w-full min-touch-target"
                >
                  設定密碼
                </Button>
              </div>
            </div>

            {/* Import/Export */}
            <div>
              <h3 className="font-medium mb-3">資料管理</h3>
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
                    匯入資料
                  </Button>
                </div>
                <Button
                  variant="outline"
                  className="w-full min-touch-target"
                  onClick={handleExportData}
                >
                  <Download className="h-4 w-4 mr-2" />
                  匯出資料
                </Button>
              </div>
            </div>

            {/* Other settings */}
            <div>
              <h3 className="font-medium mb-3">其他設定</h3>
              <div className="flex items-center justify-between">
                <span>刪除筆記時需要確認</span>
                <Checkbox
                  checked={requireDeleteConfirmation}
                  onCheckedChange={(checked) => setRequireDeleteConfirmation(checked as boolean)}
                />
              </div>
            </div>

            {/* Danger zone */}
            <div className="border-t pt-6">
              <h3 className="font-medium text-red-600 mb-3">危險區域</h3>
              <Button
                variant="destructive"
                className="w-full min-touch-target"
                onClick={handleClearAllData}
              >
                清除所有資料
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Password Prompt Modal */}
      <Dialog open={showPasswordPrompt} onOpenChange={setShowPasswordPrompt}>
        <DialogContent className="max-w-sm mx-4" aria-describedby="password-description">
          <DialogHeader>
            <DialogTitle>請輸入密碼</DialogTitle>
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
            />
            <div className="flex gap-2">
              <Button
                onClick={handlePasswordPromptSubmit}
                className="flex-1 min-touch-target"
              >
                確認
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowPasswordPrompt(false);
                  setPasswordPromptInput('');
                  setPendingAction(null);
                }}
                className="flex-1 min-touch-target"
              >
                取消
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
