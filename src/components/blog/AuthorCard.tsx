import React from "react";
import { User } from "lucide-react";

/**
 * Properties configuring the AuthorCard profile component.
 */
export interface AuthorCardProps {
  /** Author identity attributes including display name, avatar, and biography. */
  author: {
    displayName: string;
    avatarUrl?: string | null;
    bio?: string | null;
  };
  /** Optional aggregate post and taxonomy count metrics. */
  stats?: {
    postsCount: number;
    categoriesCount: number;
    tagsCount: number;
  };
}

/**
 * Author profile card component featuring circular avatar image, biography description, and publication metrics.
 *
 * @param props - AuthorCardProps configuring author information and metrics.
 * @returns React JSX author card element.
 */
export function AuthorCard({ author, stats }: AuthorCardProps) {
  return (
    <div className="card-clean p-6 space-y-4">
      <div className="flex items-center gap-4">
        {author.avatarUrl ? (
          <img
            src={author.avatarUrl}
            alt={author.displayName}
            className="w-14 h-14 rounded-full object-cover ring-2 ring-border"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold ring-2 ring-border">
            {author.displayName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <h3 className="text-base font-bold text-text truncate">{author.displayName}</h3>
          <p className="text-sm text-text-muted line-clamp-2 leading-relaxed">
            {author.bio || "Escritor y creador de contenido."}
          </p>
        </div>
      </div>

      {stats && (
        <div className="flex items-center justify-around pt-4 border-t border-border text-center">
          <div>
            <span className="block text-lg font-bold text-text">{stats.postsCount}</span>
            <span className="text-xs text-text-muted">Artículos</span>
          </div>
          <div className="w-px h-8 bg-border" />
          <div>
            <span className="block text-lg font-bold text-text">{stats.categoriesCount}</span>
            <span className="text-xs text-text-muted">Categorías</span>
          </div>
          <div className="w-px h-8 bg-border" />
          <div>
            <span className="block text-lg font-bold text-text">{stats.tagsCount}</span>
            <span className="text-xs text-text-muted">Etiquetas</span>
          </div>
        </div>
      )}
    </div>
  );
}
