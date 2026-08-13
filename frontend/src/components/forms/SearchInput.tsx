//frontend/src/components/forms/SearchInput.tsx
import { useState, useEffect, useRef, forwardRef } from "react";
import { Search, X } from "lucide-react";
import { Input } from "#/components/ui/input";
import { Button } from "#/components/ui/button";
import { cn } from "#/lib/utils";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  debounceMs?: number;
  ariaLabel?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onChange, placeholder = "Suchen...", className, debounceMs = 300, ariaLabel = "Suche" }, ref) => {
    const [localValue, setLocalValue] = useState(value);
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

    useEffect(() => {
      setLocalValue(value);
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setLocalValue(newValue);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        onChange(newValue);
      }, debounceMs);
    };

    const handleClear = () => {
      setLocalValue("");
      onChange("");
      if (typeof ref === "object" && ref?.current) {
        ref.current.focus();
      }
    };

    useEffect(() => {
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, []);

    return (
      <div className={cn("relative flex items-center", className)}>
        <Search
          className="absolute left-3 h-4 w-4 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          ref={ref}
          type="text"
          value={localValue}
          onChange={handleChange}
          placeholder={placeholder}
          className="pl-9 pr-9"
          aria-label={ariaLabel}
        />
        {localValue && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 h-6 w-6"
            onClick={handleClear}
            aria-label="Suche löschen"
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </Button>
        )}
      </div>
    );
  }
);

SearchInput.displayName = "SearchInput";

