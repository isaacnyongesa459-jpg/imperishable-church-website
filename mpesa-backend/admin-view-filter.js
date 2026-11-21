"use strict";

function findSectionRange(html, sectionId) {
  const tags = /<\/?section\b[^>]*>/gi;
  let tag;

  while ((tag = tags.exec(html))) {
    if (tag[0].startsWith("</")) continue;
    const idMatch = tag[0].match(/\bid\s*=\s*(["'])(.*?)\1/i);
    if (!idMatch || idMatch[2] !== sectionId) continue;

    const start = tag.index;
    let depth = 1;
    let nestedTag;
    while ((nestedTag = tags.exec(html))) {
      if (nestedTag[0].startsWith("</")) depth -= 1;
      else depth += 1;
      if (depth === 0) {
        return { start, end: tags.lastIndex };
      }
    }
    throw new Error(`Admin section ${sectionId} has no matching closing tag.`);
  }

  return null;
}

function findSectionRangeContaining(html, marker) {
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return null;

  const tags = /<\/?section\b[^>]*>/gi;
  const openSections = [];
  let tag;
  while ((tag = tags.exec(html))) {
    if (tag.index >= markerIndex) {
      tags.lastIndex = tag.index;
      break;
    }
    if (tag[0].startsWith("</")) openSections.pop();
    else openSections.push({ start: tag.index });
  }
  const target = openSections.at(-1);
  if (!target) return null;

  let depth = 1;
  let nestedTag;
  while ((nestedTag = tags.exec(html))) {
    if (nestedTag[0].startsWith("</")) depth -= 1;
    else depth += 1;
    if (depth === 0) return { start: target.start, end: tags.lastIndex };
  }
  throw new Error("An admin dashboard summary section has no matching closing tag.");
}

function retainOnlyAdminSection(html, selectedId, sectionIds) {
  if (typeof html !== "string" || !Array.isArray(sectionIds) ||
      typeof selectedId !== "string" || !sectionIds.includes(selectedId)) {
    throw new TypeError("A template, selected section ID, and known section IDs are required.");
  }

  if (!findSectionRange(html, selectedId)) {
    throw new Error(`Admin template does not contain section ${selectedId}.`);
  }

  let filtered = html;
  const dashboardSummary = findSectionRangeContaining(filtered, 'id="totalDonations"');
  if (dashboardSummary) {
    filtered = filtered.slice(0, dashboardSummary.start) + filtered.slice(dashboardSummary.end);
  }
  for (const sectionId of new Set(sectionIds)) {
    if (sectionId === selectedId) continue;
    const range = findSectionRange(filtered, sectionId);
    if (range) filtered = filtered.slice(0, range.start) + filtered.slice(range.end);
  }
  return filtered;
}

module.exports = { retainOnlyAdminSection };
