<script setup lang="ts">
import {
  EditorView,
  keymap,
  lineNumbers,
  drawSelection,
  highlightActiveLineGutter,
  dropCursor,
  highlightActiveLine,
} from "@codemirror/view"
import { EditorState, EditorSelection } from "@codemirror/state"
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands"
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { syntaxHighlighting, bracketMatching, foldGutter, foldKeymap, indentOnInput } from "@codemirror/language"
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete"
import { linter, lintGutter, forEachDiagnostic } from "@codemirror/lint"
import { oneDarkHighlightStyle, oneDark } from "@codemirror/theme-one-dark"
import { json, jsonParseLinter } from "@codemirror/lang-json"

import { useStorage } from '@vueuse/core';
import { parseJson, extractAllValidJson } from "./json-util"

const defaultExtensions = [
  json(),
  lintGutter(),
  linter(jsonParseLinter()),
  highlightActiveLine(), // 活动行高亮
  highlightActiveLineGutter(), // 活动行的行号高亮
  highlightSelectionMatches(), // 选择文本时高亮文档中的所有相同内容
  dropCursor(), // 拖动东西时的光标跟随鼠标
  drawSelection(), // 选择多行时的高亮效果优化
  lineNumbers(), // 行号
  EditorState.allowMultipleSelections.of(true), // 支持多选
  closeBrackets(), // 自动闭合括号
  bracketMatching(), // 另一半括号高亮
  history(), // 支持撤回
  foldGutter(), // 代码折叠
  indentOnInput(), // 自动缩进
  oneDark,
  syntaxHighlighting(oneDarkHighlightStyle),
  keymap.of([
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    ...foldKeymap,
    indentWithTab
  ]),
]

const message = ref('')
const rowContent = useStorage('json-editor:raw-content','{"hello": "world", "foo": "bar"}')
const jsonPointers = ref(undefined)
const editorViewRef = ref<Element | DocumentFragment | undefined>(undefined)
const currPointer = ref('')
const editorView = ref<EditorView | undefined>(undefined)

const emit = defineEmits(['update:content', 'update:pointer'])

onMounted(() => {
  const updateListener = EditorView.updateListener.of((v) => {
    if (v.docChanged) { // 内容发生变化
      const content = v.view.state.doc.toString()
      emit('update:content', content)
      try {
        jsonPointers.value = parseJson(content)["pointers"]
      } catch (e) {
        jsonPointers.value = undefined
      }
    }
    if (v.selectionSet) { // 光标位置改变
      if (jsonPointers.value) {
        const pos = v.view.state.selection.main.head
        if (pos) {
          let targetKey = "/"
          for (const key in jsonPointers.value) {
            const value = jsonPointers.value[key]
            let startPos = value["value"]["pos"]
            if (value["key"]) {
              startPos = value["key"]["pos"]
            }
            let endPos = value["valueEnd"]["pos"]
            if (pos >= startPos && pos <= endPos) {
              if (key.length > targetKey.length) {
                targetKey = key
              }
            }
          }
          if (currPointer.value != targetKey) {
            currPointer.value = targetKey
            emit('update:pointer', targetKey)
          }
        }
      }
    }
  })

  editorView.value = new EditorView({
    doc: rowContent.value,
    extensions: [...defaultExtensions, updateListener],
    parent: editorViewRef.value,
  })
})

function doFormatting(event: MouseEvent) {
  message.value = ''
  try {
    setContent(JSON.stringify(JSON.parse(getContent()), null, 2))
  } catch (e) {
    message.value = 'JSON格式错误!'
  }
}

function getContent() {
  if (!editorView.value) {
    return ""
  }
  return editorView.value.state.doc.toString()
}

function setContent(newContent: string) {
  if (!editorView.value) {
    return
  }
  const currContent = getContent()
  if (newContent == currContent) {
    return
  }
  editorView.value.dispatch({
    changes: {
      from: 0,
      to: editorView.value.state.doc.length,
      insert: newContent
    }
  })
}

function extractValidJson(event: MouseEvent) {
  message.value = ''
  const results = extractAllValidJson(getContent())
  if (results.length == 0) {
    message.value = '找不到有效JSON'
  } else {
    setContent(results[0])
  }
}

</script>

<template>
  <div class="tool-content">
    <div class="main-content">
      <div ref="editorViewRef" class="json-editor"></div>
      <c-card class="right-ops">
        <c-input-text :value="currPointer" label="光标所在节点" placeholder="节点路径" readonly monospac></c-input-text>
        <div class="separator" />
        <c-button @click="doFormatting">格式化</c-button>
        <c-button @click="extractValidJson">提取有效JSON</c-button>
      </c-card>
    </div>
    <span style="color: red;">{{ message }}</span>
  </div>
</template>

<style lang="less" scoped>
.tool-content {
  flex: 0 1 100%;
  padding: 0 20px;
}

.main-content {
  height: 66vh;

  display: flex;
  flex-direction: row;
  gap: 10px;
}

.separator {
  width: 100%;
  height: 2px;
  background: rgb(161, 161, 161);
  opacity: 0.2;

  margin: 10px auto;
}

.right-ops {
  flex: 1 1 20%;
  padding: 20px;

  display: flex;
  flex-direction: column;
  gap: 10px;
}

.json-editor {
  height: 100%;
  width: 80%;
  flex: 1 1 80%;

  ::v-deep(& > .cm-editor) {
    height: 100%;
    border: solid 1px #ddd;
    border-radius: 4px;
  }

  ::v-deep(& > .cm-focused) {
    outline: none;
  }
}
</style>