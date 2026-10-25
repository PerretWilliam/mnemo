import type { IconName } from '@/components/ui';

/** App icons: Material Symbols name for Android, SF Symbol for iOS. Never use emojis as icons. */
export const Icons = {
  add: { md: 'add', sf: 'plus' },
  ai: { md: 'auto_awesome', sf: 'sparkles' },
  cards: { md: 'style', sf: 'rectangle.stack' },
  check: { md: 'check', sf: 'checkmark' },
  copy: { md: 'content_copy', sf: 'doc.on.doc' },
  correct: { md: 'check_circle', sf: 'checkmark.circle.fill' },
  decks: { md: 'layers', sf: 'square.stack.3d.up' },
  delete: { md: 'delete', sf: 'trash' },
  done: { md: 'done_all', sf: 'checkmark.circle' },
  edit: { md: 'edit', sf: 'pencil' },
  export: { md: 'ios_share', sf: 'square.and.arrow.up' },
  folder: { md: 'folder', sf: 'folder.fill' },
  importFile: { md: 'upload_file', sf: 'doc.badge.plus' },
  paste: { md: 'content_paste', sf: 'doc.on.clipboard' },
  replay: { md: 'replay', sf: 'arrow.counterclockwise' },
  save: { md: 'save', sf: 'square.and.arrow.down' },
  share: { md: 'share', sf: 'square.and.arrow.up' },
  streak: { md: 'local_fire_department', sf: 'flame.fill' },
  study: { md: 'play_arrow', sf: 'play.fill' },
  success: { md: 'target', sf: 'target' },
  undo: { md: 'undo', sf: 'arrow.uturn.backward' },
  wrong: { md: 'cancel', sf: 'xmark.circle.fill' },
} satisfies Record<string, IconName>;
