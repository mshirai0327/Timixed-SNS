import type { DriftPublic } from './types';

export const sampleDrifts: DriftPublic[] = [
  {
    id: 'sample-1',
    author: {
      id: 'user-1',
      handle: 'mizuho',
      display_name: 'みずほ',
      avatar_url: null
    },
    body: '夜の静けさが、今日は少しだけやさしい。',
    resurface_count: 0,
    resonance_count: 12,
    is_resonated: false,
    is_mine: true
  },
  {
    id: 'sample-2',
    author: {
      id: 'user-2',
      handle: 'kumo',
      display_name: 'くも',
      avatar_url: null
    },
    body: '返事を待たない言葉だけが、長く漂う気がする。',
    resurface_count: 1,
    resonance_count: 7,
    is_resonated: true,
    is_mine: false
  },
  {
    id: 'sample-3',
    author: {
      id: 'user-3',
      handle: 'sora',
      display_name: 'そら',
      avatar_url: null
    },
    body: '思い出すほどでもないのに、ずっと残っている。',
    resurface_count: 2,
    resonance_count: 19,
    is_resonated: false,
    is_mine: false
  }
];
