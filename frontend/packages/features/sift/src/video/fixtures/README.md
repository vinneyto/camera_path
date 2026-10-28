# Frame timeline fixtures

Synthetic FFmpeg `testsrc2` clips (64×96, H.264 with B-frames, faststart).
No user media is included. The MP4 contains 12 frames at 24 FPS. The MOV retains
source frames 0, 1, 5, 6, …, 25, 26 from a 30 FPS, one-second source, producing
variable presentation intervals. Both contain the usual MP4/MOV edit offset
for decoder preroll. Expected timestamps were checked with `ffprobe -show_frames`.

Generate with FFmpeg (including libx264):

```sh
ffmpeg -f lavfi -i 'testsrc2=size=64x96:rate=24:duration=0.5' \
  -c:v libx264 -bf 3 -g 24 -x264-params scenecut=0 -pix_fmt yuv420p \
  -movflags +faststart cfr-bframes.mp4
ffmpeg -f lavfi -i 'testsrc2=size=64x96:rate=30:duration=1' \
  -vf "select='eq(mod(n,5),0)+eq(mod(n,5),1)'" -fps_mode vfr \
  -c:v libx264 -bf 3 -g 30 -x264-params scenecut=0 -pix_fmt yuv420p \
  -movflags +faststart vfr-bframes.mov
```
