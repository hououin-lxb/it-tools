import { ArrowsShuffle } from '@vicons/tabler';
import { defineTool } from '../tool';

export const tool = defineTool({
  name: 'Json editor',
  path: '/json-editor',
  description: 'Provide various editing functions for JSON, such as format checking and beautification.',
  keywords: ['json', 'editor'],
  component: () => import('./json-editor.vue'),
  icon: ArrowsShuffle,
  createdAt: new Date('2025-11-28'),
});