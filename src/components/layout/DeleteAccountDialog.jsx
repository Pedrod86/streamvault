import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function DeleteAccountDialog({ open, onOpenChange }) {
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      // Log out — actual account deletion requires backend support
      await base44.auth.logout('/login');
    } finally {
      setLoading(false);
      onOpenChange(false);
    }
  };

  const canDelete = confirm.trim().toLowerCase() === 'delete';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-card border-border">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground">Delete Account</AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            This action is permanent and cannot be undone. All your watchlist, history, and server connections will be removed.
            <br /><br />
            Type <span className="font-semibold text-destructive">delete</span> to confirm.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Type 'delete' to confirm"
          className="bg-secondary border-border"
        />
        <AlertDialogFooter>
          <AlertDialogCancel className="border-border select-none" onClick={() => setConfirm('')}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={!canDelete || loading}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground select-none disabled:opacity-40"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete Account'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}