export function mapPointerToPixels(clientX, clientY, rect, dimensions) {
  if (!rect.width || !rect.height) return null;
  return {
    x: Math.max(0, Math.min(dimensions.width, Math.round((clientX - rect.left) / rect.width * dimensions.width))),
    y: Math.max(0, Math.min(dimensions.height, Math.round((clientY - rect.top) / rect.height * dimensions.height))),
  };
}

export function moveRegion(region, dx, dy, bounds) {
  return {
    ...region,
    x: Math.max(0, Math.min(bounds.width - region.width, region.x + dx)),
    y: Math.max(0, Math.min(bounds.height - region.height, region.y + dy)),
  };
}

export function resizeRegion(region, dx, dy, bounds) {
  return {
    ...region,
    width: Math.max(1, Math.min(bounds.width - region.x, region.width + dx)),
    height: Math.max(1, Math.min(bounds.height - region.y, region.height + dy)),
  };
}
