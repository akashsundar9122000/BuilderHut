"use client";

import { useState } from "react";

import { ImageSlot } from "@/lib/render/sections/shared";

/*
 * A product's pictures, with the thumbnails doing what thumbnails do.
 *
 * Rendering them as a static strip was most of a gallery and none of the
 * point: a customer clicks the second picture to see the back of the thing
 * before deciding, and nothing happening reads as the page being broken.
 *
 * Client-side only because it is pure selection — no data, no server. One
 * product page has at most eight of these, so they all load with the page and
 * switching is instant.
 */
export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return <ImageSlot url={null} alt={name} ratio="1 / 1" />;
  }

  const current = images[Math.min(active, images.length - 1)]!;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <ImageSlot url={current} alt={name} ratio="1 / 1" />

      {images.length > 1 ? (
        <div
          role="group"
          aria-label={`Pictures of ${name}`}
          style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}
        >
          {images.map((url, index) => (
            <button
              key={url}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`Picture ${index + 1} of ${images.length}`}
              aria-current={index === active}
              style={{
                padding: 0,
                border: 0,
                background: "none",
                cursor: "pointer",
                borderRadius: "var(--sf-radius)",
                /*
                 * The selected one is marked with an outline rather than a
                 * border, so nothing shifts by a pixel as the selection moves
                 * between thumbnails.
                 */
                outline:
                  index === active
                    ? "2px solid var(--sf-primary)"
                    : "2px solid transparent",
                outlineOffset: 2,
              }}
            >
              <ImageSlot url={url} alt="" ratio="1 / 1" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
