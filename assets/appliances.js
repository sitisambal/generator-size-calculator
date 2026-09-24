// Typical watts for planning. Real units vary. Not a brand catalog.
//
// Source of truth: apps/generator-load-check/lib/appliances.ts (the iPhone app).
// Every id, name, running and starting number here must match the app exactly.
// tests/parity.test.js fails if they drift. Change the app first, then this file.
//
// Only `group` (web grouping) and `icon` (sprite id) are web-only.

/** Web groups, in page order. */
export const GROUPS = [
  { id: 'kitchen', name: 'Kitchen' },
  { id: 'heat-cool', name: 'Heating & cooling' },
  { id: 'water', name: 'Water' },
  { id: 'everyday', name: 'Everyday' },
  { id: 'medical', name: 'Medical' },
  { id: 'tools', name: 'Garage & tools' },
];

export const APPLIANCES = [
  // Kitchen
  { id: 'fridge', name: 'Fridge', group: 'kitchen', running: 200, starting: 1200, icon: 'refrigerator' },
  { id: 'freezer', name: 'Freezer', group: 'kitchen', running: 180, starting: 1100, icon: 'snowflake' },
  { id: 'cooler', name: 'Camp fridge', group: 'kitchen', running: 70, starting: 180, icon: 'thermometer-snowflake' },
  { id: 'microwave', name: 'Microwave', group: 'kitchen', running: 1000, starting: 1000, icon: 'microwave' },
  { id: 'coffee', name: 'Coffee maker', group: 'kitchen', running: 1000, starting: 1000, icon: 'coffee' },
  { id: 'kettle', name: 'Electric kettle', group: 'kitchen', running: 1200, starting: 1200, icon: 'glass-water' },
  { id: 'toaster', name: 'Toaster', group: 'kitchen', running: 900, starting: 900, icon: 'sandwich' },
  { id: 'air-fryer', name: 'Air fryer', group: 'kitchen', running: 1500, starting: 1500, icon: 'chef-hat' },
  { id: 'skillet', name: 'Electric skillet', group: 'kitchen', running: 1250, starting: 1250, icon: 'egg-fried' },
  { id: 'induction', name: 'Induction cooktop', group: 'kitchen', running: 1800, starting: 1800, icon: 'cooking-pot' },

  // Heating & cooling
  { id: 'furnace', name: 'Furnace fan', group: 'heat-cool', running: 600, starting: 1200, icon: 'flame' },
  { id: 'heater', name: 'Space heater', group: 'heat-cool', running: 1500, starting: 1500, icon: 'heater' },
  { id: 'window-ac', name: 'Small window AC', group: 'heat-cool', running: 600, starting: 1800, icon: 'air-vent' },
  { id: 'rv-ac', name: 'RV air conditioner', group: 'heat-cool', running: 1600, starting: 3500, icon: 'caravan' },
  { id: 'fan', name: 'Box fan', group: 'heat-cool', running: 100, starting: 100, icon: 'fan' },
  { id: 'dehumidifier', name: 'Dehumidifier', group: 'heat-cool', running: 500, starting: 1200, icon: 'droplets' },
  { id: 'blanket', name: 'Electric blanket', group: 'heat-cool', running: 180, starting: 180, icon: 'bed' },

  // Water
  { id: 'sump', name: 'Sump pump', group: 'water', running: 800, starting: 1300, icon: 'waves' },
  { id: 'well', name: 'Well pump', group: 'water', running: 1000, starting: 2100, icon: 'droplet' },

  // Everyday
  { id: 'lights', name: 'LED lights', group: 'everyday', running: 80, starting: 80, icon: 'lightbulb' },
  { id: 'wifi', name: 'Wi-Fi router', group: 'everyday', running: 15, starting: 15, icon: 'wifi' },
  { id: 'phone', name: 'Phone charger', group: 'everyday', running: 10, starting: 10, icon: 'smartphone-charging' },
  { id: 'laptop', name: 'Laptop', group: 'everyday', running: 60, starting: 60, icon: 'laptop' },
  { id: 'tv', name: 'TV', group: 'everyday', running: 120, starting: 120, icon: 'tv' },
  { id: 'starlink', name: 'Starlink', group: 'everyday', running: 75, starting: 100, icon: 'satellite-dish' },
  { id: 'hair-dryer', name: 'Hair dryer', group: 'everyday', running: 1500, starting: 1500, icon: 'wind' },

  // Medical
  { id: 'cpap', name: 'CPAP', group: 'medical', running: 60, starting: 60, icon: 'heart-pulse' },

  // Garage & tools
  { id: 'garage', name: 'Garage door', group: 'tools', running: 400, starting: 1400, icon: 'warehouse' },
  { id: 'work-light', name: 'Work light', group: 'tools', running: 80, starting: 80, icon: 'flashlight' },
  { id: 'saw', name: 'Circular saw', group: 'tools', running: 1400, starting: 2300, icon: 'disc-3' },
  { id: 'grinder', name: 'Angle grinder', group: 'tools', running: 1400, starting: 2400, icon: 'drill' },
  { id: 'compressor', name: 'Air compressor', group: 'tools', running: 1200, starting: 2000, icon: 'gauge' },
];

/** Quick starts. Same seeds as the app's KIT_SEEDS. */
export const KITS = [
  { id: 'storm', name: 'Outage', icon: 'cloud-lightning', ids: ['fridge', 'freezer', 'lights', 'cpap', 'wifi', 'phone', 'sump'] },
  { id: 'camp', name: 'Camping', icon: 'tent', ids: ['cooler', 'lights', 'cpap', 'phone', 'laptop', 'starlink', 'fan'] },
  { id: 'jobsite', name: 'Jobsite', icon: 'construction', ids: ['saw', 'work-light', 'compressor', 'phone', 'fan'] },
];

const BY_ID = new Map(APPLIANCES.map((item) => [item.id, item]));

export function applianceById(id) {
  return BY_ID.get(id);
}
