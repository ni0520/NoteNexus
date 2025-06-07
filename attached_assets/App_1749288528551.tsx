import React from 'react';

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
  isHidden?: boolean; // New property for individual note visibility
}

type SortOrder = 
  | 'createdAt-desc' | 'createdAt-asc' 
  | 'updatedAt-desc' | 'updatedAt-asc' 
  | 'text-asc' | 'text-desc';

type PasswordActionType = 'delete' | 'unlock' | 'toggleHideSelected' | 'toggleLockSelected';


const PREDEFINED_TAG_COLORS: string[] = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FED766', '#2AB7CA',
  '#F0B67F', '#8A6FBF', '#F9ADA0', '#57A773', '#F17A7E',
  '#82D173', '#4A4E69', '#F9A620', '#7B5E7B', '#D65780',
  '#FFB347', '#FFCC5C', '#96E072', '#7BE0AD', '#5DC8E0'
];

const VALID_THEMES = ['light', 'dark', 'sepia', 'gray', 'green'];
const DEFAULT_THEME = 'light';
const DEFAULT_REQUIRE_DELETE_CONFIRMATION = true;
const DEFAULT_SORT_ORDER: SortOrder = 'createdAt-desc';
const CONFIRM_CLEAR_ALL_TEXT = "DELETE ALL";


const getNextColor = (existingColors: string[]): string => {
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
};

const isColorLight = (hexColor: string): boolean => {
  if (!hexColor) return true;
  const hex = hexColor.replace('#', '');
  if (hex.length !== 6 && hex.length !== 3) return true;
  
  let r, g, b;
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else {
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  }
  
  const hsp = Math.sqrt(0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b));
  return hsp > 127.5;
};

const LockIcon = () => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true">
    <path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6z"/>
  </svg>
);


const App: React.FC = () => {
  const [notes, setNotes] = React.useState<Note[]>([]);
  const [currentNoteText, setCurrentNoteText] = React.useState<string>('');
  const [currentTagsInput, setCurrentTagsInput] = React.useState<string>('');
  
  const [editingNoteId, setEditingNoteId] = React.useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = React.useState<string>('');
  const [editingTagsInput, setEditingTagsInput] = React.useState<string>('');

  const [theme, setTheme] = React.useState<string>(DEFAULT_THEME);
  const [allTags, setAllTags] = React.useState<Map<string, string>>(new Map());

  const [isSettingsModalOpen, setIsSettingsModalOpen] = React.useState<boolean>(false);
  const [globalLockPassword, setGlobalLockPassword] = React.useState<string | null>(null);
  const [settingsPasswordInput, setSettingsPasswordInput] = React.useState<string>('');
  const [settingsConfirmPasswordInput, setSettingsConfirmPasswordInput] = React.useState<string>('');
  const [requireDeleteConfirmation, setRequireDeleteConfirmation] = React.useState<boolean>(DEFAULT_REQUIRE_DELETE_CONFIRMATION);
  
  const [searchTerm, setSearchTerm] = React.useState<string>('');

  const [showPasswordPrompt, setShowPasswordPrompt] = React.useState<boolean>(false);
  const [passwordPromptInput, setPasswordPromptInput] = React.useState<string>('');
  const [noteForPasswordAction, setNoteForPasswordAction] = React.useState<Note | null>(null);
  const [passwordActionType, setPasswordActionType] = React.useState<PasswordActionType | null>(null); 

  const [sortOrder, setSortOrder] = React.useState<SortOrder>(DEFAULT_SORT_ORDER);
  const [clearAllDataConfirmationInput, setClearAllDataConfirmationInput] = React.useState<string>('');
  const [tagManagementNameInput, setTagManagementNameInput] = React.useState<string>('');
  const [selectedTagForManagement, setSelectedTagForManagement] = React.useState<string | null>(null);

  const [selectedNoteIds, setSelectedNoteIds] = React.useState<string[]>([]); 

  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);


  React.useEffect(() => {
    const storedNotes = localStorage.getItem('web-notes-pro-notes');
    if (storedNotes) {
      try {
        const parsedNotes: Note[] = JSON.parse(storedNotes).map((note: any) => ({
          ...note,
          createdAt: new Date(note.createdAt),
          updatedAt: note.updatedAt ? new Date(note.updatedAt) : undefined,
          tags: Array.isArray(note.tags) ? note.tags : [],
          isLocked: note.isLocked || false,
          isHidden: note.isHidden || false, 
        }));
        setNotes(parsedNotes);
      } catch (error) { console.error("Failed to parse notes:", error); setNotes([]); }
    }

    const storedTheme = localStorage.getItem('web-notes-pro-theme');
    if (storedTheme && VALID_THEMES.includes(storedTheme)) setTheme(storedTheme);
    else setTheme(DEFAULT_THEME);

    const storedAllTags = localStorage.getItem('web-notes-pro-allTags');
    if (storedAllTags) {
      try { setAllTags(new Map(JSON.parse(storedAllTags))); }
      catch (error) { console.error("Failed to parse allTags:", error); setAllTags(new Map());}
    }

    const storedPassword = localStorage.getItem('web-notes-pro-password');
    if (storedPassword) setGlobalLockPassword(storedPassword);
    
    const storedDeleteConfirm = localStorage.getItem('web-notes-pro-delete-confirm');
    setRequireDeleteConfirmation(storedDeleteConfirm ? JSON.parse(storedDeleteConfirm) : DEFAULT_REQUIRE_DELETE_CONFIRMATION);
    
    const storedSortOrder = localStorage.getItem('web-notes-pro-sortOrder') as SortOrder;
    if (storedSortOrder) setSortOrder(storedSortOrder);
    else setSortOrder(DEFAULT_SORT_ORDER);

  }, []); 

  React.useEffect(() => { localStorage.setItem('web-notes-pro-notes', JSON.stringify(notes)); }, [notes]);
  React.useEffect(() => { document.body.className = `theme-${theme}`; localStorage.setItem('web-notes-pro-theme', theme);}, [theme]);
  React.useEffect(() => { localStorage.setItem('web-notes-pro-allTags', JSON.stringify(Array.from(allTags.entries())));}, [allTags]);
  React.useEffect(() => { if (globalLockPassword) localStorage.setItem('web-notes-pro-password', globalLockPassword); else localStorage.removeItem('web-notes-pro-password'); }, [globalLockPassword]);
  React.useEffect(() => { localStorage.setItem('web-notes-pro-delete-confirm', JSON.stringify(requireDeleteConfirmation));}, [requireDeleteConfirmation]);
  React.useEffect(() => { localStorage.setItem('web-notes-pro-sortOrder', sortOrder); }, [sortOrder]);


  const processTagsInput = React.useCallback((tagsInput: string): Tag[] => {
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
  }, [allTags]);

  const handleAddNote = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (currentNoteText.trim() === '') return;
    saveSnapshot();
    const newNoteTags = processTagsInput(currentTagsInput);
    const newNote: Note = {
      id: Date.now().toString(),
      text: currentNoteText.trim(),
      tags: newNoteTags,
      createdAt: new Date(),
      updatedAt: new Date(),
      isLocked: false,
      isHidden: false, 
    };
    setNotes(prevNotes => [newNote, ...prevNotes]);
    setCurrentNoteText(''); setCurrentTagsInput('');
  };

  const handleDeleteNote = (noteToDelete: Note) => {
    if (noteToDelete.isLocked) {
        setNoteForPasswordAction(noteToDelete);
        setPasswordActionType('delete');
        setShowPasswordPrompt(true);
        return;
    }
    if (requireDeleteConfirmation && !window.confirm(`確定要刪除筆記 "${noteToDelete.text.substring(0,30)}..." 嗎？`)) {
      return;
    }
    saveSnapshot();
    setNotes(prevNotes => prevNotes.filter(note => note.id !== noteToDelete.id));
    if (editingNoteId === noteToDelete.id) {
      setEditingNoteId(null); setEditingNoteText(''); setEditingTagsInput('');
    }
    setSelectedNoteIds(prevSelected => prevSelected.filter(id => id !== noteToDelete.id)); 
  };
  
  const executeDeleteNote = (noteId: string) => {
    setNotes(prevNotes => prevNotes.filter(note => note.id !== noteId));
    if (editingNoteId === noteId) {
      setEditingNoteId(null); setEditingNoteText(''); setEditingTagsInput('');
    }
    setSelectedNoteIds(prevSelected => prevSelected.filter(id => id !== noteId));
  }

  const handleStartEdit = (note: Note) => {
    if (note.isLocked) {
      alert("此筆記已上鎖。請先解鎖才能編輯。");
      return;
    }
    setEditingNoteId(note.id);
    setEditingNoteText(note.text);
    setEditingTagsInput(note.tags.map(tag => tag.name).join(', '));
  };

  const handleUpdateNote = (idToUpdate: string) => {
    if (editingNoteText.trim() === '') { alert("筆記內容不能為空"); return; }
    saveSnapshot();
    const updatedNoteTags = processTagsInput(editingTagsInput);
    setNotes(prevNotes =>
      prevNotes.map(note =>
        note.id === idToUpdate 
        ? { ...note, text: editingNoteText.trim(), tags: updatedNoteTags, updatedAt: new Date() } 
        : note
      )
    );
    setEditingNoteId(null); setEditingNoteText(''); setEditingTagsInput('');
  };
  
  const handleCancelEdit = () => { setEditingNoteId(null); setEditingNoteText(''); setEditingTagsInput(''); };
  const handleThemeChange = (event: React.ChangeEvent<HTMLSelectElement>) => setTheme(event.target.value);
  const formatDate = (date?: Date): string => date ? date.toLocaleString('zh-TW', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

  const openSettingsModal = () => setIsSettingsModalOpen(true);
  const closeSettingsModal = () => {
    setIsSettingsModalOpen(false);
    setSettingsPasswordInput('');
    setSettingsConfirmPasswordInput('');
    setClearAllDataConfirmationInput('');
    setSelectedTagForManagement(null);
    setTagManagementNameInput('');
  };

  const handleSetGlobalPassword = () => {
    if (settingsPasswordInput !== settingsConfirmPasswordInput) {
      alert("密碼不符！請重新輸入。"); return;
    }
    if (settingsPasswordInput.length > 0 && settingsPasswordInput.length < 4) {
        alert("密碼至少需要4個字元。"); return;
    }
    setGlobalLockPassword(settingsPasswordInput || null); 
    alert(settingsPasswordInput ? "全域筆記鎖密碼已設定！" : "全域筆記鎖密碼已移除。");
    setSettingsPasswordInput(''); setSettingsConfirmPasswordInput('');
  };

  const toggleLockNote = (noteToToggle: Note) => {
    if (!globalLockPassword && !noteToToggle.isLocked) { // Trying to lock without a global password
      alert("請先在「設定」中設定全域筆記鎖密碼。"); 
      openSettingsModal(); 
      return;
    }
    if (noteToToggle.isLocked) { // Trying to unlock (may or may not require password)
        if (globalLockPassword) { // Global password exists, so prompt for it to unlock
            setNoteForPasswordAction(noteToToggle); 
            setPasswordActionType('unlock'); 
            setShowPasswordPrompt(true);
        } else { // No global password, unlock directly
            executeUnlockNote(noteToToggle.id);
        }
    } else { // Trying to lock (global password must exist at this point due to the first check)
        setNotes(prevNotes => prevNotes.map(n => n.id === noteToToggle.id ? { ...n, isLocked: true, updatedAt: new Date() } : n));
    }
  };
  
  const executeUnlockNote = (noteId: string) => {
     setNotes(prevNotes => prevNotes.map(n => n.id === noteId ? { ...n, isLocked: false, updatedAt: new Date() } : n));
  }

  const handlePasswordPromptSubmit = () => {
    if (!globalLockPassword) { alert("錯誤：未設定全域密碼。"); closePasswordPrompt(); return;}
    if (passwordPromptInput === globalLockPassword) {
      if (noteForPasswordAction && passwordActionType === 'delete') executeDeleteNote(noteForPasswordAction.id);
      else if (noteForPasswordAction && passwordActionType === 'unlock') executeUnlockNote(noteForPasswordAction.id);
      else if (passwordActionType === 'toggleHideSelected') executeToggleHideSelectedNotes(); 
      else if (passwordActionType === 'toggleLockSelected') executeToggleLockSelectedNotes();
      closePasswordPrompt();
    } else {
      alert("密碼錯誤！");
    }
  };
  const closePasswordPrompt = () => {
    setShowPasswordPrompt(false); setPasswordPromptInput(''); setNoteForPasswordAction(null); setPasswordActionType(null);
  };

  const handleExportNotes = () => {
    const dataToExport = {
      notes: notes.map(note => ({...note, createdAt: note.createdAt.toISOString(), updatedAt: note.updatedAt?.toISOString() })),
      allTags: Array.from(allTags.entries()),
      theme: theme,
      requireDeleteConfirmation: requireDeleteConfirmation,
      sortOrder: sortOrder,
    };
    const jsonString = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `小筆記Pro-備份-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    alert("筆記已匯出！");
  };

  const handleImportNotes = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!window.confirm("匯入資料將會覆蓋現有所有筆記、標籤和部分設定。確定要繼續嗎？")) {
        event.target.value = ''; return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = e.target?.result;
        if (typeof result === 'string') {
          const importedData = JSON.parse(result);
          if (importedData.notes && importedData.allTags) {
            const parsedNotes: Note[] = importedData.notes.map((note: any) => ({
              ...note,
              createdAt: new Date(note.createdAt),
              updatedAt: note.updatedAt ? new Date(note.updatedAt) : undefined,
              tags: Array.isArray(note.tags) ? note.tags : [],
              isLocked: note.isLocked || false,
              isHidden: note.isHidden || false, 
            }));
            setNotes(parsedNotes);
            setAllTags(new Map(importedData.allTags));
            if (importedData.theme && VALID_THEMES.includes(importedData.theme)) setTheme(importedData.theme);
            if (typeof importedData.requireDeleteConfirmation === 'boolean') setRequireDeleteConfirmation(importedData.requireDeleteConfirmation);
            if (importedData.sortOrder) setSortOrder(importedData.sortOrder as SortOrder);
            alert("資料匯入成功！");
          } else { alert("檔案格式錯誤：缺少 'notes' 或 'allTags'。");}
        }
      } catch (error) { console.error("匯入錯誤:", error); alert("匯入失敗，檔案可能已損毀或格式不符。");
      } finally { event.target.value = ''; }
    };
    reader.readAsText(file);
  };
  
  const getSortedNotes = React.useCallback((notesToSort: Note[]): Note[] => {
    return [...notesToSort].sort((a, b) => {
      switch (sortOrder) {
        case 'createdAt-asc': return a.createdAt.getTime() - b.createdAt.getTime();
        case 'createdAt-desc': return b.createdAt.getTime() - a.createdAt.getTime();
        case 'updatedAt-asc': return (a.updatedAt || a.createdAt).getTime() - (b.updatedAt || b.createdAt).getTime();
        case 'updatedAt-desc': return (b.updatedAt || b.createdAt).getTime() - (a.updatedAt || a.createdAt).getTime();
        case 'text-asc': return a.text.localeCompare(b.text);
        case 'text-desc': return b.text.localeCompare(a.text);
        default: return 0;
      }
    });
  }, [sortOrder]);

  const filteredAndSortedNotes = React.useMemo(() => {
    const filtered = notes.filter(note => {
      if (!searchTerm) return true;
      const lowerSearchTerm = searchTerm.toLowerCase();
      const inText = note.text.toLowerCase().includes(lowerSearchTerm);
      const inTags = note.tags.some(tag => tag.name.toLowerCase().includes(lowerSearchTerm));
      return inText || inTags;
    });
    return getSortedNotes(filtered);
  }, [notes, searchTerm, getSortedNotes]);

  const handleRenameTag = () => {
    if (!selectedTagForManagement || !tagManagementNameInput.trim()) {
      alert("請選擇一個標籤並輸入新的名稱。"); return;
    }
    const oldName = selectedTagForManagement;
    const newName = tagManagementNameInput.trim();

    if (oldName === newName) { alert("新舊名稱相同。"); return; }
    if (allTags.has(newName)) { alert(`標籤 "${newName}" 已存在。請選擇其他名稱。`); return; }

    const updatedAllTags = new Map(allTags);
    const color = updatedAllTags.get(oldName);
    if (!color) return;
    updatedAllTags.delete(oldName);
    updatedAllTags.set(newName, color);
    setAllTags(updatedAllTags);

    setNotes(prevNotes => prevNotes.map(note => ({
        ...note,
        tags: note.tags.map(tag => tag.name === oldName ? { ...tag, name: newName } : tag),
        updatedAt: note.tags.some(t => t.name === oldName) ? new Date() : note.updatedAt
    })));
    setSelectedTagForManagement(newName);
    alert(`標籤 "${oldName}" 已重新命名為 "${newName}"。`);
  };

  const handleChangeTagColor = (newColor: string) => {
    if (!selectedTagForManagement) { alert("請先選擇一個標籤。"); return; }
    const tagName = selectedTagForManagement;

    const updatedAllTags = new Map(allTags);
    updatedAllTags.set(tagName, newColor);
    setAllTags(updatedAllTags);

    setNotes(prevNotes => prevNotes.map(note => ({
        ...note,
        tags: note.tags.map(tag => tag.name === tagName ? { ...tag, color: newColor } : tag),
        updatedAt: note.tags.some(t => t.name === tagName) ? new Date() : note.updatedAt
    })));
    alert(`標籤 "${tagName}" 的顏色已更新。`);
  };

  const handleDeleteTag = (tagNameToDelete: string) => {
    if (!window.confirm(`確定要從所有筆記中刪除標籤 "${tagNameToDelete}" 並移除此標籤嗎？此操作無法復原。`)) return;

    const updatedAllTags = new Map(allTags);
    updatedAllTags.delete(tagNameToDelete);
    setAllTags(updatedAllTags);

    setNotes(prevNotes => prevNotes.map(note => ({
        ...note,
        tags: note.tags.filter(tag => tag.name !== tagNameToDelete),
        updatedAt: note.tags.some(t => t.name === tagNameToDelete) ? new Date() : note.updatedAt
    })));
    
    if (selectedTagForManagement === tagNameToDelete) {
        setSelectedTagForManagement(null);
        setTagManagementNameInput('');
    }
    alert(`標籤 "${tagNameToDelete}" 已被刪除。`);
  };
  
  const handleClearAllData = () => {
    if (clearAllDataConfirmationInput.toUpperCase() !== CONFIRM_CLEAR_ALL_TEXT) {
      alert(`確認文字不符。請輸入 '${CONFIRM_CLEAR_ALL_TEXT}' 以確認。`); return;
    }
    if (!window.confirm("警告！此操作將永久刪除所有筆記、標籤和設定，且無法復原。您確定要繼續嗎？")) return;

    setNotes([]);
    setAllTags(new Map());
    setTheme(DEFAULT_THEME);
    setGlobalLockPassword(null);
    setRequireDeleteConfirmation(DEFAULT_REQUIRE_DELETE_CONFIRMATION);
    setSortOrder(DEFAULT_SORT_ORDER);
    setSearchTerm('');
    setSelectedNoteIds([]); 

    localStorage.removeItem('web-notes-pro-notes');
    localStorage.removeItem('web-notes-pro-allTags');
    localStorage.removeItem('web-notes-pro-theme');
    localStorage.removeItem('web-notes-pro-password');
    localStorage.removeItem('web-notes-pro-delete-confirm');
    localStorage.removeItem('web-notes-pro-sortOrder');
    
    alert("所有資料已清除。應用程式已重設為預設值。");
    closeSettingsModal();
  };

  const handleSelectNote = (noteId: string) => {
    setSelectedNoteIds(prevSelected =>
      prevSelected.includes(noteId)
        ? prevSelected.filter(id => id !== noteId)
        : [...prevSelected, noteId]
    );
  };

  const handleToggleSelectAll = () => {
    const allAreSelected = notes.length > 0 && notes.every(note => selectedNoteIds.includes(note.id));
    if (allAreSelected) {
      setSelectedNoteIds([]);
    } else {
      setSelectedNoteIds(notes.map(note => note.id));
    }
  };
  
  const executeToggleHideSelectedNotes = () => {
    if (selectedNoteIds.length === 0) return;

    const notesToUpdate = notes.filter(note => selectedNoteIds.includes(note.id));
    if (notesToUpdate.length === 0) {
        alert("選取的筆記已不存在或無法找到。請重新選取。");
        setSelectedNoteIds([]);
        return;
    }
    
    const shouldHide = notesToUpdate.some(note => !note.isHidden);

    setNotes(prevNotes =>
      prevNotes.map(note =>
        selectedNoteIds.includes(note.id)
          ? { ...note, isHidden: shouldHide, updatedAt: new Date() }
          : note
      )
    );
    alert(shouldHide ? `${notesToUpdate.length} 個選取的筆記已隱藏。` : `${notesToUpdate.length} 個選取的筆記已取消隱藏。`);
    setSelectedNoteIds([]); 
  };

  const handleToggleHideSelectedNotes = () => {
    if (selectedNoteIds.length === 0) {
      alert("請先選取至少一個筆記。");
      return;
    }
    if (globalLockPassword) {
      setPasswordActionType('toggleHideSelected');
      setShowPasswordPrompt(true);
    } else {
      executeToggleHideSelectedNotes();
    }
  };

  const handleDeleteSelectedNotes = () => {
    if (selectedNoteIds.length === 0) {
      alert("請先選取要刪除的筆記。");
      return;
    }
    saveSnapshot();
    const actualSelectedNotes = notes.filter(note => selectedNoteIds.includes(note.id));

    if (actualSelectedNotes.length === 0) {
        alert("選取的筆記已不存在或無法找到。請重新選取。");
        setSelectedNoteIds([]); 
        return;
    }

    const unlockedNotesInSelection = actualSelectedNotes.filter(note => !note.isLocked);
    const lockedNotesInSelectionCount = actualSelectedNotes.length - unlockedNotesInSelection.length;

    if (unlockedNotesInSelection.length === 0) {
      // If actualSelectedNotes was not empty, then all of them must be locked.
      // Guard 2 (actualSelectedNotes.length === 0) ensures actualSelectedNotes is not empty if we reach here,
      // unless it was empty and this code path had a flaw. Assuming Guard 2 is effective:
      // actualSelectedNotes is non-empty, and all items in it are locked.
      // Thus, lockedNotesInSelectionCount will be > 0.
      if (lockedNotesInSelectionCount > 0) {
        alert(`所有 ${lockedNotesInSelectionCount} 個選取的筆記均已上鎖，無法刪除。`);
      }
      // The 'else' branch here is logically unreachable if:
      // 1. Guard 2 ensures actualSelectedNotes is non-empty if this point is reached with selectedNoteIds having valid IDs.
      // 2. Notes always have a boolean isLocked status.
      // If unlockedNotesInSelection is empty AND actualSelectedNotes was non-empty,
      // then all notes in actualSelectedNotes must be locked, making lockedNotesInSelectionCount > 0.
      setSelectedNoteIds([]);
      return;
    }

    if (requireDeleteConfirmation) {
      if (!window.confirm(`確定要刪除 ${unlockedNotesInSelection.length} 個選取的未上鎖筆記嗎？`)) {
        alert("刪除操作已取消。" + (lockedNotesInSelectionCount > 0 ? ` ${lockedNotesInSelectionCount} 個筆記因已上鎖而未被處理。` : ''));
        return; 
      }
    }

    const idsOfUnlockedNotesToDelete = new Set(unlockedNotesInSelection.map(note => note.id));
    setNotes(prevNotes => prevNotes.filter(note => !idsOfUnlockedNotesToDelete.has(note.id)));

    let feedbackMessage = `${unlockedNotesInSelection.length} 個筆記已成功刪除。`;
    if (lockedNotesInSelectionCount > 0) {
      feedbackMessage += ` ${lockedNotesInSelectionCount} 個選取的筆記因已上鎖而未被刪除。`;
    }
    alert(feedbackMessage);

    setSelectedNoteIds([]);
  };

  const executeToggleLockSelectedNotes = () => {
    if (selectedNoteIds.length === 0) return;
    
    const notesToToggleExecute = notes.filter(note => selectedNoteIds.includes(note.id));
    if (notesToToggleExecute.length === 0) {
        alert("選取的筆記已不存在或無法找到。請重新選取。");
        setSelectedNoteIds([]);
        return;
    }

    const shouldLockExecute = notesToToggleExecute.some(note => !note.isLocked);

    setNotes(prevNotes =>
        prevNotes.map(note =>
            selectedNoteIds.includes(note.id)
                ? { ...note, isLocked: shouldLockExecute, updatedAt: new Date() }
                : note
        )
    );
    alert(shouldLockExecute ? `${notesToToggleExecute.length} 個選取的筆記已上鎖。` : `${notesToToggleExecute.length} 個選取的筆記已解鎖。`);
    setSelectedNoteIds([]);
  };

  const handleToggleLockSelectedNotes = () => {
    if (selectedNoteIds.length === 0) {
        alert("請先選取要上鎖/解鎖的筆記。");
        return;
    }
    const notesUserWantsToProcess = notes.filter(note => selectedNoteIds.includes(note.id));
    if (notesUserWantsToProcess.length === 0) {
        alert("選取的筆記已不存在或無法找到。請重新選取。");
        setSelectedNoteIds([]); 
        return;
    }
 
    const intentIsToLock = notesUserWantsToProcess.some(note => !note.isLocked);

    if (intentIsToLock && !globalLockPassword) {
        alert("請先在「設定」中設定全域筆記鎖密碼才能上鎖筆記。");
        openSettingsModal();
        return;
    }
    
    if (globalLockPassword) { 
        setPasswordActionType('toggleLockSelected');
        setShowPasswordPrompt(true);
    } else {
        executeToggleLockSelectedNotes();
    }
  };

  const isSelectAllChecked = React.useMemo(() => {
    if (notes.length === 0) return false;
    return notes.every(note => selectedNoteIds.includes(note.id));
  }, [notes, selectedNoteIds]);

  const saveSnapshot = React.useCallback(() => {
    localStorage.setItem('web-notes-pro-snapshot', JSON.stringify(notes));
  }, [notes]);

  const restoreSnapshot = () => {
    const snapshot = localStorage.getItem('web-notes-pro-snapshot');
    if (snapshot) {
      try {
        const parsedNotes: Note[] = JSON.parse(snapshot).map((note: any) => ({
          ...note,
          createdAt: new Date(note.createdAt),
          updatedAt: note.updatedAt ? new Date(note.updatedAt) : undefined,
          tags: Array.isArray(note.tags) ? note.tags : [],
          isLocked: note.isLocked || false,
          isHidden: note.isHidden || false, 
        }));
        setNotes(parsedNotes);
        alert('已恢復到上一次快照！');
      } catch {
        alert('恢復失敗，快照資料損壞。');
      }
    } else {
      alert('沒有可恢復的快照。');
    }
  };

  const getFirstFileUrl = (text: string): string | null => {
    const urlRegex = /(https?:\/\/[^\s]+?\.(pdf|docx?|xlsx?|pptx?|jpg|jpeg|png|gif))/i;
    const match = text.match(urlRegex);
    return match ? match[1] : null;
  };

  return (
    <>
      <h1>小筆記 Pro</h1>

      <div className="app-controls">
        <div className="app-controls-row">
          <div className="control-group">
            <label htmlFor="theme-select">主題:</label>
            <select id="theme-select" value={theme} onChange={handleThemeChange} aria-label="選擇佈景主題">
              <option value="light">明亮</option>
              <option value="dark">暗黑</option>
              <option value="sepia">復古</option>
              <option value="gray">灰色</option>
              <option value="green">綠色</option>
            </select>
          </div>
          <div className="control-group">
             <label htmlFor="sort-order-select">排序:</label>
             <select id="sort-order-select" value={sortOrder} onChange={e => setSortOrder(e.target.value as SortOrder)} aria-label="選擇筆記排序方式">
                <option value="createdAt-desc">建立日期 (新→舊)</option>
                <option value="createdAt-asc">建立日期 (舊→新)</option>
                <option value="updatedAt-desc">修改日期 (新→舊)</option>
                <option value="updatedAt-asc">修改日期 (舊→新)</option>
                <option value="text-asc">內容 (A→Z)</option>
                <option value="text-desc">內容 (Z→A)</option>
             </select>
          </div>
          <div className="control-group">
            <button onClick={openSettingsModal} className="control-button" aria-label="開啟設定">設定</button>
            <button onClick={() => alert('個人資料功能待開發！')} className="control-button" aria-label="檢視個人資料">個人資料</button>
          </div>
        </div>
         <div className="app-controls-row">
             <div className="control-group selection-controls">
                <input 
                    type="checkbox" 
                    id="select-all-notes"
                    checked={isSelectAllChecked}
                    onChange={handleToggleSelectAll}
                    disabled={filteredAndSortedNotes.length === 0}
                    aria-label="全選所有/取消全選所有目前列表中的筆記"
                />
                <label htmlFor="select-all-notes">全選所有/取消全選所有</label>
            </div>
            <button 
                onClick={handleToggleHideSelectedNotes} 
                className="control-button" 
                disabled={selectedNoteIds.length === 0}
                aria-label="切換選取筆記的隱藏狀態"
            >
                切換隱藏
            </button>
            <button 
                onClick={handleToggleLockSelectedNotes} 
                className="control-button" 
                disabled={selectedNoteIds.length === 0}
                aria-label="上鎖或解鎖選取的筆記"
            >
                上鎖/解鎖選取
            </button>
            <button 
                onClick={handleDeleteSelectedNotes} 
                className="control-button" 
                disabled={selectedNoteIds.length === 0}
                aria-label="刪除選取的筆記"
            >
                刪除選取
            </button>
        </div>
        <div className="app-controls-row">
            <input 
                type="search" 
                className="search-input"
                placeholder="搜尋筆記 (內容或標籤)..." 
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                aria-label="搜尋筆記"
            />
        </div>
        <div className="app-controls-row">
            <div className="control-group">
                <label htmlFor="import-notes-input" className="file-input-label control-button">匯入資料</label>
                <input type="file" id="import-notes-input" accept=".json" onChange={handleImportNotes} aria-label="選擇要匯入的筆記檔案"/>
                <button onClick={handleExportNotes} className="control-button" aria-label="匯出目前所有筆記">匯出資料</button>
            </div>
        </div>
        <div className="app-controls-row">
            <button onClick={restoreSnapshot} className="control-button" aria-label="恢復快照">恢復快照</button>
        </div>
      </div>

        <div className="note-input-section">
          <form onSubmit={handleAddNote} className="note-form" aria-labelledby="add-note-heading">
            <h2 id="add-note-heading" className="sr-only">新增筆記</h2>
            <textarea
              className="note-textarea"
              value={currentNoteText}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCurrentNoteText(e.target.value)}
              placeholder="在這裡輸入您的筆記..."
              aria-label="筆記內容"
              rows={4}
            />
            <input
              type="text"
              className="note-tags-input"
              value={currentTagsInput}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentTagsInput(e.target.value)}
              placeholder="標籤 (用逗號分隔, 例如: 工作, 個人)"
              aria-label="筆記標籤，用逗號分隔"
            />
            <button type="submit" className="add-note-button" aria-label="新增此筆記">新增筆記</button>
          </form>
        </div>

      {filteredAndSortedNotes.length > 0 ? (
        <ul className="notes-list" aria-label="筆記列表">
          {filteredAndSortedNotes.map(note => (
            <li key={note.id} className={`note-item ${editingNoteId === note.id ? 'editing' : ''} ${note.isLocked ? 'locked-note-item' : ''} ${note.isHidden ? 'is-hidden' : ''}`} aria-labelledby={`note-content-${note.id}`}>
             <div className="note-selection-area">
                <input 
                    type="checkbox" 
                    id={`select-note-${note.id}`} 
                    checked={selectedNoteIds.includes(note.id)} 
                    onChange={() => handleSelectNote(note.id)}
                    aria-label={`選取筆記: ${note.text.substring(0,30)}...`}
                />
                <label htmlFor={`select-note-${note.id}`} className="sr-only">選取此筆記</label>
              </div>
              <div className="note-item-content-wrapper">
              {editingNoteId === note.id ? (
                <div className="note-edit-form">
                  <textarea
                    className="note-edit-textarea"
                    value={editingNoteText}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditingNoteText(e.target.value)}
                    aria-label={`編輯筆記內容`}
                    rows={5} autoFocus
                  />
                  <input
                    type="text"
                    className="note-tags-input"
                    value={editingTagsInput}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingTagsInput(e.target.value)}
                    placeholder="標籤 (用逗號分隔)" aria-label="編輯筆記標籤"
                  />
                  <div className="note-item-actions">
                    <button onClick={() => handleUpdateNote(note.id)} className="note-button update-button" aria-label="更新此筆記">更新</button>
                    <button onClick={handleCancelEdit} className="note-button cancel-button" aria-label="取消編輯">取消</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="note-header">
                    <div className="note-timestamps">
                       <span>建立: {formatDate(note.createdAt)}</span>
                       {note.updatedAt && (note.updatedAt.getTime() !== note.createdAt.getTime()) && <span>更新: {formatDate(note.updatedAt)}</span>}
                    </div>
                    <div className="note-status-icons">
                        {note.isHidden && <span className="note-hidden-label">(已隱藏)</span>}
                        {note.isLocked && <span className="note-lock-icon" title="此筆記已上鎖"><LockIcon /></span>}
                    </div>
                  </div>
                  <div className="note-main-content">
                    <p id={`note-content-${note.id}`} className="note-content">{note.text}</p>
                  </div>
                  {note.tags.length > 0 && (
                    <div className="note-tags-container" aria-label="標籤">
                      {note.tags.map(tag => (
                        <span key={tag.name} className="tag-item" style={{ backgroundColor: tag.color, color: isColorLight(tag.color) ? '#333': '#fff' }}>
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="note-item-actions">
                    <button onClick={() => handleStartEdit(note)} className="note-button edit-button" aria-label={`編輯筆記: ${note.text.substring(0, 20)}...`} disabled={note.isLocked || note.isHidden}>編輯</button>
                    <button onClick={() => toggleLockNote(note)} className={`note-button lock-button ${note.isLocked ? 'locked' : ''}`} aria-label={note.isLocked ? `解鎖筆記: ${note.text.substring(0,20)}...` : `上鎖筆記: ${note.text.substring(0,20)}...`}>
                      {note.isLocked ? '解鎖' : '上鎖'}
                    </button>
                    <button onClick={() => handleDeleteNote(note)} className="note-button delete-note-button" aria-label={`刪除筆記: ${note.text.substring(0, 20)}...`}>刪除</button>
                    {getFirstFileUrl(note.text) && (
                      <button
                        className="note-button preview-button"
                        onClick={() => setPreviewUrl(getFirstFileUrl(note.text)!)}
                        aria-label="預覽檔案"
                      >
                        預覽檔案
                      </button>
                    )}
                  </div>
                </>
              )}
              </div> {/* End of note-item-content-wrapper */}
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-notes-message">{searchTerm ? '沒有符合搜尋條件的筆記。' : '還沒有筆記。新增一些吧！'}</p>
      )}

      {isSettingsModalOpen && (
        <div className="modal-overlay" onClick={closeSettingsModal} role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 id="settings-modal-title">應用程式設定</h2>
              <button onClick={closeSettingsModal} className="modal-close-button" aria-label="關閉設定">&times;</button>
            </div>
            
            <div className="modal-section">
              <h3>筆記鎖密碼</h3>
              <p className="modal-info-text">注意：此密碼儲存在您的瀏覽器中，主要用於防止意外刪除，而非高度安全防護。</p>
              <div className="modal-input-group">
                <label htmlFor="settings-password">新密碼 (至少4字元，留空則移除密碼):</label>
                <input type="password" id="settings-password" value={settingsPasswordInput} onChange={e => setSettingsPasswordInput(e.target.value)} className="modal-input" placeholder="輸入新密碼"/>
              </div>
              <div className="modal-input-group">
                <label htmlFor="settings-confirm-password">確認新密碼:</label>
                <input type="password" id="settings-confirm-password" value={settingsConfirmPasswordInput} onChange={e => setSettingsConfirmPasswordInput(e.target.value)} className="modal-input" placeholder="再次輸入新密碼"/>
              </div>
              <button onClick={handleSetGlobalPassword} className="modal-button primary">儲存密碼設定</button>
              {globalLockPassword && <p className="modal-feedback-text">目前已設定密碼。</p>}
            </div>

            <div className="modal-section">
              <h3>刪除設定</h3>
              <div className="modal-checkbox-group">
                <input type="checkbox" id="require-delete-confirm" checked={requireDeleteConfirmation} onChange={e => setRequireDeleteConfirmation(e.target.checked)} />
                <label htmlFor="require-delete-confirm">刪除筆記前要求確認</label>
              </div>
            </div>

            <div className="modal-section">
                <h3>標籤管理</h3>
                {Array.from(allTags.entries()).length === 0 ? <p className="modal-info-text">目前沒有任何標籤。</p> : (
                    <ul className="tag-management-list">
                        {Array.from(allTags.entries()).map(([name, color]) => (
                            <li key={name} className={`tag-management-item ${selectedTagForManagement === name ? 'selected' : ''}`}>
                                <span 
                                    className="tag-item" 
                                    style={{ backgroundColor: color, color: isColorLight(color) ? '#333': '#fff', cursor: 'pointer' }}
                                    onClick={() => { setSelectedTagForManagement(name); setTagManagementNameInput(name); }}
                                    title="點選以編輯此標籤"
                                >
                                    {name}
                                </span>
                                {selectedTagForManagement === name && (
                                    <div className="tag-management-actions">
                                        <input 
                                            type="text" 
                                            value={tagManagementNameInput} 
                                            onChange={e => setTagManagementNameInput(e.target.value)}
                                            className="modal-input small"
                                            placeholder="新標籤名稱"
                                        />
                                        <button onClick={handleRenameTag} className="modal-button small">重命名</button>
                                        <div className="tag-color-palette">
                                            {PREDEFINED_TAG_COLORS.map(c => (
                                                <button 
                                                    key={c} 
                                                    className="color-swatch" 
                                                    style={{ backgroundColor: c }} 
                                                    onClick={() => handleChangeTagColor(c)}
                                                    title={`變更為 ${c}`}
                                                    aria-label={`變更標籤顏色為 ${c}`}
                                                />
                                            ))}
                                        </div>
                                        <button onClick={() => handleDeleteTag(name)} className="modal-button small danger">刪除標籤</button>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="modal-section danger-zone">
                <h3>危險區域</h3>
                <div className="modal-input-group">
                    <label htmlFor="clear-all-data-confirm">清除所有資料</label>
                    <p className="modal-warning">此操作將永久刪除所有筆記、標籤和應用程式設定！</p>
                    <p className="modal-info-text">若要確認，請在下方輸入 "{CONFIRM_CLEAR_ALL_TEXT}"：</p>
                    <input 
                        type="text" 
                        id="clear-all-data-confirm" 
                        className="modal-input"
                        value={clearAllDataConfirmationInput}
                        onChange={e => setClearAllDataConfirmationInput(e.target.value)}
                        placeholder={`輸入 ${CONFIRM_CLEAR_ALL_TEXT}`}
                    />
                </div>
                <button 
                    onClick={handleClearAllData} 
                    className="modal-button danger"
                    disabled={clearAllDataConfirmationInput.toUpperCase() !== CONFIRM_CLEAR_ALL_TEXT}
                >
                    確認清除所有資料
                </button>
            </div>
            
            <div className="modal-actions">
              <button onClick={closeSettingsModal} className="modal-button secondary">關閉</button>
            </div>
          </div>
        </div>
      )}

      {showPasswordPrompt && (
        <div className="modal-overlay" onClick={closePasswordPrompt} role="dialog" aria-modal="true" aria-labelledby="password-prompt-title">
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 id="password-prompt-title">需要密碼</h2>
              <button onClick={closePasswordPrompt} className="modal-close-button" aria-label="關閉密碼輸入">&times;</button>
            </div>
            <p>此操作需要您的全域筆記鎖密碼。</p>
            <div className="modal-input-group">
              <label htmlFor="password-prompt-input">密碼:</label>
              <input 
                type="password" 
                id="password-prompt-input" 
                className="modal-input" 
                value={passwordPromptInput} 
                onChange={e => setPasswordPromptInput(e.target.value)}
                autoFocus 
              />
            </div>
            <div className="modal-actions">
              <button onClick={handlePasswordPromptSubmit} className="modal-button primary">確認</button>
              <button onClick={closePasswordPrompt} className="modal-button secondary">取消</button>
            </div>
          </div>
        </div>
      )}

      {previewUrl && (
        <div className="modal-overlay" onClick={() => setPreviewUrl(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>檔案預覽</h2>
              <button onClick={() => setPreviewUrl(null)} className="modal-close-button">&times;</button>
            </div>
            <div style={{height: '70vh'}}>
              {previewUrl.match(/\.(pdf)$/i) ? (
                <iframe src={previewUrl} width="100%" height="100%" title="PDF預覽" />
              ) : (
                <iframe
                  src={`https://docs.google.com/gview?url=${encodeURIComponent(previewUrl)}&embedded=true`}
                  width="100%" height="100%" title="文件預覽"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default App;
