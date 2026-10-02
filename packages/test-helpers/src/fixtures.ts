import directoryTreeData from "./fixtures/directory_tree.json"
import fileListData from "./fixtures/file_list.json"
import markdownDocumentData from "./fixtures/markdown_document.json"
import bashOutputData from "./fixtures/bash_output.json"
import uiComponentDataTableData from "./fixtures/ui_component_data_table.json"
import uiComponentTextData from "./fixtures/ui_component_text.json"
import uiComponentContainerData from "./fixtures/ui_component_container.json"

export function loadFixture(name: string): unknown {
  const map: Record<string, unknown> = {
    directory_tree: directoryTreeData,
    file_list: fileListData,
    markdown_document: markdownDocumentData,
    bash_output: bashOutputData,
    ui_component_data_table: uiComponentDataTableData,
    ui_component_text: uiComponentTextData,
    ui_component_container: uiComponentContainerData,
  }
  const data = map[name]
  if (!data) throw new Error(`Unknown fixture: "${name}". Available: ${Object.keys(map).join(", ")}`)
  return structuredClone(data)
}

export const fixtures = {
  directoryTree: () => loadFixture("directory_tree"),
  fileList: () => loadFixture("file_list"),
  markdownDocument: () => loadFixture("markdown_document"),
  bashOutput: () => loadFixture("bash_output"),
  uiComponent: {
    dataTable: () => loadFixture("ui_component_data_table"),
    text: () => loadFixture("ui_component_text"),
    container: () => loadFixture("ui_component_container"),
  },
}
