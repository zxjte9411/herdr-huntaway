const cleanTitle = s => (s ?? "").replace(/^[^\p{L}\p{N}\p{Ps}\p{Pi}]+/u, "").replace(/^\[ [!.] \] /, "").trim();

export function tabLabel(tab, lead) {
  const program = lead?.program;
  const title = cleanTitle(lead?.title);
  const raw = (lead?.title ?? "").replace(/^[^\p{L}\p{N}~/]+/u, "");
  const path = /^[~/]|^[A-Za-z]:\\/.test(raw);
  const live = program?.agent && title && title !== lead.terminal && title !== program.name
    && title.toLowerCase() !== program.key && !path && !title.includes("@");
  if (!live && program?.key === "antigravity" && lead.terminal && (!tab.named || tab.name === program.name)) return lead.terminal;
  return live && (!tab.named || tab.name === program.name)
    ? title
    : /^\d+$/.test(tab.name) ? program?.name ?? "Terminal" : tab.name;
}
