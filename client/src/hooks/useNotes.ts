import { useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';

interface Tag {
  name: string;
  color: string;
}

interface ApiNote {
  id: number;
  text: string;
  tags: Tag[];
  createdAt: string;
  updatedAt: string;
  isLocked: boolean;
  isHidden: boolean;
  isPinned: boolean;
  color: string;
}

export interface Note {
  id: string;
  text: string;
  tags: Tag[];
  createdAt: Date;
  updatedAt: Date;
  isLocked: boolean;
  isHidden: boolean;
  isPinned: boolean;
  color: string;
}

export interface NotesData {
  notes: Note[];
  allTags: Array<{ name: string; color: string }>;
  globalPassword?: string;
  settings?: {
    requireDeleteConfirmation: boolean;
    theme: string;
    sortOrder: string;
  };
}

export interface CloudBackup {
  id: number;
  createdAt: Date;
  noteCount: number;
}

const toNote = (n: ApiNote): Note => ({
  id: n.id.toString(),
  text: n.text,
  tags: n.tags ?? [],
  createdAt: new Date(n.createdAt),
  updatedAt: new Date(n.updatedAt),
  isLocked: n.isLocked,
  isHidden: n.isHidden,
  isPinned: n.isPinned,
  color: n.color ?? '',
});

const NOTES_KEY = ['/api/notes'];
const BACKUPS_KEY = ['/api/backups'];

export function useNotes() {
  const { data: rawNotes = [] } = useQuery<ApiNote[]>({
    queryKey: NOTES_KEY,
  });
  const { data: rawBackups = [] } = useQuery<Array<{
    id: number;
    createdAt: string;
    noteCount: number;
  }>>({
    queryKey: BACKUPS_KEY,
  });

  const notes: Note[] = rawNotes.map(toNote);
  const cloudBackups: CloudBackup[] = rawBackups.map((backup) => ({
    ...backup,
    createdAt: new Date(backup.createdAt),
  }));

  const addMutation = useMutation({
    mutationFn: async (data: { text: string; tags: Tag[] }) => {
      const res = await apiRequest('POST', '/api/notes', data);
      return res.json() as Promise<ApiNote>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTES_KEY }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, text, tags }: { id: string; text: string; tags: Tag[] }) => {
      const res = await apiRequest('PATCH', `/api/notes/${id}`, { text, tags });
      return res.json() as Promise<ApiNote>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTES_KEY }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/notes/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTES_KEY }),
  });

  const patchMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await apiRequest('PATCH', `/api/notes/${id}`, data);
      return res.json() as Promise<ApiNote>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTES_KEY }),
  });

  const clearMutation = useMutation({
    mutationFn: () => apiRequest('DELETE', '/api/notes'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTES_KEY }),
  });

  const importMutation = useMutation({
    mutationFn: async (importNotes: Note[]) => {
      const payload = importNotes.map(n => ({
        text: n.text,
        tags: n.tags ?? [],
        isLocked: n.isLocked ?? false,
        isHidden: n.isHidden ?? false,
        isPinned: n.isPinned ?? false,
        color: n.color ?? '',
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      }));
      const res = await apiRequest('POST', '/api/notes/import', payload);
      return res.json() as Promise<ApiNote[]>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTES_KEY }),
  });

  const createBackupMutation = useMutation({
    mutationFn: async (data: { notes: Array<{
      text: string;
      tags: Tag[];
      createdAt: string;
      updatedAt: string;
      isLocked: boolean;
      isHidden: boolean;
      isPinned: boolean;
      color: string;
    }> }) => {
      const res = await apiRequest('POST', '/api/backups', data);
      return res.json() as Promise<{ id: number; createdAt: string; noteCount: number }>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BACKUPS_KEY }),
  });

  const restoreBackupMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('POST', `/api/backups/${id}/restore`);
      return res.json() as Promise<ApiNote[]>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTES_KEY }),
  });

  const deleteBackupMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/backups/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BACKUPS_KEY }),
  });

  const addNote = useCallback((text: string, tags: Tag[] = []) => {
    addMutation.mutate({ text, tags });
  }, [addMutation]);

  const updateNote = useCallback((id: string, text: string, tags: Tag[] = []) => {
    updateMutation.mutate({ id, text, tags });
  }, [updateMutation]);

  const deleteNote = useCallback((id: string) => {
    deleteMutation.mutate(id);
  }, [deleteMutation]);

  const toggleLockNote = useCallback((id: string) => {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    patchMutation.mutate({ id, data: { isLocked: !note.isLocked } });
  }, [notes, patchMutation]);

  const toggleHideNote = useCallback((id: string) => {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    patchMutation.mutate({ id, data: { isHidden: !note.isHidden } });
  }, [notes, patchMutation]);

  const togglePinNote = useCallback((id: string) => {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    patchMutation.mutate({ id, data: { isPinned: !note.isPinned } });
  }, [notes, patchMutation]);

  const duplicateNote = useCallback((id: string) => {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    addMutation.mutate({ text: note.text, tags: note.tags });
  }, [notes, addMutation]);

  const updateNoteColor = useCallback((id: string, color: string) => {
    patchMutation.mutate({ id, data: { color } });
  }, [patchMutation]);

  const exportData = useCallback((): NotesData => {
    const allTagsMap = new Map<string, string>();
    notes.forEach(note => note.tags.forEach(tag => allTagsMap.set(tag.name, tag.color)));
    return {
      notes,
      allTags: Array.from(allTagsMap, ([name, color]) => ({ name, color })),
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
      importMutation.mutate(data.notes);
    }
    if (data.globalPassword) {
      localStorage.setItem('notes-global-password', data.globalPassword);
    }
    if (data.settings) {
      localStorage.setItem('notes-delete-confirmation', JSON.stringify(data.settings.requireDeleteConfirmation));
      localStorage.setItem('notes-theme', data.settings.theme);
      localStorage.setItem('notes-sort-order', data.settings.sortOrder);
    }
  }, [importMutation]);

  const clearAllData = useCallback(() => {
    clearMutation.mutate();
    localStorage.removeItem('notes-global-password');
    localStorage.removeItem('notes-delete-confirmation');
    localStorage.removeItem('notes-theme');
    localStorage.removeItem('notes-sort-order');
    localStorage.removeItem('notes-all-tags');
    localStorage.removeItem('notes-app-notes');
  }, [clearMutation]);

  const createCloudBackup = useCallback(async () => {
    return createBackupMutation.mutateAsync({
      notes: notes.map((note) => ({
        text: note.text,
        tags: note.tags,
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
        isLocked: note.isLocked,
        isHidden: note.isHidden,
        isPinned: note.isPinned,
        color: note.color,
      })),
    });
  }, [createBackupMutation, notes]);

  const restoreCloudBackup = useCallback(async (id: number) => {
    return restoreBackupMutation.mutateAsync(id);
  }, [restoreBackupMutation]);

  const deleteCloudBackup = useCallback(async (id: number) => {
    return deleteBackupMutation.mutateAsync(id);
  }, [deleteBackupMutation]);

  return {
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
    deleteCloudBackup,
  };
}
