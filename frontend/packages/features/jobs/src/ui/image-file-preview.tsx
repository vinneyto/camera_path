"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export function ImageFilePreview({ file }: { file: File }) {
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(
    null,
  );
  useEffect(() => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string")
        setPreview({ file, url: reader.result });
    };
    reader.readAsDataURL(file);
    return () => reader.abort();
  }, [file]);
  if (preview?.file !== file) return null;
  return (
    <Image
      src={preview.url}
      alt={file.name}
      width={518}
      height={518}
      unoptimized
      className="max-h-80 w-full rounded-md border object-contain"
    />
  );
}
