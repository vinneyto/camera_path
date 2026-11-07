"use client";

import { useState } from "react";
import { TextJobCreateForm } from "./text-job-create-form";
import { ImageJobCreateForm } from "./image-job-create-form";

export function JobCreateForm() {
  const [template, setTemplate] = useState("text");
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="job-template" className="block text-sm font-medium">
          Template
        </label>
        <select
          id="job-template"
          value={template}
          onChange={(event) => setTemplate(event.target.value)}
          className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs sm:w-auto"
        >
          <option value="text">Trellis · Text to 3D</option>
          <option value="image">Trellis · Image to 3D</option>
        </select>
      </div>
      {template === "image" ? <ImageJobCreateForm /> : <TextJobCreateForm />}
    </div>
  );
}
