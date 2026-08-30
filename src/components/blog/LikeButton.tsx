"use client";

import React, { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

/**
 * Properties configuring the LikeButton reaction component.
 */
export interface LikeButtonProps {
  /** Target post database ID. */
  postId: string;
  /** Initial numerical likes count. */
  initialLikes?: number;
  /** Sizing tier. */
  size?: "sm" | "md";
}

/**
 * Interactive like reaction button component with optimistic count updates, toast feedback, and localStorage persistence.
 *
 * @param props - LikeButtonProps configuring post ID and initial like count.
 * @returns React JSX button reaction element.
 */
export function LikeButton({ postId, initialLikes = 0, size = "sm" }: LikeButtonProps) {
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(initialLikes);
  const toast = useToast();

  useEffect(() => {
    const isLiked = localStorage.getItem(`liked_${postId}`) === "true";
    setLiked(isLiked);
  }, [postId]);

  function handleLike(e: React.MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();

    if (liked) {
      setLiked(false);
      setLikesCount((prev) => Math.max(0, prev - 1));
      localStorage.removeItem(`liked_${postId}`);
    } else {
      setLiked(true);
      setLikesCount((prev) => prev + 1);
      localStorage.setItem(`liked_${postId}`, "true");
      toast.success("¡Gracias por tu reacción!");
    }
  }

  const isSmall = size === "sm";

  return (
    <button
      onClick={handleLike}
      className={`inline-flex items-center gap-1.5 transition-all duration-200 select-none ${
        liked
          ? "text-rose-500 font-semibold"
          : "text-text-muted hover:text-rose-500"
      } ${isSmall ? "text-xs py-0.5" : "text-sm py-1"}`}
      title={liked ? "Ya no me gusta" : "Me gusta"}
      aria-label="Reaccionar con me gusta"
    >
      <Heart
        className={`transition-transform duration-200 ${liked ? "fill-rose-500 scale-110" : "scale-100"} ${
          isSmall ? "w-3.5 h-3.5" : "w-4 h-4"
        }`}
      />
      {likesCount > 0 && <span className="tabular-nums font-mono text-xs">{likesCount}</span>}
    </button>
  );
}
