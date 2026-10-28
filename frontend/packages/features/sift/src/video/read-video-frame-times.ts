import { ALL_FORMATS, BlobSource, EncodedPacketSink, Input } from "mediabunny";

/** Read container timestamps, without decoding video or reading compressed frame payloads. */
export async function readVideoFrameTimes(file: Blob, duration: number) {
  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(file),
  });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error("No video track found.");
    const times: number[] = [];
    const sink = new EncodedPacketSink(track);
    for await (const packet of sink.packets(undefined, undefined, {
      metadataOnly: true,
    })) {
      // The demuxer applies MOV/MP4 edit offsets. Exclude decode-only preroll.
      if (
        !Number.isFinite(packet.timestamp) ||
        packet.timestamp + packet.duration <= 0
      )
        continue;
      const time = Math.max(0, packet.timestamp);
      if (time < duration) times.push(time);
    }
    // Packets arrive in decode order; B-frames must be stepped in presentation order.
    times.sort((a, b) => a - b);
    const unique = times.filter((time, i) => i === 0 || time !== times[i - 1]);
    if (!unique.length) throw new Error("No video frame timestamps found.");
    return Float64Array.from(unique);
  } finally {
    input.dispose();
  }
}
