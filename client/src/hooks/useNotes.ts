import { useState, useEffect, useCallback } from 'react';

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

interface NotesData {
  notes: Note[];
  allTags: Map<string, string>;
  globalPassword?: string;
  settings?: {
    requireDeleteConfirmation: boolean;
    theme: string;
    sortOrder: string;
  };
}

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);

  // Load notes from localStorage on mount
  useEffect(() => {
    const storedNotes = localStorage.getItem('notes-app-notes');
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
      } catch (error) {
        console.error('Failed to parse notes:', error);
        setNotes([]);
      }
    }
  }, []);

  // Save notes to localStorage whenever notes change
  useEffect(() => {
    localStorage.setItem('notes-app-notes', JSON.stringify(notes));
  }, [notes]);

  const addNote = useCallback((text: string, tags: Tag[] = []) => {
    const newNote: Note = {
      id: Date.now().toString(),
      text,
      tags,
      createdAt: new Date(),
      updatedAt: new Date(),
      isLocked: false,
      isHidden: false,
    };
    setNotes(prevNotes => [newNote, ...prevNotes]);
  }, []);

  const updateNote = useCallback((id: string, text: string, tags: Tag[] = []) => {
    setNotes(prevNotes =>
      prevNotes.map(note =>
        note.id === id
          ? { ...note, text, tags, updatedAt: new Date() }
          : note
      )
    );
  }, []);

  const deleteNote = useCallback((id: string) => {
    setNotes(prevNotes => prevNotes.filter(note => note.id !== id));
  }, []);

  const toggleLockNote = useCallback((id: string) => {
    setNotes(prevNotes =>
      prevNotes.map(note =>
        note.id === id
          ? { ...note, isLocked: !note.isLocked, updatedAt: new Date() }
          : note
      )
    );
  }, []);

  const toggleHideNote = useCallback((id: string) => {
    setNotes(prevNotes =>
      prevNotes.map(note =>
        note.id === id
          ? { ...note, isHidden: !note.isHidden, updatedAt: new Date() }
          : note
      )
    );
  }, []);

  const exportData = useCallback((): NotesData => {
    const allTagsData = localStorage.getItem('notes-all-tags');
    const allTags = allTagsData ? new Map(JSON.parse(allTagsData)) : new Map();
    
    return {
      notes,
      allTags,
      globalPassword: localStorage.getItem('notes-global-password') || undefined,
      settings: {
        requireDeleteConfirmation: JSON.parse(localStorage.getItem('notes-delete-confirmation') || 'true'),
        theme: localStorage.getItem('notes-theme') || 'light',
        sortOrder: localStorage.getItem('notes-sort-order') || 'createdAt-desc',
      },
    };
  }, [notes]);

  const importData = useCallback((data: NotesData) => {
    if (data.notes && Array.isArray(data.notes)) {
      const importedNotes = data.notes.map(note => ({
        ...note,
        createdAt: new Date(note.createdAt),
        updatedAt: note.updatedAt ? new Date(note.updatedAt) : undefined,
        tags: Array.isArray(note.tags) ? note.tags : [],
        isLocked: note.isLocked || false,
        isHidden: note.isHidden || false,
      }));
      setNotes(importedNotes);
    }

    if (data.allTags) {
      localStorage.setItem('notes-all-tags', JSON.stringify(Array.from(data.allTags.entries())));
    }

    if (data.globalPassword) {
      localStorage.setItem('notes-global-password', data.globalPassword);
    }

    if (data.settings) {
      localStorage.setItem('notes-delete-confirmation', JSON.stringify(data.settings.requireDeleteConfirmation));
      localStorage.setItem('notes-theme', data.settings.theme);
      localStorage.setItem('notes-sort-order', data.settings.sortOrder);
    }
  }, []);

  const clearAllData = useCallback(() => {
    setNotes([]);
    localStorage.removeItem('notes-app-notes');
    localStorage.removeItem('notes-all-tags');
    localStorage.removeItem('notes-global-password');
    localStorage.removeItem('notes-delete-confirmation');
    localStorage.removeItem('notes-theme');
    localStorage.removeItem('notes-sort-order');
  }, []);

  return {
    notes,
    addNote,
    updateNote,
    deleteNote,
    toggleLockNote,
    toggleHideNote,
    exportData,
    importData,
    clearAllData,
  };
}
