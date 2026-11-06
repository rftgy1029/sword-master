const mapAsset = (name, mapUrl, imageUrl) => ({ name, mapUrl, imageUrl });

export const titleMap = mapAsset('dungeon-entrance',
  new URL('../../assets/maps/dungeon-entrance.tmj', import.meta.url).href,
  new URL('../../assets/maps/dungeon-entrance-tiles.png', import.meta.url).href);

export const battleMaps = {
  hall: mapAsset('battle-ancient-hall',
    new URL('../../assets/maps/battle-ancient-hall.tmj', import.meta.url).href,
    new URL('../../assets/maps/battle-ancient-hall-tiles.png', import.meta.url).href),
  library: mapAsset('battle-forgotten-library',
    new URL('../../assets/maps/battle-forgotten-library.tmj', import.meta.url).href,
    new URL('../../assets/maps/battle-forgotten-library-tiles.png', import.meta.url).href),
  forge: mapAsset('battle-ember-forge',
    new URL('../../assets/maps/battle-ember-forge.tmj', import.meta.url).href,
    new URL('../../assets/maps/battle-ember-forge-tiles.png', import.meta.url).href),
};

// Keep a battle's setting stable even when the scene is recreated or resized.
export function battleMapForMonster(type) {
  if (['ember', 'scarab', 'ravager', 'boss'].includes(type)) return battleMaps.forge;
  if (['bat', 'wisp', 'watcher', 'mushroom'].includes(type)) return battleMaps.library;
  return battleMaps.hall;
}

export function preloadMap(scene, asset) {
  scene.load.tilemapTiledJSON('scene-map', asset.mapUrl);
  scene.load.image('scene-tiles', asset.imageUrl);
}

export function createMapLayers(scene, asset, layerNames) {
  if (!scene.cache.tilemap.exists('scene-map') || !scene.textures.exists('scene-tiles')) return null;
  const map = scene.make.tilemap({ key: 'scene-map' });
  const tiles = map.addTilesetImage(asset.name, 'scene-tiles');
  if (!tiles) return null;
  const layers = layerNames.map((name) => map.createLayer(name, tiles, 0, 0));
  if (layers.some((layer) => !layer)) {
    layers.forEach((layer) => layer?.destroy());
    return null;
  }
  return { map, layers };
}
