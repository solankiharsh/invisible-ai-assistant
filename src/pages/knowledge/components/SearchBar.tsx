import { useState } from "react";
import { SearchIcon } from "lucide-react";
import { Input, Button } from "@/components";

export const SearchBar = ({
  onSearch,
  placeholder = "Search by meaning or keywords...",
  loading = false,
}: {
  onSearch: (query: string) => void;
  placeholder?: string;
  loading?: boolean;
}) => {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q) onSearch(q);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-xl">
      <div className="relative flex-1">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="pl-9"
          disabled={loading}
        />
      </div>
      <Button type="submit" disabled={loading || !query.trim()}>
        {loading ? "Searching…" : "Search"}
      </Button>
    </form>
  );
};
