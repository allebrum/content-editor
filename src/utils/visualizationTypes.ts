export interface VisualizationType {
  value: string;
  label: string;
  emoji: string;
  description: string;
}

export const VISUALIZATION_TYPES: VisualizationType[] = [
  { value: 'arrow-bars', label: 'Arrow bars', emoji: '→', description: 'Horizontal bars with arrows showing sequential steps or a process flow' },
  { value: 'bubbles', label: 'Bubbles', emoji: '○', description: 'Circles of varying sizes representing ideas or concepts floating in space' },
  { value: 'bullseye', label: 'Bullseye', emoji: '◎', description: 'Concentric rings from outer to inner showing priorities or levels' },
  { value: 'chain', label: 'Chain', emoji: '⛓', description: 'Linked rings or circles in a chain showing connected or sequential concepts' },
  { value: 'concentric-circles', label: 'Concentric circles', emoji: '⊙', description: 'Nested circles from largest to smallest representing hierarchy or scale' },
  { value: 'connected-circles', label: 'Connected circles', emoji: '◉', description: 'Circles connected by lines showing relationships or a network' },
  { value: 'diamonds', label: 'Diamonds', emoji: '◆', description: 'Diamond shapes arranged elegantly, structured and geometric' },
  { value: 'funnel-3d', label: 'Funnel 3D', emoji: '▽', description: '3D funnel shape showing stages narrowing from top to bottom' },
  { value: 'gears', label: 'Gears', emoji: '⚙', description: 'Interlocking gear shapes representing processes that work together' },
  { value: 'hot-air-balloons', label: 'Hot air balloons', emoji: '🎈', description: 'Balloon shapes floating at different heights, playful and uplifting' },
  { value: 'iceberg', label: 'Iceberg', emoji: '🧊', description: 'Tip above and bulk below the waterline showing visible vs hidden aspects' },
  { value: 'ideas', label: 'Ideas', emoji: '💡', description: 'Lightbulb or rounded-rectangle shapes representing distinct ideas or concepts' },
  { value: 'infinity', label: 'Infinity', emoji: '∞', description: 'Infinity loop shape showing a continuous cycle or endless process' },
  { value: 'inputs', label: 'Inputs', emoji: '⤵', description: 'Multiple arrows/inputs flowing into a central output or process' },
  { value: 'isometric-building', label: 'Isometric building', emoji: '🏛', description: 'Isometric 3D building blocks representing layers or structure' },
  { value: 'isometric-dashed-squares', label: 'Isometric squares', emoji: '⬡', description: 'Isometric dashed squares in 3D perspective, grid-like structure' },
  { value: 'isometric-globe', label: 'Isometric globe', emoji: '🌐', description: 'Isometric globe showing global reach or worldwide concepts' },
  { value: 'linear-venn', label: 'Linear venn', emoji: '⊃', description: 'Horizontally arranged overlapping ovals showing overlap and relationship' },
  { value: 'linear-venn-filled', label: 'Linear venn filled', emoji: '⊂', description: 'Filled horizontal venn with colored sections for visual contrast' },
  { value: 'minimal-funnel', label: 'Minimal funnel', emoji: '▿', description: 'Clean minimal funnel with flat design, stages from wide to narrow' },
  { value: 'minimal-road', label: 'Minimal road', emoji: '─', description: 'A simple road or path with labeled milestones, showing a journey' },
  { value: 'nested-diamond', label: 'Nested diamond', emoji: '◇', description: 'Nested diamond shapes from outer to inner showing depth or priorities' },
  { value: 'orbit', label: 'Orbit', emoji: '⭕', description: 'Central concept with satellite ideas orbiting around it' },
  { value: 'packed-circles', label: 'Packed circles', emoji: '●', description: 'Circles packed together like cells, varying sizes showing relative importance' },
  { value: 'pillar', label: 'Pillar', emoji: '||', description: 'Vertical columns/pillars supporting a header, showing supporting elements' },
  { value: 'pinwheel', label: 'Pinwheel', emoji: '✳', description: 'Pinwheel blades radiating from center showing aspects of a whole' },
  { value: 'puzzle', label: 'Puzzle', emoji: '🧩', description: 'Interlocking puzzle pieces showing how components fit together' },
  { value: 'quadrant', label: 'Quadrant', emoji: '⊞', description: '2×2 grid quadrant with labels for each section and axes' },
  { value: 'ribbon-arrows', label: 'Ribbon arrows', emoji: '⤻', description: 'Ribbon-style flowing arrows showing a process or transitions' },
  { value: 'road', label: 'Road', emoji: '🛣', description: 'Winding road with signposts at each milestone showing a journey' },
  { value: 'semi-circle-road', label: 'Semi circle road', emoji: '◗', description: 'Semi-circular arc road showing progression or a phased journey' },
  { value: 'signs', label: 'Signs', emoji: '🪧', description: 'Road sign shapes pointing in directions representing choices or options' },
  { value: 'slope', label: 'Slope', emoji: '∕', description: 'An upward slope with points along it showing growth or progression' },
  { value: 'solar-system', label: 'Solar system', emoji: '☀', description: 'Central sun concept with planets orbiting at different distances' },
  { value: 'square-arrows', label: 'Square arrows', emoji: '↕', description: 'Square shapes with arrows between them showing a structured flow' },
  { value: 'swoosh', label: 'Swoosh', emoji: '〜', description: 'Flowing curved shape with items along the curve, dynamic and energetic' },
  { value: 'target', label: 'Target', emoji: '🎯', description: 'Target with items labeled at different rings showing priority levels' },
  { value: 'venn-diagram', label: 'Venn diagram', emoji: '⊗', description: 'Two or three overlapping circles showing shared and unique properties' },
  { value: 'versus', label: 'Versus', emoji: 'VS', description: 'Two sides compared against each other showing contrast or competition' },
];
