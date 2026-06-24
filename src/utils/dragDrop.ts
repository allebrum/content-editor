export const BLOCK_DRAG_MIME = 'application/x-allebrum-block';

export type BlockDragSource = {
  pos: number;
  parentSectionPos: number | null;
};

let activeBlockDragSource: BlockDragSource | null = null;

export function setActiveBlockDragSource(source: BlockDragSource | null) {
  activeBlockDragSource = source;
}

export function getActiveBlockDragSource(): BlockDragSource | null {
  return activeBlockDragSource;
}
