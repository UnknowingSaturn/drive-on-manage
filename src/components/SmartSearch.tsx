import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { debounce } from '@/lib/security';

interface SmartSearchProps {
  data: any[];
  searchFields: string[];
  onFilter: (filteredData: any[]) => void;
  placeholder?: string;
  filterOptions?: {
    label: string;
    field: string;
    options: { value: string; label: string }[];
  }[];
}

export const SmartSearch: React.FC<SmartSearchProps> = ({
  data,
  searchFields,
  onFilter,
  placeholder = "Search...",
  filterOptions = []
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});

  // Debounced search function
  const debouncedSearch = useMemo(
    () => debounce((term: string, filters: Record<string, string>) => {
      let filtered = data;

      // Apply text search
      if (term.trim()) {
        const searchLower = term.toLowerCase();
        filtered = filtered.filter(item => 
          searchFields.some(field => {
            const value = getNestedValue(item, field);
            return value?.toString().toLowerCase().includes(searchLower);
          })
        );
      }

      // Apply filters
      Object.entries(filters).forEach(([field, value]) => {
        if (value) {
          filtered = filtered.filter(item => {
            const itemValue = getNestedValue(item, field);
            return itemValue === value;
          });
        }
      });

      onFilter(filtered);
    }, 300),
    [data, searchFields, onFilter]
  );

  // Helper to get nested object values
  const getNestedValue = (obj: any, path: string) => {
    return path.split('.').reduce((curr, prop) => curr?.[prop], obj);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    debouncedSearch(value, activeFilters);
  };

  const handleFilterChange = (field: string, value: string) => {
    const newFilters = { ...activeFilters, [field]: value };
    setActiveFilters(newFilters);
    debouncedSearch(searchTerm, newFilters);
  };

  const clearFilter = (field: string) => {
    const newFilters = { ...activeFilters };
    delete newFilters[field];
    setActiveFilters(newFilters);
    debouncedSearch(searchTerm, newFilters);
  };

  const clearAll = () => {
    setSearchTerm('');
    setActiveFilters({});
    onFilter(data);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={placeholder}
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {filterOptions.map((option) => (
          <Select
            key={option.field}
            value={activeFilters[option.field] || ''}
            onValueChange={(value) => handleFilterChange(option.field, value)}
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder={option.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All {option.label}</SelectItem>
              {option.options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}

        {(searchTerm || Object.keys(activeFilters).length > 0) && (
          <Button variant="outline" onClick={clearAll}>
            <X className="h-4 w-4 mr-2" />
            Clear
          </Button>
        )}
      </div>

      {/* Active filters */}
      {Object.entries(activeFilters).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(activeFilters).map(([field, value]) => {
            const option = filterOptions.find(opt => opt.field === field);
            const optionLabel = option?.options.find(opt => opt.value === value)?.label || value;
            return (
              <Badge key={field} variant="secondary" className="flex items-center gap-1">
                {option?.label}: {optionLabel}
                <X 
                  className="h-3 w-3 cursor-pointer hover:text-destructive" 
                  onClick={() => clearFilter(field)}
                />
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
};