import { createCn } from "cn/config";

// Teach the class merger our type scale (doc 04 §2.3). Without this, "text-body" reads as a text
// colour and silently removes real colours such as the white label on primary buttons.
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [{ text: ["display", "h1", "h2", "h3", "body", "small", "caption"] }],
    },
  },
});
