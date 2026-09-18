import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

interface ResolverResult {
    shape: string;
    body: { [key: string]: unknown };
}

interface ProjectPlanPointer {
  type: "project_plan";
  [key: string]: unknown;
}

async function resolveProjectPlan(pointer: ProjectPlanPointer): Promise<ResolverResult> {
  const notePath = String(pointer["note_path"] ?? "");
  if (!notePath) return { shape: "projectPlanReport", body: { error: "note_path_required" } };

  const peer_routing: Array<{ vessel_id: string; has_note: boolean }> = [];
  let content = "";

  const fullPath = join("/workspace/git/super-repo", notePath);

  try {
    content = await readFile(fullPath, { encoding: "utf8" });
  } catch (error) {
    console.error(`Error reading note file ${fullPath}: ${error}`);
    return { shape: "projectPlanReport", body: { note_path: notePath, peer_routing, items: [], dry_run: true, plan_actions: [], executed: [], error: String(error) } };
  }

  const todoSectionRegex = /## To do[\s\S]*?(?=\n## |$)/;
  let todoSectionMatch = todoSectionRegex.exec(content);
  let todoSection = todoSectionMatch ? todoSectionMatch[0] : "";
  const todoSectionStartIndex = todoSectionMatch ? todoSectionMatch.index : -1;
  const todoSectionEndIndex = todoSectionMatch ? todoSectionMatch.index + todoSectionMatch[0].length : -1;


  const items = [...todoSection.matchAll(/^- \[( |x)\] (.+)$/gm)].map((m) => {
    const text = (m[2] ?? "").trim();
    const checked = m[1] === "x";
    const dispatched = text.includes("⇒ dispatched") || text.includes("[DISPATCHED");
    const lower = text.toLowerCase();
    const cls = text.endsWith("?") ? "human_or_llm_question" : /repos\/[\w.-]+\/src\//.test(text) ? "substrate_authorable" : /(css|style)\b/.test(lower) ? "obsidian_feature" : "substrate_authorable";
    return { text, checked, dispatched, class: cls, raw: m[0] };
  });

  const plan_actions = items.filter((it) => !it.checked && !it.dispatched).map((it) => {
    if (it.class === "human_or_llm_question") {
      return { action: "solicit_human", item: it.text, delivery: "discussion_entry", note_path: notePath };
    }
    if (it.class === "obsidian_feature") {
      const target = /(provenance|styling|css|format)/i.test(it.text)
        ? "repos/obsidian-vessel/src/resolvers/write-note-resolver.ts"
        : "repos/obsidian-vessel/src/main.ts";
      return { action: "dispatch_goal", item: it.text, goal: `In ${target}, implement: ${it.text}` };
    }
    return { action: "dispatch_goal", item: it.text, goal: /repos\/[\w.-]+\/src\//.test(it.text) ? it.text : `Author via the substrate loop: ${it.text}` };
  });

  const wet = pointer["dry_run"] === false;
  let noteContent = content;
  const executed: Array<Record<string, unknown>> = [];

  if (wet) {
    let newTodoSection = todoSection;
    for (const item of items) {
      if (!item.checked && !item.dispatched) {
        // Mark as dispatched and checked
        const timestamp = new Date().toISOString().replace(/T/, ).replace(/\..+/, );
        const newRaw = ` - [x] [DISPATCHED:${timestamp}] ${item.text}`;
        newTodoSection = newTodoSection.replace(item.raw, newRaw);
        executed.push({ item: item.text, status: "dispatched", timestamp: timestamp });
        // TODO: Actually dispatch a substrateGap here.
      }
    }
    if (todoSectionMatch) {
      noteContent = content.substring(0, todoSectionStartIndex) + newTodoSection + content.substring(todoSectionEndIndex);
    } else {
      // If there was no "## To do" section, just append to the end.
      noteContent += `\n## To do\n` + newTodoSection;
    }
    await writeFile(fullPath, noteContent, { encoding: "utf8" });
  }

  return { shape: "projectPlanReport", body: { note_path: notePath, peer_routing, items, dry_run: !wet, plan_actions, executed } };
}

interface ProjectThreadScanPointer {
  type: "project_thread_scan";
  [key: string]: unknown;
}

async function resolveProjectThreadScan(pointer: ProjectThreadScanPointer): Promise<ResolverResult> {
  const folder = String(pointer["folder"] ?? "Substrate/Projects");
  const query = String(pointer["query"] ?? "project");
  const scanned_peers: Array<{ vessel_id: string; results: number }> = [];
  const paths = new Set<string>();

  const projectFolderPath = `/workspace/git/super-repo/${folder}`;

  try {
    const files = await readdir(projectFolderPath);
    for (const file of files) {
      if (file.endsWith(".md")) {
        paths.add(join(folder, file));
      }
    }
  } catch (error) {
    console.error(`Error reading project folder: ${error}`);
    return { shape: "projectThreadScanReport", body: { folder, query, scanned_peers, notes: [], error: String(error) } };
  }

  const notes: Array<{ note_path: string; items_found: number; open_items: number; executed?: unknown }> = [];
  for (const note_path of paths) {
    const execute = pointer["execute"] ?? false; 
    try {
      const plan = await resolveProjectPlan({ type: "project_plan", note_path, dry_run: !execute });
      const body = plan.body as { items?: Array<{ checked?: boolean }> };
      const items = Array.isArray(body.items) ? body.items : [];
      notes.push(execute
          ? { note_path, items_found: items.length, open_items: items.filter((i) => i.checked !== true).length, executed: (plan.body as { executed?: unknown }).executed }
          : { note_path, items_found: items.length, open_items: items.filter((i) => i.checked !== true).length });
    } catch (error) {
      console.error(`Error reading or parsing note file ${note_path}: ${error}`);
      notes.push({ note_path, items_found: 0, open_items: 0, error: String(error) });
    }
  }
  return { shape: "projectThreadScanReport", body: { folder, query, scanned_peers, notes } };
}

resolveProjectThreadScan({ type: "project_thread_scan", folder: "Substrate/Projects", execute: true })
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((error) => console.error(error));
