import React, { useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Trash2, AlertTriangle } from 'lucide-react';

interface ConfirmDeleteProps {
  title: string;
  description: string;
  onConfirm: () => void;
  disabled?: boolean;
  destructive?: boolean;
  children?: React.ReactNode;
}

export const ConfirmDelete: React.FC<ConfirmDeleteProps> = ({
  title,
  description,
  onConfirm,
  disabled = false,
  destructive = true,
  children
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleConfirm = () => {
    onConfirm();
    setIsOpen(false);
  };

  return (
    <>
      {children ? (
        <div onClick={() => !disabled && setIsOpen(true)}>
          {children}
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(true)}
          disabled={disabled}
          className={destructive ? "text-destructive hover:text-destructive" : ""}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      )}

      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <AlertTriangle className="h-4 w-4 mr-2 text-destructive" />
              {title}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};