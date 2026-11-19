import { Extension } from "@tiptap/core";

/**
 * Custom TipTap extension governing Enter key semantics for block-level transitions.
 *
 * Handles three specific cases:
 * - Headings: Pressing Enter at the end of a heading exits to a clean paragraph.
 * - Empty blockquotes: Pressing Enter inside an empty blockquote lifts it to a paragraph.
 * - List items / nested paragraphs: Defers to TipTap's default Enter behavior.
 */
export const AutoExitBlockOnEnter = Extension.create({
  name: "autoExitBlockOnEnter",
  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { selection } = editor.state;
        const { $from, empty } = selection;
        if (!empty) return false;

        const depth = $from.depth;

        for (let d = depth; d >= 0; d--) {
          const ancestorType = $from.node(d).type.name;
          if (ancestorType === "listItem" || ancestorType === "taskItem") {
            return false;
          }
        }

        const parentType = $from.parent.type.name;

        if (parentType === "heading") {
          const isAtEnd = $from.parentOffset === $from.parent.content.size;
          if (isAtEnd) {
            return editor.chain().splitBlock({ keepMarks: false }).setParagraph().unsetAllMarks().run();
          }
          return false;
        }

        if (parentType === "blockquote" && $from.parent.content.size === 0) {
          return editor.chain().lift("blockquote").setParagraph().unsetAllMarks().run();
        }

        for (let d = depth - 1; d >= 0; d--) {
          const ancestorType = $from.node(d).type.name;
          if (ancestorType === "blockquote") {
            const paragraph = $from.parent;
            if (paragraph.content.size === 0) {
              return editor.chain().lift("blockquote").run();
            }
            break;
          }
        }

        return false;
      },
    };
  },
});
