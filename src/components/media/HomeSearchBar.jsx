import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

export default function HomeSearchBar() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form onSubmit={handleSubmit} className="px-4 sm:px-6 pt-4">
      <div className="relative max-w-2xl mx-auto">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search movies & shows across your servers..."
          className="pl-12 h-12 bg-secondary border-border text-foreground text-base rounded-xl"
        />
      </div>
    </form>
  );
}