"use strict";

const README_START = "<!-- orbit:start -->";
const README_END = "<!-- orbit:end -->";

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function deepMerge(existing, additions, conflicts) {
  if (conflicts == null) conflicts = [];
  if (!isPlainObject(existing)) return { merged: additions, conflicts };
  const merged = Object.assign({}, existing);
  for (const key of Object.keys(additions)) {
    const a = additions[key];
    if (!(key in merged)) {
      merged[key] = a;
      continue;
    }
    const b = merged[key];
    if (isPlainObject(a) && isPlainObject(b)) {
      const child = deepMerge(b, a, conflicts);
      merged[key] = child.merged;
      continue;
    }
    if (a === b) continue;
    conflicts.push(key);
  }
  return { merged, conflicts };
}

function mergePackageJson(existingText, additions) {
  let existing = {};
  let malformed = false;
  if (existingText && existingText.trim()) {
    try {
      existing = JSON.parse(existingText);
      if (!isPlainObject(existing)) {
        existing = {};
        malformed = true;
      }
    } catch (e) {
      malformed = true;
      existing = {};
    }
  }
  if (malformed) {
    return { merged: null, malformed: true, conflicts: [], addedKeys: [] };
  }
  const conflicts = [];
  const addedKeys = [];
  const merged = Object.assign({}, existing);

  for (const section of Object.keys(additions)) {
    const additionSection = additions[section];
    if (!isPlainObject(additionSection)) {
      if (!(section in merged)) {
        merged[section] = additionSection;
        addedKeys.push(section);
      } else if (merged[section] !== additionSection) {
        conflicts.push(section);
      }
      continue;
    }
    const existingSection = isPlainObject(merged[section]) ? merged[section] : {};
    const nextSection = Object.assign({}, existingSection);
    for (const key of Object.keys(additionSection)) {
      const a = additionSection[key];
      if (!(key in nextSection)) {
        nextSection[key] = a;
        addedKeys.push(`${section}.${key}`);
      } else if (nextSection[key] !== a) {
        if (isPlainObject(nextSection[key]) && isPlainObject(a)) {
          const child = deepMerge(nextSection[key], a, []);
          nextSection[key] = child.merged;
          for (const c of child.conflicts) conflicts.push(`${section}.${key}.${c}`);
        } else {
          conflicts.push(`${section}.${key}`);
        }
      }
    }
    merged[section] = nextSection;
  }

  return { merged, malformed: false, conflicts, addedKeys };
}

function mergeReadme(existingText, additionBlock) {
  if (!existingText) {
    return { merged: additionBlock, action: "WRITE" };
  }
  if (existingText.includes(README_START)) {
    return { merged: existingText, action: "NOOP" };
  }
  const sep = existingText.endsWith("\n") ? "\n" : "\n\n";
  return { merged: existingText + sep + additionBlock, action: "APPEND" };
}

module.exports = {
  mergePackageJson,
  mergeReadme,
  deepMerge,
  isPlainObject,
  README_START,
  README_END
};
