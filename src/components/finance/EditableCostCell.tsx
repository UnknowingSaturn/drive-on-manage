import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check, X, Edit } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EditableCostCellProps {
  value: number | string;
  onSave: (newValue: string | number) => void;
  type?: 'number' | 'text' | 'date';
  isLoading?: boolean;
  className?: string;
  formatValue?: (value: any) => string;
  step?: string;
  min?: string;
  placeholder?: string;
}

export const EditableCostCell: React.FC<EditableCostCellProps> = ({
  value,
  onSave,
  type = 'text',
  isLoading = false,
  className,
  formatValue,
  step,
  min,
  placeholder
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value.toString());

  useEffect(() => {
    setEditValue(value.toString());
  }, [value]);

  const handleSave = () => {
    if (editValue !== value.toString()) {
      onSave(type === 'number' ? parseFloat(editValue) || 0 : editValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value.toString());
    setIsEditing(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const displayValue = formatValue ? formatValue(value) : value.toString();

  if (isEditing) {
    return (
      <div className="flex items-center space-x-1">
        <Input
          type={type}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyPress}
          onBlur={handleSave}
          autoFocus
          step={step}
          min={min}
          placeholder={placeholder}
          className="h-8 text-sm"
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={handleSave}
          disabled={isLoading}
          className="h-8 w-8 p-0"
        >
          <Check className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCancel}
          disabled={isLoading}
          className="h-8 w-8 p-0"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "flex items-center justify-between group cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1",
        className
      )}
      onClick={() => setIsEditing(true)}
    >
      <span>{displayValue}</span>
      <Edit className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
};