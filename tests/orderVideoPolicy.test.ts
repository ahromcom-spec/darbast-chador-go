import { describe, expect, it } from 'bun:test';
import { orderVideoEncodingArgs, ORDER_VIDEO_MAX_SECONDS, ORDER_VIDEO_SD_SIZE } from '../src/lib/orderVideoPolicy';

describe('order video storage policy', () => {
  it('encodes only the first 60 seconds, without seeking past the beginning', () => {
    const args = orderVideoEncodingArgs('source.mov', 'output.mp4');
    expect(ORDER_VIDEO_MAX_SECONDS).toBe(60);
    expect(args[args.indexOf('-t') + 1]).toBe('60');
    expect(args).not.toContain('-ss');
  });
  it('bounds SD video to 480 pixels on the short edge and preserves shape', () => {
    const args = orderVideoEncodingArgs('source.mov', 'output.mp4');
    expect(ORDER_VIDEO_SD_SIZE).toBe(480);
    const filter = args[args.indexOf('-vf') + 1];
    expect(filter).toContain('min(ih,480)');
    expect(filter).toContain('min(iw,480)');
    expect(filter).toContain('force_original_aspect_ratio=decrease');
  });
});